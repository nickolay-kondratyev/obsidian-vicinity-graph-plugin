import type { SizeMetricId } from "../engine";

/**
 * Display label + render order for one sizing metric. Shared knowledge (step-06
 * Phase C/D): the in-view {@link SizingSection} disclosure and the global
 * {@link NeighborhoodGraphSettingTab} render the SAME five metric controls, so
 * the human-facing labels and their order live here once and neither surface
 * drifts.
 */
export interface SizingMetricLabel {
	readonly id: SizeMetricId;
	readonly label: string;
}

/** The five sizing metrics in presentation order (own-size first, decay last). */
export const SIZING_METRICS: readonly SizingMetricLabel[] = [
	{ id: "own-file-size", label: "Own file size" },
	{ id: "total-linker-size", label: "Total linker size" },
	{ id: "backlink-count", label: "Backlinks" },
	{ id: "outlink-count", label: "Outlinks" },
	{ id: "depth-decay", label: "Depth decay" },
];
