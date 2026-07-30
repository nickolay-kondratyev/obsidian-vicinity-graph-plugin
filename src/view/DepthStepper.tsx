import type { ReactElement } from "react";
import { clampStepperDepth, MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH } from "./constants";

/**
 * One direction's depth stepper: `−  value  +`. Purely presentational — it
 * clamps via {@link clampStepperDepth} and emits the new value; the parent maps
 * that to a `SettingsInteraction`.
 *
 * There is no reset-to-inherit affordance and no pinned/inherited distinction:
 * the value it edits IS the global default (the settings tab's "Restore depth
 * defaults" is the only reset), so a per-control reset would have nothing to
 * clear.
 */
export function DepthStepper({
	label,
	value,
	onChange,
}: {
	readonly label: string;
	readonly value: number;
	/** The new, already clamped value. */
	readonly onChange: (value: number) => void;
}): ReactElement {
	return (
		<div className="vicinity-graph-stepper">
			<span className="vicinity-graph-stepper__label">{label}</span>
			<div className="vicinity-graph-stepper__control nodrag nopan">
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={`Decrease ${label.toLowerCase()} depth`}
					disabled={value <= MIN_STEPPER_DEPTH}
					onClick={() => onChange(clampStepperDepth(value - 1))}
				>
					&minus;
				</button>
				<span className="vicinity-graph-stepper__value" aria-live="polite">
					{value}
				</span>
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={`Increase ${label.toLowerCase()} depth`}
					disabled={value >= MAX_STEPPER_DEPTH}
					onClick={() => onChange(clampStepperDepth(value + 1))}
				>
					+
				</button>
			</div>
		</div>
	);
}
