import { VicinityEngine } from "../engine";
import type { PathDocIdMap } from "../persistence/PathDocIdMap";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { ControlsModelBuilder } from "../view/ControlsModel";
import type { GraphBuildResult } from "../view/viewPorts";
import type { CanvasParseCache } from "./CanvasParseCache";
import type { GraphRequestInputs } from "./GraphRequestAssembler";
import { GraphRequestAssembler } from "./GraphRequestAssembler";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";
import type { DocIdPort, MetadataCachePort, VaultPort } from "./obsidianPorts";

/**
 * The one async orchestration per rebuild: live Obsidian state → provider,
 * global settings + the docid-keyed pinned set and per-node overrides →
 * path-keyed request ({@link GraphRequestAssembler}) → pure engine build.
 *
 * Identity discipline: this is a READ path — `getDocId` only, never
 * `ensureDocId` (id-lib contract). A main doc without a docid still gets a full
 * graph; it just cannot be pinned.
 */
export class VicinityGraphBuilder {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		private readonly docIdPort: DocIdPort,
		private readonly canvasParseCache: CanvasParseCache,
		private readonly pluginDataStore: PluginDataStore,
		private readonly pathDocIdMap: PathDocIdMap,
	) {}

	/** `null` when `mainPath` does not resolve to a vault file. */
	async build(mainPath: string): Promise<GraphBuildResult | null> {
		const mainFile = this.vault.getFileByPath(mainPath);
		if (mainFile === null) {
			return null;
		}
		const provider = await ObsidianLinkProvider.create(this.vault, this.metadataCache, this.canvasParseCache);
		const mainDocId = this.docIdPort.isEligible(mainFile) ? await this.docIdPort.getDocId(mainFile) : null;
		if (mainDocId !== null) {
			// Lazy map fill on visit (CLARIFICATION planning default) — keeps
			// delete-handling exact for docs seen before the sweep warm-up.
			this.pathDocIdMap.set(mainPath, mainDocId);
		}
		// ONE inputs object feeds BOTH the graph AND the toolbar model, so the value
		// a control shows is structurally the value the graph used.
		const inputs: GraphRequestInputs = {
			mainPath,
			mainDocId,
			pins: this.pluginDataStore.pins(),
			nodeOverrides: this.pluginDataStore.nodeOverrides(),
			resolveDocPath: (docid) => this.pathDocIdMap.getPath(docid),
			globalDepths: this.pluginDataStore.globalDepths(),
			globalView: this.pluginDataStore.globalView(),
			nodeExclusion: this.pluginDataStore.nodeExclusion(),
		};
		const graph = new VicinityEngine(provider).build(GraphRequestAssembler.assemble(inputs));
		// The exclusion COUNT is a graph output (not an input), so it is threaded from
		// the built graph into the toolbar model alongside the shared inputs.
		return { graph, controls: ControlsModelBuilder.build(inputs, graph.excludedNodeCount) };
	}
}
