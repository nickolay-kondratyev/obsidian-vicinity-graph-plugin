import type { ReactElement } from "react";
import type { SettingsTrackAccessor } from "./settingsRowAccessors";
import type { SettingsRow } from "./settingsRows";
import { SettingsRowNames } from "./settingsRows";
import { useOptimisticValue } from "./useOptimisticValue";

/**
 * One depth row's stepper: `−  value  +`. Where it stops, how far one tap moves and
 * what a tap CLAMPS to all come from the one {@link SettingsTrackAccessor} it is
 * handed, so the track it offers and the value the write stores cannot disagree.
 *
 * The label and both button names come from the declared row (see
 * {@link SettingsRowNames}): two buttons share one row, so they are named by VERB +
 * row label ("Decrease links out") rather than by the row label alone.
 *
 * OPTIMISTIC (see {@link useOptimisticValue}): the readout and the button
 * disabled-states move on the click, not when the graph has finished rebuilding —
 * a stepper that lags a whole traversal + layout pass reads as a broken button,
 * and rapid clicks looked dropped. The store still wins as soon as it disagrees.
 *
 * Each click therefore steps from `shown`, NOT from the `value` prop: `value` is the
 * last snapshot, which mid-burst is several clicks behind. That loop is pinned in
 * `optimisticValue.test.ts` ("PendingEdits driving a depth stepper") as a simulation
 * of this component, not of this component — a real component test needs the React
 * harness tracked in `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`.
 *
 * There is no reset-to-inherit affordance and no pinned/inherited distinction:
 * the value it edits IS the global default (the settings tab's "Restore depth
 * defaults" is the only reset), so a per-control reset would have nothing to
 * clear.
 */
export function DepthStepper({
	row,
	accessor,
	value,
	onChange,
}: {
	readonly row: SettingsRow;
	/** The depth field's declared track: its bounds, its step and its clamp. */
	readonly accessor: SettingsTrackAccessor;
	readonly value: number;
	/** Persists the new, already clamped value. */
	readonly onChange: (value: number) => Promise<void>;
}): ReactElement {
	const { bounds, settlesAt } = accessor;
	const [shown, request] = useOptimisticValue(value, onChange);
	return (
		<div className="vicinity-graph-stepper" title={row.description}>
			<span className="vicinity-graph-stepper__label">{row.label}</span>
			<div className="vicinity-graph-stepper__control nodrag nopan">
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={SettingsRowNames.action("Decrease", row)}
					disabled={shown <= bounds.min}
					onClick={() => request(settlesAt(shown - bounds.step))}
				>
					&minus;
				</button>
				<span className="vicinity-graph-stepper__value" aria-live="polite">
					{shown}
				</span>
				<button
					type="button"
					className="vicinity-graph-stepper__button"
					aria-label={SettingsRowNames.action("Increase", row)}
					disabled={shown >= bounds.max}
					onClick={() => request(settlesAt(shown + bounds.step))}
				>
					+
				</button>
			</div>
		</div>
	);
}
