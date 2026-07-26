import type { SettingsRange, SizeMetricId, SizingSettings, ViewSettings } from "../engine";
import { SIZING_RANGES } from "../engine";
import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import { Disclosure } from "./Disclosure";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";
import { SIZING_METRICS } from "./sizingMetrics";

/**
 * The in-view sizing mirror (step-06 Phase C, CLARIFICATION Q5): a collapsed
 * disclosure of the SAME global sizing controls the settings tab exposes —
 * per-metric enable + weight, min/max px, depth-decay `k`. It writes GLOBAL via
 * the pure {@link planSettingsWrite} `global-sizing` command, so this in-view
 * surface and the settings tab share ONE write path (zero duplicated logic).
 *
 * Fully controlled off the snapshot: every field reads the current
 * {@link ViewSettings.sizing} and each edit emits a whole-object write that
 * rebuilds and flows a fresh value back — no local form state to drift.
 */

export function SizingSection({
	view,
	ctx,
}: {
	readonly view: ViewSettings;
	readonly ctx: SettingsWriteContext;
}): ReactElement {
	const actions = useControlsActions();
	const sizing = view.sizing;

	const applySizing = (next: SizingSettings): void => {
		void actions.applySettings(planSettingsWrite({ kind: "global-sizing", sizing: next }, ctx));
	};
	const setMetric = (id: SizeMetricId, patch: { enabled?: boolean; weight?: number }): void => {
		applySizing({ ...sizing, metrics: { ...sizing.metrics, [id]: { ...sizing.metrics[id], ...patch } } });
	};

	return (
		<Disclosure summary="Node sizing" className="vicinity-graph-sizing" bodyClassName="nowheel">
			<div className="vicinity-graph-sizing__metrics">
					{SIZING_METRICS.map(({ id, label }) => {
						const metric = sizing.metrics[id];
						return (
							<div className="vicinity-graph-sizing__metric" key={id}>
								<label className="vicinity-graph-sizing__toggle">
									<input
										type="checkbox"
										checked={metric.enabled}
										onChange={(event) => setMetric(id, { enabled: event.target.checked })}
									/>
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
									value={metric.weight}
									disabled={!metric.enabled}
									onChange={(event) => {
										const weight = parseSizingInput(event.target.value);
										if (weight !== undefined) {
											setMetric(id, { weight });
										}
									}}
								/>
							</div>
						);
					})}
				</div>
				<div className="vicinity-graph-sizing__ranges">
					<SizingNumber
						label="Min px"
						value={sizing.minPx}
						range={SIZING_RANGES.minPx}
						onChange={(minPx) => applySizing({ ...sizing, minPx })}
					/>
					<SizingNumber
						label="Max px"
						value={sizing.maxPx}
						range={SIZING_RANGES.maxPx}
						onChange={(maxPx) => applySizing({ ...sizing, maxPx })}
					/>
					<SizingNumber
						label="Depth decay k"
						value={sizing.depthDecayK}
						range={SIZING_RANGES.depthDecayK}
						onChange={(depthDecayK) => applySizing({ ...sizing, depthDecayK })}
					/>
				</div>
		</Disclosure>
	);
}

/**
 * A labelled numeric field. What counts as typed input is {@link parseSizingInput}'s
 * single rule (shared with the settings tab); the bounds are the engine's, the
 * same ones {@link planSettingsWrite} clamps with (the `min` attribute alone
 * only drives the steppers, never a typed value).
 */
function SizingNumber({
	label,
	value,
	range,
	onChange,
}: {
	readonly label: string;
	readonly value: number;
	readonly range: SettingsRange;
	readonly onChange: (value: number) => void;
}): ReactElement {
	return (
		<label className="vicinity-graph-sizing__field">
			<span>{label}</span>
			<input
				type="number"
				min={range.min}
				max={range.max}
				step={range.step}
				value={value}
				onChange={(event) => {
					const parsed = parseSizingInput(event.target.value);
					if (parsed !== undefined) {
						onChange(parsed);
					}
				}}
			/>
		</label>
	);
}
