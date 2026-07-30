import { useState } from "react";
import { PendingEdits } from "./optimisticValue";

/**
 * Makes one panel control OPTIMISTIC: it shows what the user just did, while the
 * persisted write is serialised by `SettingsWritePipeline` and the graph rebuild
 * that carries the value back takes a traversal + layout round-trip.
 *
 * Every rule lives in the pure {@link PendingEdits} (this repo has no React
 * component-test infrastructure, so nothing testable may live here). This wrapper
 * only owns the React mechanics:
 *
 * - Reconciling DURING RENDER, not in an effect. Adjusting state while rendering is
 *   React's own documented answer for "derive from a changed prop"; an effect would
 *   paint one frame of the stale value first, which is the flicker this exists to
 *   avoid.
 * - Releasing the override when the write is ABANDONED, so a failed `data.json`
 *   write cannot leave the control showing a value that was never stored. The
 *   rejection is logged here because a control's `onChange` has nowhere to put it.
 *
 * @param stored the value as the latest snapshot has it — the authority
 * @param commit persists the requested value (returns once the write has landed)
 * @returns the value to RENDER, and the setter a control calls on user input
 */
export function useOptimisticValue<T>(
	stored: T,
	commit: (value: T) => Promise<void>,
): readonly [T, (value: T) => void] {
	const [pending, setPending] = useState(() => PendingEdits.none<T>());
	const reconciled = pending.reconciled(stored);
	if (reconciled !== pending) {
		setPending(reconciled);
	}
	const request = (value: T): void => {
		// `stored` is this render's snapshot value — the baseline the burst starts from.
		// A later request in the same burst keeps the baseline the first one recorded.
		setPending((current) => current.requesting(value, stored));
		void commit(value).catch((error: unknown) => {
			console.error("vicinity-graph: failed to persist a settings change", error);
			setPending((current) => current.abandoned());
		});
	};
	return [reconciled.valueOver(stored), request];
}
