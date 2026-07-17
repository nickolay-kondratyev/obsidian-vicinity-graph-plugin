import { Plugin, WorkspaceLeaf } from "obsidian";
import { DocIdServices } from "obsidian-id-lib";
import type { DocIdService } from "obsidian-id-lib";
import { CanvasParseCache } from "./adapters/CanvasParseCache";
import { NeighborhoodGraphBuilder } from "./adapters/NeighborhoodGraphBuilder";
import { DocDataStore } from "./persistence/DocDataStore";
import { DocPersistEligibility } from "./persistence/DocPersistEligibility";
import { OrphanSweeper, SWEEP_DELAY_MS } from "./persistence/OrphanSweeper";
import { PathDocIdMap } from "./persistence/PathDocIdMap";
import { PersistenceServices } from "./persistence/PersistenceServices";
import { PluginDataStore } from "./persistence/PluginDataStore";
import { NeighborhoodGraphView, VIEW_TYPE_NEIGHBORHOOD_GRAPH } from "./view/NeighborhoodGraphView";

// manifest.json minAppVersion WHY: 1.12.4 is the first PUBLIC Obsidian release where
// canvas backlinks are core-indexed (resolvedLinks/graph; EA 1.12.0, 2026-02). It is a
// floor, never a ceiling — newer versions must keep working. Canvas
// `metadata.frontmatter` (used by obsidian-id-lib) was NOT introduced by any core
// version; it rides canvas's documented arbitrary-key forward compatibility.

export default class NeighborhoodGraphPlugin extends Plugin {
	/** Doc-scoped persistence entry points for steps 04/06 (pin, per-doc settings). */
	persistenceServices!: PersistenceServices;
	/** The per-rebuild orchestration for steps 04 (view) and the debug command. */
	graphBuilder!: NeighborhoodGraphBuilder;
	/** Global settings + pinned set (data.json) — step 06 reads/writes globals here. */
	pluginDataStore!: PluginDataStore;

	private docIdService!: DocIdService;
	private docDataStore!: DocDataStore;
	private readonly pathDocIdMap = new PathDocIdMap();
	/** Plugin-lived on purpose: canvas parses survive across graph rebuilds (mtime-keyed). */
	private readonly canvasParseCache = new CanvasParseCache();
	private sweepTimer: number | null = null;

	async onload(): Promise<void> {
		this.docIdService = DocIdServices.createDefault(this.app.vault);
		this.pluginDataStore = new PluginDataStore(this);
		await this.pluginDataStore.init();
		this.docDataStore = new DocDataStore(this.app.vault.adapter, this.docDataDirPath());
		this.persistenceServices = new PersistenceServices(
			this.docIdService,
			this.pluginDataStore,
			this.docDataStore,
			this.pathDocIdMap,
		);
		this.graphBuilder = new NeighborhoodGraphBuilder(
			this.app.vault,
			this.app.metadataCache,
			this.docIdService,
			this.canvasParseCache,
			this.pluginDataStore,
			this.docDataStore,
			this.pathDocIdMap,
		);

		this.registerVaultLifecycleHandlers();
		this.scheduleOrphanSweep();

		this.registerView(VIEW_TYPE_NEIGHBORHOOD_GRAPH, (leaf) => new NeighborhoodGraphView(leaf));

		this.addCommand({
			id: "open-neighborhood-graph",
			name: "Open neighborhood graph",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "debug-log-neighborhood-graph",
			name: "Debug: log neighborhood graph for active file",
			callback: () => void this.logNeighborhoodGraph(),
		});
	}

	onunload(): void {
		if (this.sweepTimer !== null) {
			window.clearTimeout(this.sweepTimer);
		}
	}

	/** `.obsidian/plugins/<id>/doc-data` — the per-doc `<docid>.json` folder. */
	private docDataDirPath(): string {
		const pluginDir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		return `${pluginDir}/doc-data`;
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
		if (docid === undefined) {
			return;
		}
		if (this.pluginDataStore.hasPin(docid)) {
			await this.pluginDataStore.removePins([docid]);
		}
		if (DocPersistEligibility.isFilenameSafeDocId(docid)) {
			await this.docDataStore.remove(docid);
		}
	}

	private scheduleOrphanSweep(): void {
		const sweeper = new OrphanSweeper(
			this.app.vault,
			this.docIdService,
			this.pathDocIdMap,
			this.pluginDataStore,
			this.docDataStore,
		);
		this.sweepTimer = window.setTimeout(
			() =>
				void sweeper.run().catch((error: unknown) => {
					console.error("neighborhood-graph: orphan sweep failed", error);
				}),
			SWEEP_DELAY_MS,
		);
	}

	/** Step-03 exit-criterion harness: proves a real vault renders through ObsidianLinkProvider. */
	private async logNeighborhoodGraph(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile === null) {
			console.log("neighborhood-graph debug: no active file");
			return;
		}
		const graph = await this.graphBuilder.build(activeFile.path);
		if (graph === null) {
			console.log("neighborhood-graph debug: active file did not resolve", activeFile.path);
			return;
		}
		const hiddenNodeCount = [...graph.hiddenNodeCountsByFolder.values()].reduce((sum, count) => sum + count, 0);
		console.log(
			`neighborhood-graph debug: main=[${activeFile.path}] nodes=[${graph.nodes.length}] edges=[${graph.edges.length}] hiddenByTruncation=[${hiddenNodeCount}]`,
		);
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
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		const leaf: WorkspaceLeaf | null =
			workspace.getLeavesOfType(VIEW_TYPE_NEIGHBORHOOD_GRAPH)[0] ?? workspace.getRightLeaf(false);
		if (leaf === null) {
			return;
		}
		await leaf.setViewState({ type: VIEW_TYPE_NEIGHBORHOOD_GRAPH, active: true });
		await workspace.revealLeaf(leaf);
	}
}
