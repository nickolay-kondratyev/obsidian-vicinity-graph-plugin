import { Notice, Plugin } from "obsidian";
import type { TFile } from "obsidian";
import { DocIdServices } from "obsidian-id-lib";
import type { DocIdService } from "obsidian-id-lib";
import { asVaultPath } from "./engine";
import { BacklinksAdapter } from "./adapters/BacklinksAdapter";
import { CanvasParseCache } from "./adapters/CanvasParseCache";
import { LiveLinkOccurrenceProvider } from "./adapters/LiveLinkOccurrenceProvider";
import { VicinityGraphBuilder } from "./adapters/VicinityGraphBuilder";
import { ObsidianLinkProvider } from "./adapters/ObsidianLinkProvider";
import { DocIdMapWarmer } from "./persistence/DocIdMapWarmer";
import { OrphanSweeper, SWEEP_DELAY_MS } from "./persistence/OrphanSweeper";
import { PathDocIdMap } from "./persistence/PathDocIdMap";
import { PerDocStore } from "./persistence/PerDocStore";
import { PersistenceServices } from "./persistence/PersistenceServices";
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
// `metadata.frontmatter` (used by obsidian-id-lib) was NOT introduced by any core
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
	/** The per-rebuild orchestration for steps 04 (view) and the debug command. */
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
		this.pluginDataStore = new PluginDataStore(this, this.notices);
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
		this.graphBuilder = new VicinityGraphBuilder(
			this.app.vault,
			this.app.metadataCache,
			this.docIdService,
			this.canvasParseCache,
			this.pluginDataStore,
			this.perDocStore,
			this.pathDocIdMap,
			this.docIdMapWarmer,
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
				),
		);
		// Two placements, two hotkey-bindable commands (mirrors core's "Split
		// right"/"Split down"); the opener MOVES a graph that is open elsewhere.
		const opener = new GraphViewOpener(this.app.workspace);
		this.addCommand({
			id: "open-vicinity-graph",
			name: "Open vicinity graph in right sidebar",
			callback: () => void opener.open("right-sidebar"),
		});
		this.addCommand({
			id: "open-vicinity-graph-below",
			name: "Open vicinity graph below active note",
			callback: () => void opener.open("main-area"),
		});
		this.addCommand({
			id: "debug-log-vicinity-graph",
			name: "Debug: log vicinity graph for active file",
			callback: () => void this.logVicinityGraph(),
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
		// Renames are a persistence non-event (docid-keyed); only the map moves.
		// Cache eviction is unconditional — non-canvas paths are no-ops.
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.pathDocIdMap.handleRename(oldPath, file.path);
				this.canvasParseCache.evict(oldPath);
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
	 * here too. Unmapped paths are the delayed sweep's job (backstop).
	 */
	private async handleVaultDelete(path: string): Promise<void> {
		this.canvasParseCache.evict(path);
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
				void sweeper
					.run()
					.then((summary) => {
						console.log(
							`vicinity-graph: orphan sweep complete pinsRemoved=[${summary.pinsRemoved}] overridesRemoved=[${summary.overridesRemoved}] localPinsRemoved=[${summary.localPinsRemoved}] everyFileRead=[${summary.everyFileRead}]`,
						);
					})
					.catch((error: unknown) => {
						console.error("vicinity-graph: orphan sweep failed", error);
					}),
			SWEEP_DELAY_MS,
		);
	}

	/** Step-03 exit-criterion harness: proves a real vault renders through ObsidianLinkProvider. */
	private async logVicinityGraph(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile === null) {
			console.log("vicinity-graph debug: no active file");
			return;
		}
		const result = await this.graphBuilder.build(activeFile.path);
		if (result === null) {
			console.log("vicinity-graph debug: active file did not resolve", activeFile.path);
			return;
		}
		const { graph } = result;
		const hiddenNodeCount = [...graph.hiddenNodeCountsByFolder.values()].reduce((sum, count) => sum + count, 0);
		console.log(
			`vicinity-graph debug: main=[${activeFile.path}] nodes=[${graph.nodes.length}] edges=[${graph.edges.length}] hiddenByTruncation=[${hiddenNodeCount}]`,
		);
		// The tables below are OUR output: engine nodes/edges built through
		// ObsidianLinkProvider (markdown links from the metadata cache + canvas
		// edges from our fallback parser when core does not index .canvas).
		console.log("vicinity-graph debug: [OUR engine] nodes + edges (canvas edges included via our fallback parser):");
		console.table(
			graph.nodes.map((node) => ({
				path: node.path,
				central: node.isCentral,
				main: node.isMain,
				minDepth: node.minDepth,
				sizePx: node.sizePx,
				attachments: node.attachments.length,
				firstImage: node.firstImagePath ?? "",
			})),
		);
		console.table(graph.edges.map((edge) => ({ source: edge.source, target: edge.target })));
		await this.logBacklinkProvenance(activeFile);
	}

	/**
	 * Makes the "who supplies which backlink" question unambiguous for manual
	 * QA: it queries Obsidian core DIRECTLY (raw `getBacklinksForFile` +
	 * `resolvedLinks`) and OUR provider side by side, then names the delta —
	 * the incoming edges that exist ONLY because our canvas parser produced them.
	 * On an install where core indexes canvas, the delta is empty and both sides
	 * agree; that is itself the informative result.
	 */
	private async logBacklinkProvenance(mainFile: TFile): Promise<void> {
		const provider = await ObsidianLinkProvider.create(this.app.vault, this.app.metadataCache, this.canvasParseCache);
		const canvasKeyCount = Object.keys(this.app.metadataCache.resolvedLinks).filter((key) =>
			key.endsWith(".canvas"),
		).length;
		const coreBacklinks = BacklinksAdapter.backlinkSourcePaths(this.app.metadataCache, mainFile);
		const providerIncoming = provider.getIncomingLinks(asVaultPath(mainFile.path));
		const coreSources = new Set<string>(coreBacklinks ?? []);
		const parserOnly = providerIncoming.filter((source) => !coreSources.has(source));

		// Naming the canvases we parsed is what makes the delta below explainable: every
		// canvas edge comes from OUR parser, whether or not core also indexed it.
		const parsedCanvases = provider.parsedCanvasPaths;
		console.log(`vicinity-graph debug: === backlink provenance for main=[${mainFile.path}] ===`);
		console.log(
			`vicinity-graph debug: parsed canvases=[${parsedCanvases.length}] (OUR parser supplies every canvas edge, core's index is not consulted): [${parsedCanvases.join(", ")}]`,
		);
		console.log(
			`vicinity-graph debug: [OBSIDIAN core] resolvedLinks .canvas-key count=[${canvasKeyCount}] ⇒ core canvas backlinks on this install=[${canvasKeyCount > 0 ? "YES" : "NO"}]`,
		);
		console.log(
			coreBacklinks === null
				? "vicinity-graph debug: [OBSIDIAN core] getBacklinksForFile(main)=[UNAVAILABLE — undocumented API absent; provider falls back to resolvedLinks inversion]"
				: `vicinity-graph debug: [OBSIDIAN core] getBacklinksForFile(main) sources=[${coreBacklinks.join(", ")}]`,
		);
		console.log(`vicinity-graph debug: [OUR provider] getIncomingLinks(main)=[${providerIncoming.join(", ")}]`);
		console.log(
			`vicinity-graph debug: [OUR parser only] incoming edges present in ours but NOT from core=[${parserOnly.join(", ")}]`,
		);
	}

}
