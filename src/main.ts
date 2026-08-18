import { Notice, Plugin } from "obsidian";
import { DocIdServices } from "stable-ids-for-obsidian";
import type { DocIdService } from "stable-ids-for-obsidian";
import { CanvasParseCache } from "./adapters/CanvasParseCache";
import { FolderNoteIndex } from "./adapters/FolderNoteIndex";
import { FrontmatterIdIndex } from "./adapters/FrontmatterIdIndex";
import { LiveLinkOccurrenceProvider } from "./adapters/LiveLinkOccurrenceProvider";
import { NamedRelationshipsIndex } from "./adapters/NamedRelationshipsIndex";
import { ObsidianNoteCreation } from "./adapters/ObsidianNoteCreation";
import { VicinityGraphBuilder } from "./adapters/VicinityGraphBuilder";
import { DocIdMapWarmer } from "./persistence/DocIdMapWarmer";
import { OrphanSweeper, SWEEP_DELAY_MS } from "./persistence/OrphanSweeper";
import { PathDocIdMap } from "./persistence/PathDocIdMap";
import { PerDocStore } from "./persistence/PerDocStore";
import { PersistenceServices } from "./persistence/PersistenceServices";
import { PluginDataAdapter } from "./persistence/PluginDataAdapter";
import { PluginDataStore } from "./persistence/PluginDataStore";
import { VaultAdapterFsPort } from "./persistence/vaultFsPort";
import { VaultFileStore } from "./persistence/VaultFileStore";
import { GraphViewOpener } from "./view/GraphViewOpener";
import { SettingsWritePipeline } from "./view/settingsWritePipeline";
import { VicinityGraphSettingTab } from "./view/VicinityGraphSettingTab";
import { VicinityGraphView, VIEW_TYPE_VICINITY_GRAPH } from "./view/VicinityGraphView";
import type { UserNoticePort, ViewsRefreshPort } from "./view/viewPorts";

// manifest.json minAppVersion WHY: 1.12.4 is the first PUBLIC Obsidian release where
// canvas backlinks are core-indexed (resolvedLinks/graph; EA 1.12.0, 2026-02). It is a
// floor, never a ceiling — newer versions must keep working. Canvas
// `metadata.frontmatter` (used by stable-ids-for-obsidian) was NOT introduced by any core
// version; it rides canvas's documented arbitrary-key forward compatibility.

/**
 * Vault-root-relative directory the {@link VaultFileStore} owns. Under the vault
 * root (NOT `.obsidian/`) on purpose: users who exclude `.obsidian` from sync
 * still get this tree, and it is versioned/quarantined for the merge conflicts
 * vault-content sync brings.
 */
const VAULT_FILE_STORE_ROOT = ".plugin_data/vicinity_graph";

export default class VicinityGraphPlugin extends Plugin {
	/** Doc-scoped persistence entry points (pin / unpin). */
	persistenceServices!: PersistenceServices;
	/** The per-rebuild orchestration for step 04 (view). */
	graphBuilder!: VicinityGraphBuilder;
	/** Global settings + pinned set (data.json) — step 06 reads/writes globals here. */
	pluginDataStore!: PluginDataStore;
	/**
	 * Versioned, conflict-resilient per-id JSON store under the vault-root
	 * `.plugin_data/vicinity_graph/` tree (syncs as vault content, unlike
	 * `data.json`). Backs {@link perDocStore}.
	 */
	vaultFileStore!: VaultFileStore;
	/**
	 * The per-doc/per-main facts (node overrides + local pins) as vault content on
	 * {@link vaultFileStore}. Exposed so the e2e harness can read/write them the
	 * same way it reaches {@link pluginDataStore} for globals.
	 */
	perDocStore!: PerDocStore;
	/**
	 * THE settings write pipeline: ONE per plugin, shared by the settings tab and by
	 * every open view's controls panel. Sharing it is what makes "one serialised
	 * chain, one merge base, one fan-out" true across surfaces — two pipelines would
	 * be two chains, and two chains can interleave.
	 */
	settingsWrites!: SettingsWritePipeline;

