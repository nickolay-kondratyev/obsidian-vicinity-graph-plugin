import type {
	DepthSettings,
	GraphBuildRequest,
	NodeExclusionSettings,
	PinnedNodeDescriptor,
	ViewSettings,
} from "../engine";
import { asDocId, asVaultPath } from "../engine";
import type { PinnedDocEntry } from "../persistence/persistedShapes";

/** Everything the assembler needs, already loaded (it does no IO itself). */
export interface GraphRequestInputs {
	readonly mainPath: string;
	/** `null` when the main doc has no docid (graph still builds; it just cannot be pinned). */
	readonly mainDocId: string | null;
	readonly pins: readonly PinnedDocEntry[];
	/** docid → current vault path (the in-memory map). `undefined` = unresolvable pin. */
	readonly resolvePinPath: (docid: string) => string | undefined;
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	/** Global node exclusion (vault-wide). Passed straight through to the engine. */
	readonly nodeExclusion: NodeExclusionSettings;
}

/**
 * PURE translation of the docid-keyed pinned set into the PATH-keyed
 * {@link GraphBuildRequest} the engine demands (engine contract: persisted
 * docid-keyed data never crosses the boundary untranslated). Settings need no
 * translation at all — they are global.
 *
 * Judgments encoded here:
 * - a pin whose docid does not resolve to a path is SKIPPED (the delayed
 *   sweep deletes it; before the sweep warms the map it is simply invisible),
 * - a pin pointing at the main doc is skipped (it is already central).
 */
export class GraphRequestAssembler {
	static assemble(inputs: GraphRequestInputs): GraphBuildRequest {
		const pinned = GraphRequestAssembler.pinnedDescriptors(inputs);
		return {
			main: {
				path: asVaultPath(inputs.mainPath),
				...(inputs.mainDocId !== null ? { docid: asDocId(inputs.mainDocId) } : {}),
			},
			...(pinned.length > 0 ? { pinned } : {}),
			globalDepths: inputs.globalDepths,
			globalView: inputs.globalView,
			nodeExclusion: inputs.nodeExclusion,
		};
	}

	private static pinnedDescriptors(inputs: GraphRequestInputs): readonly PinnedNodeDescriptor[] {
		const descriptors: PinnedNodeDescriptor[] = [];
		for (const pin of inputs.pins) {
			const path = inputs.resolvePinPath(pin.docid);
			if (path === undefined || path === inputs.mainPath) {
				continue;
			}
			descriptors.push({
				path: asVaultPath(path),
				docid: asDocId(pin.docid),
				pinTimestamp: pin.pinTimestamp,
			});
		}
		return descriptors;
	}
}
