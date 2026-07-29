import type { SizeMetricId } from "../engine";

/**
 * Display label + render order for one sizing metric. Shared knowledge (step-06
 * Phase C/D): the in-view {@link SizingSection} disclosure and the global
 * {@link VicinityGraphSettingTab} render the SAME five metric controls, so
 * the human-facing labels and their order live here once and neither surface
 * drifts.
 */
export interface SizingMetricLabel {
	readonly id: SizeMetricId;
	readonly label: string;
}

/**
 * The five sizing metrics in presentation order (own-size first, decay last).
 *
 * `as const satisfies` rather than a plain annotation: the annotation widened
 * `id` to `SizeMetricId` and made the completeness guard below vacuous.
 */
export const SIZING_METRICS = [
	{ id: "own-file-size", label: "Own file size" },
	{ id: "total-linker-size", label: "Total linker size" },
	{ id: "backlink-count", label: "Backlinks" },
	{ id: "outlink-count", label: "Outlinks" },
	{ id: "depth-decay", label: "Depth decay" },
] as const satisfies readonly SizingMetricLabel[];

/**
 * Compile-time completeness: this is an order-bearing ARRAY, not a
 * `Record<SizeMetricId, …>`, so a metric missing from it was no compile error —
 * it would just silently vanish from BOTH sizing surfaces (the in-view
 * disclosure and the settings tab). It now surfaces here as a type error naming
 * the missing metric.
 *
 * The unit test stays: it additionally catches a metric listed TWICE, which a
 * type guard cannot see.
 */
type UnlistedMetric = Exclude<SizeMetricId, (typeof SIZING_METRICS)[number]["id"]>;
export const _assertEverySizingMetricListed: UnlistedMetric extends never ? true : UnlistedMetric = true;