	private docIdService!: DocIdService;
	private readonly pathDocIdMap = new PathDocIdMap();
	/**
	 * ONE scanner for the whole plugin: the read path's on-demand warm-up and the
	 * delayed sweep share it, so the two never scan the vault concurrently and a
	 * docid resolved (or missed) by one is known to the other.
	 */
	private docIdMapWarmer!: DocIdMapWarmer;
	/** Plugin-lived on purpose: canvas parses survive across graph rebuilds (mtime-keyed). */
	private readonly canvasParseCache = new CanvasParseCache();
	/**
	 * Plugin-lived on purpose: the frontmatter-id reverse index warms once (lazily on
	 * the first graph build) and survives across rebuilds, invalidated by metadata /
	 * vault events rather than rebuilt every build. Assigned in {@link onload} once the
	 * data store exists to supply the configured field list.
	 */
	private frontmatterIdIndex!: FrontmatterIdIndex;
	/**
	 * Plugin-lived like {@link frontmatterIdIndex}: the folder-note index warms once
	 * (lazily on the first graph build) and survives across rebuilds, invalidated by
	 * vault PATH events (create/delete/rename) — a body edit can never move a
	 * path-chosen folder note.
	 */
	private folderNoteIndex!: FolderNoteIndex;
	/**
	 * Plugin-lived named-relationships index (`supports::[[x]]` statements —
	 * metadataCache carries no `::` prefixes, so raw markdown is parsed once and
	 * kept fresh by the SAME lifecycle events as the other indexes; scan starts
	 * eagerly at load and never blocks it, graph builds await readiness).
	 */
	private namedRelationsIndex!: NamedRelationshipsIndex;
	/**
	 * The plugin's ONE vault-WRITE seam (`Vault.create` + a `folderExists` read). Shared
	 * by the builder (folder-existence half of the create-child-note chip predicate) and
	 * every view's `ChildNoteCreator` (the write + open). Plugin-lived and stateless.
	 */
	private noteCreation!: ObsidianNoteCreation;
	private sweepTimer: number | null = null;
	/**
	 * {@link ViewsRefreshPort} over this plugin's own leaf walk, handed to every
	 * view it creates so a global write made INSIDE a controls panel fans out
	 * exactly like one made in the settings tab. The workspace stays known only
	 * here; the view layer sees one method.
	 */
	private readonly viewsRefresh: ViewsRefreshPort = { refreshAllViews: () => this.refreshOpenViews() };

	/**
	 * {@link UserNoticePort} over Obsidian's own transient toast — the ONE place this
	 * plugin's `Notice` constructor is reached for on behalf of the view layer, so
	 * everything that must tell the user something (a failed settings write, a refused
	 * pin) says it without importing `obsidian` — and stays unit-testable over a fake.
	 */
	private readonly notices: UserNoticePort = {
		show: (message) => {
			new Notice(message);
		},
	};

