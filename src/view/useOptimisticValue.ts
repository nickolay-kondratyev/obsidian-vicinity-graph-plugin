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
 * - Releasing the override if `commit` REJECTS, so a control can never be left
 *   holding an override no write will ever confirm. Note what this is NOT: a
 *   rejected `data.json` write is handled once, in `SettingsWritePipeline` (which
 *   notices the user and resolves), so today's `commit` — every one of them routes
 *   there — does not reject. This guards the `commit` PROP, which is an injected
 *   `(value) => Promise<void>` this hook knows nothing else about; it raises no
 *   user-visible message, because that is the pipeline's job and duplicating it
 *   would mean two notices for one failure.
 *
 * @param stored the value as the latest snapshot has it — the authority
 * @param commit persists the requested value (returns once the write has landed)
 * @param settlesAt what the write path will actually STORE for a requested value —
 * identity unless the caller's field is clamped on the way in. A clamping control MUST
 * pass it: without it the override waits for the typed value to be echoed, which never
 * happens when the clamp lands back on the value the store already holds.
 * @returns the value to RENDER, and the setter a control calls on user input
 */
export function useOptimisticValue<T>(
	stored: T,
	commit: (value: T) => Promise<void>,
	settlesAt: (requested: T) => T = (requested) => requested,
): readonly [T, (value: T) => void] {
	const [pending, setPending] = useState(() => PendingEdits.none<T>());
	const reconciled = pending.reconciled(stored);
	if (reconciled !== pending) {
		setPending(reconciled);
	}
	const request = (value: T): void => {
		// `stored` is this render's snapshot value — the baseline the burst starts from.
		// A later request in the same burst keeps the baseline the first one recorded.
		setPending((current) => current.requesting(value, stored, settlesAt(value)));
		void commit(value).catch((error: unknown) => {
			// Not the settings-write failure log: that one is the pipeline's, and it
			// carries the notice. Reaching here means an injected `commit` rejected.
			console.error("vicinity-graph: an optimistic commit rejected", error);
			setPending((current) => current.abandoned());
		});
	};
	return [reconciled.valueOver(stored), request];
}
