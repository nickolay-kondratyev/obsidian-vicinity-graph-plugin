import type { SizeMetricId, SizingSettings, ViewSettings } from "../engine";
import type { ReactElement } from "react";
import { useControlsActions } from "./ControlsActionsContext";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
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
		<details className="neighborhood-graph-disclosure neighborhood-graph-sizing">
			<summary className="neighborhood-graph-disclosure__summary">Node sizing</summary>
			<div className="neighborhood-graph-disclosure__body nowheel">
				<div className="neighborhood-graph-sizing__metrics">
					{SIZING_METRICS.map(({ id, label }) => {
						const metric = sizing.metrics[id];
						return (
							<div className="neighborhood-graph-sizing__metric" key={id}>
								<label className="neighborhood-graph-sizing__toggle">
									<input
										type="checkbox"
										checked={metric.enabled}
										onChange={(event) => setMetric(id, { enabled: event.target.checked })}
									/>
									<span>{label}</span>
								</label>
								<input
									type="number"
									className="neighborhood-graph-sizing__weight"
									aria-label={`${label} weight`}
									title="Weight"
									min={0}
									step={0.5}
									value={metric.weight}
									disabled={!metric.enabled}
									onChange={(event) => {
										if (!Number.isNaN(event.target.valueAsNumber)) {
											setMetric(id, { weight: event.target.valueAsNumber });
										}
									}}
								/>
							</div>
						);
					})}
				</div>
				<div className="neighborhood-graph-sizing__ranges">
					<SizingNumber
						label="Min px"
						value={sizing.minPx}
						min={1}
						step={4}
						onChange={(minPx) => applySizing({ ...sizing, minPx })}
					/>
					<SizingNumber
						label="Max px"
						value={sizing.maxPx}
						min={1}
						step={4}
						onChange={(maxPx) => applySizing({ ...sizing, maxPx })}
					/>
					<SizingNumber
						label="Depth decay k"
						value={sizing.depthDecayK}
						min={0}
						step={0.5}
						onChange={(depthDecayK) => applySizing({ ...sizing, depthDecayK })}
					/>
				</div>
			</div>
		</details>
	);
}

/** A labelled numeric field that only fires `onChange` on a valid number. */
function SizingNumber({
	label,
	value,
	min,
	step,
	onChange,
}: {
	readonly label: string;
	readonly value: number;
	readonly min: number;
	readonly step: number;
	readonly onChange: (value: number) => void;
}): ReactElement {
	return (
		<label className="neighborhood-graph-sizing__field">
			<span>{label}</span>
			<input
				type="number"
				min={min}
				step={step}
				value={value}
				onChange={(event) => {
					if (!Number.isNaN(event.target.valueAsNumber)) {
						onChange(event.target.valueAsNumber);
					}
				}}
			/>
		</label>
	);
}