	async onload(): Promise<void> {
		this.docIdService = DocIdServices.createDefault(this.app.vault);
		// data.json I/O: Plugin.loadData/saveData for the parsed path, plus a raw-bytes
		// probe + quarantine (over vault.adapter) so a PERMANENTLY corrupt data.json is
		// told from a transient failure and set aside instead of degrading every session
		// (ticket nid_08ripmsxon0r9ncn42lp623g1_e).
		const dataJsonPath = `${this.manifest.dir ?? this.app.vault.configDir + "/plugins/" + this.manifest.id}/data.json`;
		this.pluginDataStore = new PluginDataStore(
			new PluginDataAdapter(this, new VaultAdapterFsPort(this.app.vault.adapter), dataJsonPath, Date.now),
			this.notices,
			undefined,
			dataJsonPath,
		);
		await this.pluginDataStore.init();
		// Vault-root tree (NOT under .obsidian/) so it syncs as vault content; raw
		// adapter I/O — Plugin.loadData/saveData cannot reach outside the plugin folder.
		this.vaultFileStore = new VaultFileStore(
			VAULT_FILE_STORE_ROOT,
			new VaultAdapterFsPort(this.app.vault.adapter),
			Date.now,
			this.notices,
		);
		this.perDocStore = new PerDocStore(this.vaultFileStore);
		this.settingsWrites = new SettingsWritePipeline(this.pluginDataStore, this.viewsRefresh, this.notices);
		this.persistenceServices = new PersistenceServices(
			this.docIdService,
			this.pluginDataStore,
			this.perDocStore,
			this.pathDocIdMap,
		);
		this.docIdMapWarmer = new DocIdMapWarmer(this.app.vault, this.docIdService, this.pathDocIdMap);
		// Reads the configured field list FRESH on each build, so a settings change is
		// honoured on the next build without a bespoke settings subscription.
		this.frontmatterIdIndex = new FrontmatterIdIndex(
			this.app.vault,
			this.app.metadataCache,
			() => this.pluginDataStore.frontmatterLinks().idRefFields,
		);
		// Path-only folder-note index; carries no settings, so it needs no accessor.
		this.folderNoteIndex = new FolderNoteIndex(this.app.vault);
		this.namedRelationsIndex = new NamedRelationshipsIndex(this.app.vault, this.app.metadataCache);
		// Kick the initial vault scan off now (bounded concurrency, absorbed failure —
		// a failed scan retries on the next build's await) without delaying onload.
		this.namedRelationsIndex.startEagerly();
		// The plugin's ONE vault-WRITE seam (create-child-note); its folderExists half is
		// also the read the builder's chip predicate needs.
		this.noteCreation = new ObsidianNoteCreation(this.app.vault);
		this.graphBuilder = new VicinityGraphBuilder(
			this.app.vault,
			this.app.metadataCache,
			this.docIdService,
			this.canvasParseCache,
			this.pluginDataStore,
			this.perDocStore,
			this.pathDocIdMap,
			this.docIdMapWarmer,
			this.frontmatterIdIndex,
			this.folderNoteIndex,
			this.namedRelationsIndex,
			this.noteCreation,
		);

		this.registerVaultLifecycleHandlers();
		this.scheduleOrphanSweep();
		this.addSettingTab(new VicinityGraphSettingTab(this.app, this));

		// Shares the plugin-lived canvas parse cache with the builder, so a modal
		// opened right after a rebuild re-parses nothing.
		const occurrenceProvider = new LiveLinkOccurrenceProvider(
			this.app.vault,
			this.app.metadataCache,
			this.canvasParseCache,
			this.frontmatterIdIndex,
			this.folderNoteIndex,
			this.namedRelationsIndex,
		);
		this.registerView(
			VIEW_TYPE_VICINITY_GRAPH,
			(leaf) =>
				new VicinityGraphView(
					leaf,
					this.graphBuilder,
					this.persistenceServices,
					this.viewsRefresh,
					this.settingsWrites,
					this.notices,
					occurrenceProvider,
					this.folderNoteIndex,
					this.noteCreation,
				),
		);
		// Two placements, two hotkey-bindable commands (mirrors core's "Split
		// right"/"Split down"); the opener MOVES a graph that is open elsewhere.
		const opener = new GraphViewOpener(this.app.workspace);
		this.addCommand({
			id: "open-right-sidebar",
			name: "Open in right sidebar",
			callback: () => void opener.open("right-sidebar"),
		});
		this.addCommand({
			id: "open-below",
			name: "Open below active note",
			callback: () => void opener.open("main-area"),
		});
	}

