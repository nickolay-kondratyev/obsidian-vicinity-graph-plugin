import type {
	DepthOverride,
	DepthSettings,
	GraphBuildRequest,
	PinnedNodeDescriptor,
	PinnedViewOverride,
	VaultPath,
	ViewSettings,
} from "../engine";
import { asDocId, asVaultPath } from "../engine";
import type { DocData, PinnedDocEntry } from "../persistence/persistedShapes";

/** Everything the assembler needs, already loaded (it does no IO itself). */
export interface GraphRequestInputs {
	readonly mainPath: string;
	/** `null` when the main doc has no docid (graph still builds, nothing persisted applies). */
	readonly mainDocId: string | null;
	readonly mainDocData: DocData | null;
	readonly pins: readonly PinnedDocEntry[];
	/** docid → current vault path (the in-memory map). `undefined` = unresolvable pin. */
	readonly resolvePinPath: (docid: string) => string | undefined;
	/** Per pinned docid: its loaded doc-data (missing/refused entries may be absent). */
	readonly docDataByDocid: ReadonlyMap<string, DocData>;
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
}

/**
 * PURE translation of docid-keyed persisted state into the PATH-keyed
 * {@link GraphBuildRequest} the engine demands (engine contract: persisted
 * docid-keyed data never crosses the boundary untranslated).
 *
 * Judgments encoded here:
 * - a pin whose docid does not resolve to a path is SKIPPED (the delayed
 *   sweep deletes it; before the sweep warms the map it is simply invisible),
 * - a pin pointing at the main doc is skipped (it is already central),
 * - a pinned root's depth override = its own persisted depths, with the
 *   MAIN doc's `centralDepths[pinDocid]` winning PER-FIELD (what the human
 *   dialed in for that central while THIS doc was main).
 */
export class GraphRequestAssembler {
	static assemble(inputs: GraphRequestInputs): GraphBuildRequest {
		const pinned = GraphRequestAssembler.resolvePins(inputs);
		return {
			main: {
				path: asVaultPath(inputs.mainPath),
				...(inputs.mainDocId !== null ? { docid: asDocId(inputs.mainDocId) } : {}),
			},
			...(pinned.length > 0 ? { pinned } : {}),
			globalDepths: inputs.globalDepths,
			globalView: inputs.globalView,
			...GraphRequestAssembler.depthOverrides(inputs, pinned),
			...(inputs.mainDocData?.view !== undefined ? { mainViewOverride: inputs.mainDocData.view } : {}),
			...GraphRequestAssembler.pinnedViewOverrides(inputs, pinned),
		};
	}

	private static resolvePins(inputs: GraphRequestInputs): PinnedNodeDescriptor[] {
		const pinned: PinnedNodeDescriptor[] = [];
		for (const pin of inputs.pins) {
			const path = inputs.resolvePinPath(pin.docid);
			if (path === undefined || path === inputs.mainPath) {
				continue;
			}
			pinned.push({ path: asVaultPath(path), docid: asDocId(pin.docid), pinTimestamp: pin.pinTimestamp });
		}
		return pinned;
	}

	private static depthOverrides(
		inputs: GraphRequestInputs,
		pinned: readonly PinnedNodeDescriptor[],
	): Pick<GraphBuildRequest, "depthOverridesByRoot"> {
		const byRoot = new Map<VaultPath, DepthOverride>();
		const mainDepths = inputs.mainDocData?.depths;
		if (mainDepths !== undefined) {
			byRoot.set(asVaultPath(inputs.mainPath), mainDepths);
		}
		for (const pin of pinned) {
			const ownDepths = inputs.docDataByDocid.get(pin.docid)?.depths ?? {};
			const mainAdjusted = inputs.mainDocData?.centralDepths?.[pin.docid] ?? {};
			const merged: DepthOverride = { ...ownDepths, ...mainAdjusted };
			if (Object.keys(merged).length > 0) {
				byRoot.set(pin.path, merged);
			}
		}
		return byRoot.size > 0 ? { depthOverridesByRoot: byRoot } : {};
	}

	private static pinnedViewOverrides(
		inputs: GraphRequestInputs,
		pinned: readonly PinnedNodeDescriptor[],
	): Pick<GraphBuildRequest, "pinnedViewOverrides"> {
		const overrides: PinnedViewOverride[] = [];
		for (const pin of pinned) {
			const view = inputs.docDataByDocid.get(pin.docid)?.view;
			if (view !== undefined) {
				overrides.push({ descriptor: pin, override: view });
			}
		}
		return overrides.length > 0 ? { pinnedViewOverrides: overrides } : {};
	}
}
