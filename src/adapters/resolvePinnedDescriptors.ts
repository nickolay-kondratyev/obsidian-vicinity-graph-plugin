import type { DepthOverride, PinnedNodeDescriptor } from "../engine";
import { asDocId, asVaultPath } from "../engine";
import type { DocData, PinnedDocEntry } from "../persistence/persistedShapes";

/**
 * The subset of the assembler inputs the pin-resolution rule needs. Both
 * {@link GraphRequestInputs} and the toolbar's {@link ControlsModelBuilder}
 * pass a value that structurally satisfies this — one shared "skip unresolved /
 * skip main-as-pin" business rule, so the graph and the toolbar central list
 * can NEVER disagree on which pins appear (DRY, step-06 plan §3/§5).
 */
export interface PinnedResolutionInputs {
	readonly mainPath: string;
	readonly mainDocData: DocData | null;
	readonly pins: readonly PinnedDocEntry[];
	readonly resolvePinPath: (docid: string) => string | undefined;
	readonly docDataByDocid: ReadonlyMap<string, DocData>;
}

/**
 * One resolved pinned root, carrying the per-root depth layers so consumers
 * derive the effective depth the SAME way (no parallel `?? ??` chains that can
 * drift):
 * - {@link mergedDepthOverride} `{...own, ...mainAdjusted}` — the override the
 *   engine actually resolves against (feeds `TraversalSettingsResolver`).
 * - {@link mainAdjustedDepthOverride} — ONLY the `MAIN.centralDepths[docid]`
 *   layer, i.e. the layer the toolbar stepper writes; its per-field PRESENCE is
 *   the "pinned vs. inherited" truth (a value can equal global yet be pinned).
 */
export interface ResolvedPinnedRoot {
	readonly descriptor: PinnedNodeDescriptor;
	readonly mergedDepthOverride: DepthOverride;
	readonly mainAdjustedDepthOverride: DepthOverride;
}

/**
 * PURE pin resolution: docid-keyed pins → path-keyed descriptors, skipping pins
 * whose docid does not resolve to a path (cold map / deleted doc) and pins that
 * point at the main doc (already central). The MAIN doc's `centralDepths[docid]`
 * wins per-field over the pin's own persisted depths (what the human dialed in
 * for that central while THIS doc was main).
 */
export class PinnedRootResolver {
	static resolve(inputs: PinnedResolutionInputs): readonly ResolvedPinnedRoot[] {
		const resolved: ResolvedPinnedRoot[] = [];
		for (const pin of inputs.pins) {
			const path = inputs.resolvePinPath(pin.docid);
			if (path === undefined || path === inputs.mainPath) {
				continue;
			}
			const ownDepths = inputs.docDataByDocid.get(pin.docid)?.depths ?? {};
			const mainAdjusted = inputs.mainDocData?.centralDepths?.[pin.docid] ?? {};
			resolved.push({
				descriptor: {
					path: asVaultPath(path),
					docid: asDocId(pin.docid),
					pinTimestamp: pin.pinTimestamp,
				},
				mergedDepthOverride: { ...ownDepths, ...mainAdjusted },
				mainAdjustedDepthOverride: mainAdjusted,
			});
		}
		return resolved;
	}
}
