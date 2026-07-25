import type { ForceLayoutSettings } from "../engine";

/**
 * SHARED display copy for the force-layout tuning fields — the single source of
 * truth for labels and descriptions used by BOTH write surfaces (the settings
 * tab and the in-graph controls panel), so the copy can never drift between
 * them (DRY). The numeric bounds live separately in the engine's
 * `FORCE_LAYOUT_RANGES`; this table is view-layer because it is pure UI copy.
 */
export interface ForceLayoutFieldMeta {
	readonly label: string;
	readonly description: string;
}

/** Compile-time exhaustive: adding a `ForceLayoutSettings` field without copy is a type error. */
export const FORCE_LAYOUT_FIELD_META: Readonly<Record<keyof ForceLayoutSettings, ForceLayoutFieldMeta>> = {
	centerPullStrength: {
		label: "Center force",
		description: "Pull of every node toward the graph centre. Keeps loosely-linked notes from drifting away.",
	},
	repelStrength: {
		label: "Repel force",
		description: "How strongly nodes and folder groups push each other apart.",
	},
	linkStrengthFactor: {
		label: "Link force",
		description: "Stiffness of the springs that pull linked notes together. 1 is the built-in default.",
	},
	linkGapPx: {
		label: "Link distance",
		description: "Extra resting distance (px) a link keeps between the two linked boxes.",
	},
	collidePaddingPx: {
		label: "Node spacing",
		description: "Minimum gap (px) enforced between any two boxes at the top level of the graph.",
	},
	elkNodeSpacingPx: {
		label: "Group member spacing",
		description: "Gap (px) between the notes inside a folder group (also spaces the initial layout pass).",
	},
	edgeRoutingClearancePx: {
		label: "Edge clearance",
		description: "How far (px) a routed edge stays clear of the boxes it passes on its way.",
	},
};

/**
 * Presentation order: the four "native-parity" sliders shown up front (same
 * names as Obsidian's native graph view — POLS), then the px fine-tuning knobs
 * tucked behind an "Advanced spacing" collapsible on both surfaces. "Edge
 * clearance" belongs in the advanced group (edge-routing__06 decision D4)
 * precisely because it has no native-graph analogue to be familiar from.
 */
export const FORCE_LAYOUT_MAIN_FIELDS = [
	"centerPullStrength",
	"repelStrength",
	"linkStrengthFactor",
	"linkGapPx",
] as const satisfies readonly (keyof ForceLayoutSettings)[];

export const FORCE_LAYOUT_ADVANCED_FIELDS = [
	"collidePaddingPx",
	"elkNodeSpacingPx",
	"edgeRoutingClearancePx",
] as const satisfies readonly (keyof ForceLayoutSettings)[];

/**
 * Compile-time completeness of the main/advanced PARTITION: a field missing
 * from both groups surfaces here as a type error naming the missing key.
 * (Disjointness — no field in both groups — is covered by the unit test.)
 */
type GroupedField = (typeof FORCE_LAYOUT_MAIN_FIELDS)[number] | (typeof FORCE_LAYOUT_ADVANCED_FIELDS)[number];
type UngroupedField = Exclude<keyof ForceLayoutSettings, GroupedField>;
export const _assertEveryForceLayoutFieldGrouped: UngroupedField extends never ? true : UngroupedField = true;