	/**
	 * Re-render every open graph view after a global-settings write (step-06
	 * Q-C). Obsidian-idiomatic fan-out: iterate the plugin's leaves and ask each
	 * view to rebuild from the fresh globals. No bespoke event emitter.
	 *
	 * PRIVATE on purpose: {@link viewsRefresh} is the ONE way to reach the fan-out,
	 * so "which views does a write refresh" is answered in one place. The settings
	 * tab used to call this directly, which is how a second fan-out rule could have
	 * grown next to the port's.
	 *
	 * `private` is a COMPILE-time lock only, and the e2e harness deliberately reaches
	 * it by NAME at runtime (`e2e/obsidianHarness.ts` → `refreshOpenViews()`, through an
	 * `any` cast, so `check:e2e` cannot catch a rename). Keep the name, and keep it a
	 * method — a `#private` field would break that harness with no compiler warning.
	 */
	private refreshOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH)) {
			const { view } = leaf;
			if (view instanceof VicinityGraphView) {
				view.refresh();
			}
		}
	}

	onunload(): void {
		if (this.sweepTimer !== null) {
			window.clearTimeout(this.sweepTimer);
		}
	}

	private registerVaultLifecycleHandlers(): void {
		// The frontmatter-id index is a cache-derived reverse index: any metadata
		// change (an edited `id:` or configured field, a new/removed note) can move an
		// id-ref edge, so invalidate on `changed` and let the next graph build rebuild.
		// Empty configured field list ⇒ the rebuild is a no-op (inert index).
		this.registerEvent(
			this.app.metadataCache.on("changed", (file, data) => {
				this.frontmatterIdIndex.markStale();
				// The 'changed' callback hands the file's CONTENT — the named-relationships
				// index re-parses from it directly, zero extra reads.
				this.namedRelationsIndex.handleFileChanged(file.path, data);
			}),
		);
		// The folder-note index is derived from the vault's PATH SET, so it invalidates
		// on the path events (create/delete/rename) — never on `changed`, since a body
		// edit cannot move a path-chosen folder note. A newly created file can BECOME a
		// folder note (or a child of one), so a create alone must rebuild it.
		this.registerEvent(this.app.vault.on("create", () => this.folderNoteIndex.markStale()));
		// Renames are a persistence non-event (docid-keyed); only the map moves.
		// Cache eviction is unconditional — non-canvas paths are no-ops.
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.pathDocIdMap.handleRename(oldPath, file.path);
				this.canvasParseCache.evict(oldPath);
				// A renamed note keeps its id but changes path — the reverse index maps by
				// path, so it must rebuild.
				this.frontmatterIdIndex.markStale();
				// A rename of the folder note OR of the folder re-resolves the hierarchy —
				// both are path moves the path-derived index must pick up.
				this.folderNoteIndex.markStale();
				// Statements are content-derived: a rename only REKEYS the entry.
				this.namedRelationsIndex.handleFileRenamed(oldPath, file.path);
			}),
		);
		// Caught, not rethrown: the handler now spans vault file I/O (the per-file
		// store), whose failure would otherwise surface as an unhandled rejection.
		// The delayed orphan sweep re-derives and retries any prune that failed here.
		this.registerEvent(
			this.app.vault.on("delete", (file) =>
				void this.handleVaultDelete(file.path).catch((error: unknown) => {
					console.error("vicinity-graph: delete cleanup failed", error);
				}),
			),
		);
	}

	/**
	 * Live cleanup for mapped docs — drops the doc from BOTH storage tiers at once
	 * ({@link PluginDataStore.forgetDocs} for the global pinned set,
	 * {@link PerDocStore.forgetDocs} for the per-file record + its localPins-target
	 * positions): the ONE conceptual choke point a delete spans, mirrored by the
	 * orphan sweep. A docid-keyed map added to EITHER store is pruned by that store's
	 * `forgetDocs`; a map added to a NEW store would need its `forgetDocs` wired in
	 * here too. Unmapped paths — and docids the map saw at more than one live path
	 * (a frontmatter-duplicate twin may survive) — are the delayed sweep's job (backstop).
	 */
	private async handleVaultDelete(path: string): Promise<void> {
		this.canvasParseCache.evict(path);
		// A deleted note may have owned an id or referenced others — rebuild the index.
		this.frontmatterIdIndex.markStale();
		// A deleted file may have been a folder note (or a folder note's child) — the
		// path-derived hierarchy index must re-resolve without it.
		this.folderNoteIndex.markStale();
		this.namedRelationsIndex.handleFileDeleted(path);
		const docid = this.pathDocIdMap.handleDelete(path);
		if (docid !== undefined) {
			// Both stores together are the ONE choke point a delete spans: the global
			// pinned set (data.json) and the per-file record + its localPins-as-target.
			await this.pluginDataStore.forgetDocs([docid]);
			await this.perDocStore.forgetDocs([docid]);
		}
	}

	private scheduleOrphanSweep(): void {
		const sweeper = new OrphanSweeper(
			this.docIdMapWarmer,
			this.pathDocIdMap,
			this.pluginDataStore,
			this.perDocStore,
		);
		this.sweepTimer = window.setTimeout(
			() =>
				// Errors kept on console.error (background maintenance, no user-facing
				// action to report against); the success path logs nothing per the
				// Obsidian no-console guideline.
				void sweeper.run().catch((error: unknown) => {
					console.error("vicinity-graph: orphan sweep failed", error);
				}),
			SWEEP_DELAY_MS,
		);
	}

}
