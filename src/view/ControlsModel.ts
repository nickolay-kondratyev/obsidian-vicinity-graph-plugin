import type { DepthSettings, FrontmatterLinkSettings, NodeExclusionSettings, ViewSettings } from "../engine";
import type { GraphRequestInputs } from "../adapters/GraphRequestAssembler";

/**
 * The controls panel's read-model, built PURE over the SAME
 * {@link GraphRequestInputs} the graph is assembled from — one read, no race —
 * so every value a control shows is structurally the value the graph used.
 *
 * Settings are GLOBAL-only, so this is just the global slices plus the two facts
 * the panel cannot derive from them (MAIN's pin state and the build's exclusion
 * count).
 */
export interface ControlsModel {
	/**
	 * Whether the MAIN doc itself is in the persisted pinned set. The assembler
	 * skips main-as-pin (it is already central), so this is the ONLY surviving
	 * carrier of that fact — it drives MAIN's pin/unpin node toggle.
	 */
	readonly mainPinned: boolean;
	/**
	 * The current global settings, carried on the model so the panel has the
	 * `planSettingsWrite` context (the merge base) AND the seed values for every
	 * control WITHOUT re-reading disk or duplicating global state in React — the
	 * builder already loaded them, so this is the single source.
	 */
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	readonly nodeExclusion: NodeExclusionSettings;
	readonly frontmatterLinks: FrontmatterLinkSettings;
	/**
	 * Distinct neighbor paths this build rejected by exclusion (graph telemetry,
	 * not an input). Rendered next to the pill only when exclusion is enabled AND
	 * this is > 0.
	 */
	readonly excludedNodeCount: number;
}

export class ControlsModelBuilder {
	/** `excludedNodeCount` is a graph output threaded in by the builder (0 by default). */
	static build(inputs: GraphRequestInputs, excludedNodeCount = 0): ControlsModel {
		return {
			mainPinned: inputs.mainDocId !== null && inputs.pins.some((pin) => pin.docid === inputs.mainDocId),
			globalDepths: inputs.globalDepths,
			globalView: inputs.globalView,
			nodeExclusion: inputs.nodeExclusion,
			frontmatterLinks: inputs.frontmatterLinks,
			excludedNodeCount,
		};
	}
}
