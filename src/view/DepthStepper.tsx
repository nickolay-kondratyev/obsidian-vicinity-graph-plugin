import type { ReactElement } from "react";
import { clampStepperDepth, MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH } from "./constants";
import { useOptimisticValue } from "./useOptimisticValue";

/**
 * One direction's depth stepper: `−  value  +`. It clamps via
 * {@link clampStepperDepth} and emits the new value; the parent maps that to a
 * `SettingsInteraction`.
 *
 * OPTIMISTIC (see {@link useOptimisticValue}): the readout and the button
 * disabled-states move on the click, not when the graph has finished rebuilding —
 * a stepper that lags a whole traversal + layout pass reads as a broken button,
 * and rapid clicks looked dropped. The store still wins as soon as it disagrees.
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
	/** Persists the new, already clamped value. */
	readonly onChange: (value: number) => Promise<void>;
}): ReactElement {
	const [shown, request] = useOptimisticValue(value, onChange);
	return (
		<div className="vicinity-graph-stepper">
			<span className="vicinity-graph-stepper__label">{label}</span>
			<div className="vicinity-graph-stepper__control nodrag nopan">
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={`Decrease ${label.toLowerCase()} depth`}
					disabled={shown <= MIN_STEPPER_DEPTH}
					onClick={() => request(clampStepperDepth(shown - 1))}
				>
					&minus;
				</button>
				<span className="vicinity-graph-stepper__value" aria-live="polite">
					{shown}
				</span>
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={`Increase ${label.toLowerCase()} depth`}
					disabled={shown >= MAX_STEPPER_DEPTH}
					onClick={() => request(clampStepperDepth(shown + 1))}
				>
					+
				</button>
			</div>
		</div>
	);
}
