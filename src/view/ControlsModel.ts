import type { DepthOverride, DepthSettings, Direction, ViewSettings } from "../engine";
import { DIRECTION_DEPTH_FIELD, TraversalSettingsResolver } from "../engine";
import type { GraphRequestInputs } from "../adapters/GraphRequestAssembler";
import { PinnedRootResolver } from "../adapters/resolvePinnedDescriptors";
import { VaultPathFacts } from "../shared/VaultPathFacts";

/**
 * The toolbar's read-model (step-06 #3 + #4). Built PURE over the SAME
 * {@link GraphRequestInputs} the graph is assembled from — one disk read, no
 * race, no engine change — so the value shown next to each stepper is
 * STRUCTURALLY the value the graph used (both flow through
 * {@link TraversalSettingsResolver}), while `pinned` is a SEPARATE presence
 * check on the layer THIS control writes (a value can equal global yet be
 * pinned — pin-on-toggle).
 */

/** One direction's resolved depth for one central, plus whether it is pinned. */
export interface DirectionDepth {
	/** Fully-resolved depth — exactly what the graph used. */
	readonly value: number;
	/** Presence in THIS control's own override layer (NOT a value diff vs. global). */
	readonly pinned: boolean;
}

export interface CentralControl {
	readonly kind: "main" | "pinned";
	readonly path: string;
	/** Basename without extension (display title). */
	readonly title: string;
	/** Present for pinned centrals, and for MAIN when persistable. Used for unpin / writes. */
	readonly docid?: string;
	/**
	 * Whether depth edits on this row can be persisted. Every depth write lands
	 * on the MAIN file (own depths → `setDocDepthField`; a pinned central's
	 * depth → MAIN's `centralDepths`), so this mirrors MAIN's persistability
	 * gate: an unsafe/absent MAIN docid disables the steppers consistently.
	 */
	readonly persistable: boolean;
	readonly outgoing: DirectionDepth;
	readonly incoming: DirectionDepth;
}

export interface ControlsModel {
	/** MAIN first, then pinned centrals in assembler (pin) order. */
	readonly centrals: readonly CentralControl[];
	/**
	 * The current global defaults, carried on the model so the toolbar has the
	 * `planSettingsWrite` context (`{globalDepths, globalView}` merge base) AND the
	 * seed values for the sizing form WITHOUT re-reading disk or duplicating global
	 * state in React — the builder already loaded them, so this is the single source.
	 */
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
}

export class ControlsModelBuilder {
	static build(inputs: GraphRequestInputs): ControlsModel {
		const centrals: CentralControl[] = [ControlsModelBuilder.mainControl(inputs)];
		for (const root of PinnedRootResolver.resolve(inputs)) {
			centrals.push({
				kind: "pinned",
				path: root.descriptor.path,
				title: VaultPathFacts.titleOf(root.descriptor.path),
				docid: root.descriptor.docid,
				persistable: inputs.mainPersistable,
				outgoing: ControlsModelBuilder.directionDepth(
					inputs.globalDepths,
					root.mergedDepthOverride,
					root.mainAdjustedDepthOverride,
					"outgoing",
				),
				incoming: ControlsModelBuilder.directionDepth(
					inputs.globalDepths,
					root.mergedDepthOverride,
					root.mainAdjustedDepthOverride,
					"incoming",
				),
			});
		}
		return { centrals, globalDepths: inputs.globalDepths, globalView: inputs.globalView };
	}

	private static mainControl(inputs: GraphRequestInputs): CentralControl {
		const ownDepths = inputs.mainDocData?.depths ?? {};
		return {
			kind: "main",
			path: inputs.mainPath,
			title: VaultPathFacts.titleOf(inputs.mainPath),
			...(inputs.mainPersistable && inputs.mainDocId !== null ? { docid: inputs.mainDocId } : {}),
			persistable: inputs.mainPersistable,
			outgoing: ControlsModelBuilder.directionDepth(inputs.globalDepths, ownDepths, ownDepths, "outgoing"),
			incoming: ControlsModelBuilder.directionDepth(inputs.globalDepths, ownDepths, ownDepths, "incoming"),
		};
	}

	/**
	 * `value` from the effective (merged) override so it matches the graph;
	 * `pinned` from the OWNED layer's per-field presence (the layer reset
	 * clears). For MAIN both layers are its own depths; for a pinned central the
	 * owned layer is only `MAIN.centralDepths[docid]`.
	 */
	private static directionDepth(
		global: DepthSettings,
		effectiveOverride: DepthOverride,
		ownedOverride: DepthOverride,
		direction: Direction,
	): DirectionDepth {
		const field = DIRECTION_DEPTH_FIELD[direction];
		return {
			value: TraversalSettingsResolver.resolveForRoot(global, effectiveOverride)[field],
			pinned: ownedOverride[field] !== undefined,
		};
	}
}
