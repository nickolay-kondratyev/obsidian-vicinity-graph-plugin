import { Plugin } from "obsidian";
import type { TFile } from "obsidian";
import { DocIdServices } from "obsidian-id-lib";
import type { DocIdService } from "obsidian-id-lib";
import { asVaultPath } from "./engine";
import { BacklinksAdapter } from "./adapters/BacklinksAdapter";
import { CanvasParseCache } from "./adapters/CanvasParseCache";
import { VicinityGraphBuilder } from "./adapters/VicinityGraphBuilder";
import { ObsidianLinkProvider } from "./adapters/ObsidianLinkProvider";
import { OrphanSweeper, SWEEP_DELAY_MS } from "./persistence/OrphanSweeper";
import { PathDocIdMap } from "./persistence/PathDocIdMap";
import { PersistenceServices } from "./persistence/PersistenceServices";
import { PluginDataStore } from "./persistence/PluginDataStore";
import { GraphViewOpener } from "./view/GraphViewOpener";
import { VicinityGraphSettingTab } from "./view/VicinityGraphSettingTab";
import { VicinityGraphView, VIEW_TYPE_VICINITY_GRAPH } from "./view/VicinityGraphView";
import type { ViewsRefreshPort } from "./view/viewPorts";

// manifest.json minAppVersion WHY: 1.12.4 is the first PUBLIC Obsidian release where
// canvas backlinks are core-indexed (resolvedLinks/graph; EA 1.12.0, 2026-02). It is a
// floor, never a ceiling — newer versions must keep working. Canvas
// `metadata.frontmatter` (used by obsidian-id-lib) was NOT introduced by any core
// version; it rides canvas's documented arbitrary-key forward compatibility.

export default class VicinityGraphPlugin extends Plugin {
	/** Doc-scoped persistence entry points (pin / unpin). */
	persistenceServices!: PersistenceServices;
	/** The per-rebuild orchestration for steps 04 (view) and the debug command. */
	graphBuilder!: VicinityGraphBuilder;
	/** Global settings + pinned set (data.json) — step 06 reads/writes globals here. */
	pluginDataStore!: PluginDataStore;

	private docIdService!: DocIdService;
	private readonly pathDocIdMap = new PathDocIdMap();
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

	async onload(): Promise<void> {
		this.docIdService = DocIdServices.createDefault(this.app.vault);
		this.pluginDataStore = new PluginDataStore(this);
		await this.pluginDataStore.init();
		this.persistenceServices = new PersistenceServices(this.docIdService, this.pluginDataStore, this.pathDocIdMap);
		this.graphBuilder = new VicinityGraphBuilder(
			this.app.vault,
			this.app.metadataCache,
			this.docIdService,
			this.canvasParseCache,
			this.pluginDataStore,
			this.pathDocIdMap,
		);

		this.registerVaultLifecycleHandlers();
		this.scheduleOrphanSweep();
		this.addSettingTab(new VicinityGraphSettingTab(this.app, this));

		this.registerView(
			VIEW_TYPE_VICINITY_GRAPH,
			(leaf) =>
				new VicinityGraphView(
					leaf,
					this.graphBuilder,
					this.pluginDataStore,
					this.persistenceServices,
					this.viewsRefresh,
				),
		);
		// Node hover fires `hover-link` (step-05); registering the source lists
		// the graph in the Page-preview core-plugin settings. `defaultMod: false`
		// = previews on plain hover, like Obsidian's own graph view.
		this.registerHoverLinkSource(VIEW_TYPE_VICINITY_GRAPH, {
			display: "Vicinity graph",
			defaultMod: false,
		});

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
	 */
	refreshOpenViews(): void {
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
		this.registerEvent(this.app.vault.on("delete", (file) => void this.handleVaultDelete(file.path)));
	}

	/** Live cleanup for mapped docs; unmapped paths are the delayed sweep's job (backstop). */
	private async handleVaultDelete(path: string): Promise<void> {
		this.canvasParseCache.evict(path);
		const docid = this.pathDocIdMap.handleDelete(path);
		if (docid !== undefined && this.pluginDataStore.hasPin(docid)) {
			await this.pluginDataStore.removePins([docid]);
		}
	}

	private scheduleOrphanSweep(): void {
		const sweeper = new OrphanSweeper(this.app.vault, this.docIdService, this.pathDocIdMap, this.pluginDataStore);
		this.sweepTimer = window.setTimeout(
			() =>
				void sweeper
					.run()
					.then((summary) => {
						console.log(`vicinity-graph: orphan sweep complete pinsRemoved=[${summary.pinsRemoved}]`);
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
	 * the incoming edges that exist ONLY because our canvas fallback parser
	 * produced them. On an install where core indexes canvas, the delta is
	 * empty and both sides agree; that is itself the informative result.
	 */
	private async logBacklinkProvenance(mainFile: TFile): Promise<void> {
		const provider = await ObsidianLinkProvider.create(this.app.vault, this.app.metadataCache, this.canvasParseCache);
		const canvasKeyCount = Object.keys(this.app.metadataCache.resolvedLinks).filter((key) =>
			key.endsWith(".canvas"),
		).length;
		const coreBacklinks = BacklinksAdapter.backlinkSourcePaths(this.app.metadataCache, mainFile);
		const providerIncoming = provider.getIncomingLinks(asVaultPath(mainFile.path));
		const coreSources = new Set<string>(coreBacklinks ?? []);
		const fallbackOnly = providerIncoming.filter((source) => !coreSources.has(source));

		// Per canvas, not per install: a partially-indexed vault has canvases on BOTH
		// sides, and naming the ones we serve is what makes the delta below explainable.
		const fallbackServed = provider.fallbackServedCanvasPaths;
		const capabilityNote =
			fallbackServed.length === 0
				? "Obsidian core indexes every canvas in this vault ⇒ core supplies all canvas edges; our fallback parser stays DORMANT"
				: `core has NOT indexed these ⇒ OUR fallback parser supplies their edges: [${fallbackServed.join(", ")}]`;
		console.log(`vicinity-graph debug: === backlink provenance for main=[${mainFile.path}] ===`);
		console.log(`vicinity-graph debug: fallback-served canvases=[${fallbackServed.length}] (${capabilityNote})`);
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
			`vicinity-graph debug: [OUR fallback only] incoming edges present in ours but NOT from core=[${fallbackOnly.join(", ")}]`,
		);
	}

}
