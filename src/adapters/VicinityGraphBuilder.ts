import { VicinityEngine } from "../engine";
import type { DocIdMapWarmer } from "../persistence/DocIdMapWarmer";
import type { PathDocIdMap } from "../persistence/PathDocIdMap";
import type { PerDocStore } from "../persistence/PerDocStore";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { ControlsModelBuilder } from "../view/ControlsModel";
import type { FlowPinFacts } from "../view/flowMapping";
import type { GraphBuildResult } from "../view/viewPorts";
import type { CanvasParseCache } from "./CanvasParseCache";
import type { FolderNoteIndex } from "./FolderNoteIndex";
import type { FrontmatterIdIndex } from "./FrontmatterIdIndex";
import type { GraphRequestInputs } from "./GraphRequestAssembler";
import { GraphRequestAssembler } from "./GraphRequestAssembler";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";
import type { DocIdPort, MetadataCachePort, NoteCreationPort, VaultPort } from "./obsidianPorts";
import { asVaultPath } from "../engine";

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
		/** The per-doc/per-main facts (overrides, local pins) — warmed lazily on the first build. */
		private readonly perDocStore: PerDocStore,
		private readonly pathDocIdMap: PathDocIdMap,
		/** INJECTED, not built here: the sweep shares this exact instance (one scan discipline, one miss cache). */
		private readonly docIdMapWarmer: DocIdMapWarmer,
		/** Plugin-lived frontmatter-id reverse index for id-ref edges — warmed lazily on the first build. */
		private readonly frontmatterIdIndex: FrontmatterIdIndex,
		/** Plugin-lived folder-note index for the hierarchy channels — warmed lazily on the first build. */
		private readonly folderNoteIndex: FolderNoteIndex,
		/**
		 * The vault-existence half of the create-child-note chip predicate: an owned folder
		 * that is EMPTY is invisible to the path-set {@link FolderNoteIndex}, so its existence
		 * comes from a live `getFolderByPath`-shaped check here (READ-ONLY use of this write seam).
		 */
		private readonly noteCreation: NoteCreationPort,
	) {}

	/** `null` when `mainPath` does not resolve to a vault file. */
	async build(mainPath: string): Promise<GraphBuildResult | null> {
		const mainFile = this.vault.getFileByPath(mainPath);
		if (mainFile === null) {
			return null;
		}
		const provider = await ObsidianLinkProvider.create(
			this.vault,
			this.metadataCache,
			this.canvasParseCache,
			this.frontmatterIdIndex,
			this.folderNoteIndex,
		);
		const mainDocId = this.docIdPort.isEligible(mainFile) ? await this.docIdPort.getDocId(mainFile) : null;
		if (mainDocId !== null) {
			// Lazy map fill on visit (CLARIFICATION planning default) — keeps
			// delete-handling exact for docs seen before the sweep warm-up.
			this.pathDocIdMap.set(mainPath, mainDocId);
		}
		// The per-file records (overrides + local pins) load ONCE, lazily, on the
		// first build after a restart — this is where they enter memory (not at
		// plugin init, and without reading every vault file). Idempotent after that.
		await this.perDocStore.warm();
		const pins = this.pluginDataStore.pins();
		// The active main's local pins are keyed by ITS docid; a main with no docid
		// (unpinnable) can own none, so it gets the empty list.
		const localPins = mainDocId === null ? [] : this.perDocStore.localPins(mainDocId);
		const nodeOverrides = this.perDocStore.nodeOverrides();
		// Cold-map fix (ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e): resolve the
		// docids this build actually needs on demand, so pins and per-node
		// overrides render correctly on the FIRST build after a restart instead
		// of waiting for the delayed sweep warm-up. Best-effort by contract — it
		// never rejects, so a docid it could not resolve is simply skipped
		// downstream, exactly as before the fix. Each STORE names its own
		// docid-keyed docids (the global pinned set + the per-file positions), so a
		// future docid-keyed map is warmed by extending its store, not this call.
		await this.docIdMapWarmer.warmFor([
			...pins.map((pin) => pin.docid),
			...this.perDocStore.keyedDocids(),
		]);
		// ONE inputs object feeds BOTH the graph AND the toolbar model, so the value
		// a control shows is structurally the value the graph used.
		const inputs: GraphRequestInputs = {
			mainPath,
			mainDocId,
			pins,
			localPins,
			nodeOverrides,
			resolveDocPath: (docid) => this.pathDocIdMap.getPath(docid),
			globalDepths: this.pluginDataStore.globalDepths(),
			globalView: this.pluginDataStore.globalView(),
			nodeExclusion: this.pluginDataStore.nodeExclusion(),
			frontmatterLinks: this.pluginDataStore.frontmatterLinks(),
		};
		const graph = new VicinityEngine(provider).build(GraphRequestAssembler.assemble(inputs));
		// The two pin docid sets are derived from the SAME inputs the graph used, so
		// the per-node global/local flags cannot disagree with the merged root list.
		const pinFacts: FlowPinFacts = {
			globalPinnedDocids: new Set(pins.map((pin) => pin.docid)),
			localPinnedDocids: new Set(localPins.map((pin) => pin.docid)),
		};
		// The exclusion COUNT is a graph output (not an input), so it is threaded from
		// the built graph into the toolbar model alongside the shared inputs. The
		// candidate lookup is the SAME warmed index the provider read — the labels'
		// navigation targets come from this build's vault snapshot, not a later one.
		return {
			graph,
			controls: ControlsModelBuilder.build(inputs, graph.excludedNodeCount),
			pinFacts,
			folderNoteCandidates: this.folderNoteIndex,
			// The create-child-note chip predicate: main is a folder note (path-set rule)
			// AND its owned folder EXISTS (live check — an empty owned folder is invisible
			// to the index). Read from the SAME warmed index the provider used this build.
			mainIsFolderNote: this.mainIsFolderNote(mainPath),
		};
	}

	/** Main is a folder note whose owned folder EXISTS in the vault (empty folder counts). */
	private mainIsFolderNote(mainPath: string): boolean {
		const ownedFolder = this.folderNoteIndex.ownedFolderOf(asVaultPath(mainPath));
		return ownedFolder !== undefined && this.noteCreation.folderExists(ownedFolder);
	}
}
