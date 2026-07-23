import { VicinityEngine } from "../engine";
import type { DocData } from "../persistence/persistedShapes";
import { DocPersistEligibility } from "../persistence/DocPersistEligibility";
import type { DocDataStore } from "../persistence/DocDataStore";
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
 * The one async orchestration per rebuild (debug command now, step-04 view
 * later): live Obsidian state → provider, persisted docid-keyed state →
 * path-keyed request ({@link GraphRequestAssembler}) → pure engine build.
 *
 * Identity discipline: this is a READ path — `getDocId` only, never
 * `ensureDocId` (id-lib contract). A main doc without a docid still gets a
 * full graph; persisted overrides simply cannot apply to it.
 */
export class VicinityGraphBuilder {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		private readonly docIdPort: DocIdPort,
		private readonly canvasParseCache: CanvasParseCache,
		private readonly pluginDataStore: PluginDataStore,
		private readonly docDataStore: DocDataStore,
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
		// Same gate loadDocDataIfPersistable applies — surfaced to the toolbar so
		// an unsafe/absent MAIN docid disables its steppers instead of Notice-ing.
		const mainPersistable = mainDocId !== null && DocPersistEligibility.isFilenameSafeDocId(mainDocId);
		const pins = this.pluginDataStore.pins();
		// ONE loaded inputs object feeds BOTH the graph AND the toolbar model, so
		// the value a stepper shows is structurally the value the graph used.
		const inputs: GraphRequestInputs = {
			mainPath,
			mainDocId,
			mainPersistable,
			mainDocData: await this.loadDocDataIfPersistable(mainDocId),
			pins,
			resolvePinPath: (docid) => this.pathDocIdMap.getPath(docid),
			docDataByDocid: await this.loadPinnedDocData(pins.map((pin) => pin.docid)),
			globalDepths: this.pluginDataStore.globalDepths(),
			globalView: this.pluginDataStore.globalView(),
			nodeExclusion: this.pluginDataStore.nodeExclusion(),
		};
		const graph = new VicinityEngine(provider).build(GraphRequestAssembler.assemble(inputs));
		// The exclusion COUNT is a graph output (not an input), so it is threaded from
		// the built graph into the toolbar model alongside the shared inputs.
		return { graph, controls: ControlsModelBuilder.build(inputs, graph.excludedNodeCount) };
	}

	private async loadPinnedDocData(pinnedDocids: readonly string[]): Promise<ReadonlyMap<string, DocData>> {
		const docDataByDocid = new Map<string, DocData>();
		for (const docid of pinnedDocids) {
			const docData = await this.loadDocDataIfPersistable(docid);
			if (docData !== null) {
				docDataByDocid.set(docid, docData);
			}
		}
		return docDataByDocid;
	}

	/** Q3 gate: a non-persistable docid (none / unsafe foreign) simply has no doc-data. */
	private async loadDocDataIfPersistable(docid: string | null): Promise<DocData | null> {
		if (docid === null || !DocPersistEligibility.isFilenameSafeDocId(docid)) {
			return null;
		}
		return this.docDataStore.load(docid);
	}
}
