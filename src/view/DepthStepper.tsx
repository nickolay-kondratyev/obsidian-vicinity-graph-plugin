import type { ReactElement } from "react";
import { clampStepperDepth, MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH } from "./constants";

/**
 * One direction's depth stepper: `−  value  +` with a reset-to-global
 * affordance (step-06 Phase C). Purely presentational — it clamps via
 * {@link clampStepperDepth} and emits the new value (or `undefined` to reset the
 * field); the parent maps that to a `SettingsInteraction`. Inherited-vs-pinned
 * is expressed via `data-pinned` (CSS: pinned = `--text-normal` + accent marker,
 * inherited = `--text-muted`); the reset control shows ONLY when pinned so the
 * "clear my override" gesture is available exactly when there is one to clear.
 */
export function DepthStepper({
	label,
	value,
	pinned,
	disabled,
	onChange,
}: {
	readonly label: string;
	readonly value: number;
	readonly pinned: boolean;
	readonly disabled: boolean;
	/** New clamped value, or `undefined` to reset the field to the global default. */
	readonly onChange: (value: number | undefined) => void;
}): ReactElement {
	const canDecrease = !disabled && value > MIN_STEPPER_DEPTH;
	const canIncrease = !disabled && value < MAX_STEPPER_DEPTH;
	return (
		<div className="vicinity-graph-stepper" data-pinned={pinned} data-disabled={disabled}>
			<span className="vicinity-graph-stepper__label">{label}</span>
			<div className="vicinity-graph-stepper__control nodrag nopan">
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={`Decrease ${label.toLowerCase()} depth`}
					disabled={!canDecrease}
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
					disabled={!canIncrease}
					onClick={() => onChange(clampStepperDepth(value + 1))}
				>
					+
				</button>
			</div>
			{/* Reset is a per-direction "unpin the field" — meaningful only when this
			    direction is actually pinned; hidden otherwise so the row stays quiet. */}
			<button
				type="button"
				className="vicinity-graph-stepper__reset nodrag nopan"
				aria-label={`Reset ${label.toLowerCase()} depth to global default`}
				title="Reset to global default"
				hidden={!pinned || disabled}
				onClick={() => onChange(undefined)}
			>
				&#8635;
			</button>
		</div>
	);
}
