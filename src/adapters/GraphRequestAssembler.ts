import type {
	DepthOverride,
	DepthSettings,
	GraphBuildRequest,
	NodeExclusionSettings,
	PinnedNodeDescriptor,
	PinnedViewOverride,
	VaultPath,
	ViewSettings,
} from "../engine";
import { asDocId, asVaultPath } from "../engine";
import type { DocData, PinnedDocEntry } from "../persistence/persistedShapes";
import type { ResolvedPinnedRoot } from "./resolvePinnedDescriptors";
import { PinnedRootResolver } from "./resolvePinnedDescriptors";

/** Everything the assembler needs, already loaded (it does no IO itself). */
export interface GraphRequestInputs {
	readonly mainPath: string;
	/** `null` when the main doc has no docid (graph still builds, nothing persisted applies). */
	readonly mainDocId: string | null;
	/**
	 * Whether MAIN's docid can back a `doc-data/<docid>.json` file — the same
	 * gate the builder loads {@link mainDocData} through (`mainDocId !== null &&
	 * isFilenameSafeDocId`). An unsafe-foreign-docid MAIN has a non-null docid
	 * but is NOT persistable; the toolbar disables its steppers off this flag.
	 */
	readonly mainPersistable: boolean;
	readonly mainDocData: DocData | null;
	readonly pins: readonly PinnedDocEntry[];
	/** docid → current vault path (the in-memory map). `undefined` = unresolvable pin. */
	readonly resolvePinPath: (docid: string) => string | undefined;
	/** Per pinned docid: its loaded doc-data (missing/refused entries may be absent). */
	readonly docDataByDocid: ReadonlyMap<string, DocData>;
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	/** Global node exclusion (vault-wide). Passed straight through to the engine. */
	readonly nodeExclusion: NodeExclusionSettings;
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
		const resolved = PinnedRootResolver.resolve(inputs);
		const pinned = resolved.map((root) => root.descriptor);
		return {
			main: {
				path: asVaultPath(inputs.mainPath),
				...(inputs.mainDocId !== null ? { docid: asDocId(inputs.mainDocId) } : {}),
			},
			...(pinned.length > 0 ? { pinned } : {}),
			globalDepths: inputs.globalDepths,
			globalView: inputs.globalView,
			nodeExclusion: inputs.nodeExclusion,
			...GraphRequestAssembler.depthOverrides(inputs, resolved),
			...(inputs.mainDocData?.view !== undefined ? { mainViewOverride: inputs.mainDocData.view } : {}),
			...GraphRequestAssembler.pinnedViewOverrides(inputs, resolved),
		};
	}

	private static depthOverrides(
		inputs: GraphRequestInputs,
		resolved: readonly ResolvedPinnedRoot[],
	): Pick<GraphBuildRequest, "depthOverridesByRoot"> {
		const byRoot = new Map<VaultPath, DepthOverride>();
		const mainDepths = inputs.mainDocData?.depths;
		if (mainDepths !== undefined) {
			byRoot.set(asVaultPath(inputs.mainPath), mainDepths);
		}
		for (const root of resolved) {
			if (Object.keys(root.mergedDepthOverride).length > 0) {
				byRoot.set(root.descriptor.path, root.mergedDepthOverride);
			}
		}
		return byRoot.size > 0 ? { depthOverridesByRoot: byRoot } : {};
	}

	private static pinnedViewOverrides(
		inputs: GraphRequestInputs,
		resolved: readonly ResolvedPinnedRoot[],
	): Pick<GraphBuildRequest, "pinnedViewOverrides"> {
		const overrides: PinnedViewOverride[] = [];
		for (const root of resolved) {
			const view = inputs.docDataByDocid.get(root.descriptor.docid)?.view;
			if (view !== undefined) {
				overrides.push({ descriptor: root.descriptor, override: view });
			}
		}
		return overrides.length > 0 ? { pinnedViewOverrides: overrides } : {};
	}
}
