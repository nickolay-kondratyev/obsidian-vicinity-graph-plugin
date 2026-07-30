import type { SettingsRange, SizeMetricId, SizingMetricSetting, ViewSettings } from "../engine";
import { SIZING_RANGES } from "../engine";
import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import type { SizingNumberField } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";
import { SIZING_METRICS } from "./sizingMetrics";
import { useOptimisticValue } from "./useOptimisticValue";

/**
 * The in-view sizing mirror (step-06 Phase C, CLARIFICATION Q5): a collapsed
 * disclosure of the SAME global sizing controls the settings tab exposes —
 * per-metric enable + weight, min/max px, depth-decay `k`.
 *
 * Every row names ONE field (`global-sizing-number` /
 * `global-sizing-metric-*`) and the pipeline merges it over a fresh read. That is
 * deliberate and load-bearing: this section used to send the WHOLE sizing object,
 * spread over the snapshot it had rendered from, so editing max px right after min
 * px reverted the min px edit.
 *
 * Each row is optimistic (see {@link useOptimisticValue}) so typing a weight or a
 * size does not wait for the rebuild; the store still wins the moment it disagrees
 * (including when the write path CLAMPS what was typed).
 */

export function SizingSection({ view }: { readonly view: ViewSettings }): ReactElement {
	const sizing = view.sizing;

	return (
		<Disclosure summary="Node sizing" className="vicinity-graph-sizing" bodyClassName="nowheel">
			<div className="vicinity-graph-sizing__metrics">
				{SIZING_METRICS.map(({ id, label }) => (
					<SizingMetricRow key={id} metric={id} label={label} setting={sizing.metrics[id]} />
				))}
			</div>
			<div className="vicinity-graph-sizing__ranges">
				<SizingNumber label="Min px" field="minPx" value={sizing.minPx} />
				<SizingNumber label="Max px" field="maxPx" value={sizing.maxPx} />
				<SizingNumber label="Depth decay k" field="depthDecayK" value={sizing.depthDecayK} />
			</div>
		</Disclosure>
	);
}

/** One metric: the enable toggle and the weight it governs — one decision, two controls. */
function SizingMetricRow({
	metric,
	label,
	setting,
}: {
	readonly metric: SizeMetricId;
	readonly label: string;
	readonly setting: SizingMetricSetting;
}): ReactElement {
	const actions = useControlsActions();
	const [enabled, requestEnabled] = useOptimisticValue(setting.enabled, (value) =>
		actions.applySettings({ kind: "global-sizing-metric-enabled", metric, enabled: value }),
	);
	const [weight, requestWeight] = useOptimisticValue(setting.weight, (value) =>
		actions.applySettings({ kind: "global-sizing-metric-weight", metric, weight: value }),
	);
	return (
		<div className="vicinity-graph-sizing__metric">
			<label className="vicinity-graph-sizing__toggle">
				<input type="checkbox" checked={enabled} onChange={(event) => requestEnabled(event.target.checked)} />
				<span>{label}</span>
			</label>
			<input
				type="number"
				className="vicinity-graph-sizing__weight"
				aria-label={`${label} weight`}
				title="Weight"
				min={SIZING_RANGES.metricWeight.min}
				max={SIZING_RANGES.metricWeight.max}
				step={SIZING_RANGES.metricWeight.step}
				value={weight}
				disabled={!enabled}
				onChange={(event) => {
					const parsed = parseSizingInput(event.target.value);
					if (parsed !== undefined) {
						requestWeight(parsed);
					}
				}}
			/>
		</div>
	);
}

/**
 * A labelled numeric field. What counts as typed input is {@link parseSizingInput}'s
 * single rule (shared with the settings tab); the bounds are the engine's, the
 * same ones the write path clamps with (the `min` attribute alone only drives the
 * steppers, never a typed value).
 */
function SizingNumber({
	label,
	field,
	value,
}: {
	readonly label: string;
	readonly field: SizingNumberField;
	readonly value: number;
}): ReactElement {
	const actions = useControlsActions();
	const range: SettingsRange = SIZING_RANGES[field];
	const [shown, request] = useOptimisticValue(value, (next) =>
		actions.applySettings({ kind: "global-sizing-number", field, value: next }),
	);
	return (
		<label className="vicinity-graph-sizing__field">
			<span>{label}</span>
			<input
				type="number"
				min={range.min}
				max={range.max}
				step={range.step}
				value={shown}
				onChange={(event) => {
					const parsed = parseSizingInput(event.target.value);
					if (parsed !== undefined) {
						request(parsed);
					}
				}}
			/>
		</label>
	);
}
