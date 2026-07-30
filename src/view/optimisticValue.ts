/**
 * One control's edits that the store has not confirmed yet — the rule that lets a
 * panel control answer a click or a keystroke IMMEDIATELY while its write is
 * serialised behind the rebuild it triggers.
 *
 * WHY a control cannot simply render the snapshot: every panel control writes a
 * global and then waits for a whole traversal + elk layout round-trip before a
 * fresh snapshot arrives. Rendering only the snapshot makes typing and dragging
 * feel broken (`ticket-controls-optimistic-input-latency.md`).
 *
 * WHY it tracks the BASELINE plus the REQUESTED values rather than "am I dirty":
 * mid-burst, the store echoes the user's EARLIER requests one at a time. A rule
 * that released the override on any store change would flicker the control back
 * through every intermediate value it had already moved past. Holding until the
 * store reaches the LATEST request is what makes a burst feel like one continuous
 * edit — while a value that is neither the baseline the burst started from nor one
 * of the burst's own requests (another surface wrote it, or the write path clamped
 * what was typed) wins at once, so the control can never lie about what is stored.
 * The baseline is what keeps those two apart: "the store simply has not moved yet"
 * is the state EVERY edit passes through, and it must not be read as a third party.
 *
 * WHY a request carries what it will SETTLE AT as well as what it shows: a write path
 * may store something other than what was typed (`clampSizingSettings` bounds every
 * sizing number). Waiting for the typed value to be echoed would then wait forever
 * whenever the clamp lands back on the baseline — a field already sitting at its range
 * bound, typed past that bound — and the control would display an unstored number
 * indefinitely. Reconciling against the value the write will actually store closes
 * that, without costing the optimism while the write is in flight.
 *
 * Immutable: instances are React state, so every transition returns a new one.
 */
/**
 * One value the user asked for. A record rather than a bare value for two reasons:
 * the displayed and the to-be-stored value can differ (a clamp), and an `undefined`
 * VALUE stays distinguishable from "no request at all" — `T` is the caller's type and
 * may legitimately include `undefined`.
 */
interface RequestedEdit<T> {
	/** What the control shows for this request. */
	readonly shown: T;
	/** What the store is expected to hold once this request's write lands. */
	readonly settlesAt: T;
}

export class PendingEdits<T> {
	private constructor(
		/** Requests made since the store was last in agreement, in request order. */
		private readonly requested: readonly RequestedEdit<T>[],
		/**
		 * The stored value the burst started from — boxed, so a legitimately
		 * `undefined` baseline stays distinguishable from "nothing requested".
		 * Defined exactly when {@link requested} is non-empty.
		 */
		private readonly baseline: { readonly value: T } | undefined,
	) {}

	/** No edit outstanding — the store is authoritative. */
	static none<T>(): PendingEdits<T> {
		return new PendingEdits<T>([], undefined);
	}

	/** What the control shows: the latest request while one is outstanding, else the store. */
	valueOver(stored: T): T {
		const latest = this.latestRequest();
		return latest === undefined ? stored : latest.shown;
	}

	/**
	 * Records a value the user asked for, before any write has landed.
	 *
	 * @param storedNow the store's value as the control is rendering it. The FIRST
	 * request of a burst keeps it as the BASELINE, which is the only way
	 * {@link reconciled} can tell "the store has not moved yet" (hold the override)
	 * apart from "something else moved the store" (release it at once). Without it
	 * the very first re-render — which still carries the pre-edit value, because the
	 * write is serialised behind a traversal + layout round-trip — looked like a
	 * third-party change and dropped the user's edit before it was painted.
	 * @param settlesAt the value the write path will actually STORE for `value` —
	 * `value` itself unless the caller's field is clamped on the way in. It is what
	 * {@link reconciled} watches for; `value` is only ever displayed.
	 */
	requesting(value: T, storedNow: T, settlesAt: T = value): PendingEdits<T> {
		const edit: RequestedEdit<T> = { shown: value, settlesAt };
		return new PendingEdits<T>([...this.requested, edit], this.baseline ?? { value: storedNow });
	}

	/**
	 * Folds a freshly observed stored value in. Returns THIS instance when nothing
	 * changes, so a caller can compare by identity (React re-render guard).
	 *
	 * Held while the store is still on the burst's baseline or on one of the burst's
	 * OWN earlier values; released once it holds what the latest request settles at, or
	 * shows anything else — that "anything else" is another surface's write, and the
	 * store is then right where the control was wrong.
	 *
	 * The latest request is checked FIRST, so a clamp that settles back ON the baseline
	 * releases rather than waiting for a store change that will never come.
	 */
	reconciled(stored: T): PendingEdits<T> {
		if (this.baseline === undefined) {
			return this;
		}
		if (Object.is(this.latestRequest()?.settlesAt, stored)) {
			return PendingEdits.none<T>();
		}
		const storeHasNotMovedYet = Object.is(this.baseline.value, stored);
		const echoOfAnEarlierRequest = this.requested.some((edit) => Object.is(edit.settlesAt, stored));
		return storeHasNotMovedYet || echoOfAnEarlierRequest ? this : PendingEdits.none<T>();
	}

	private latestRequest(): RequestedEdit<T> | undefined {
		const last = this.requested[this.requested.length - 1];
		return this.requested.length === 0 ? undefined : (last as RequestedEdit<T>);
	}

	/** Gives authority back to the store — the requested write will never be confirmed. */
	abandoned(): PendingEdits<T> {
		return PendingEdits.none<T>();
	}
}
