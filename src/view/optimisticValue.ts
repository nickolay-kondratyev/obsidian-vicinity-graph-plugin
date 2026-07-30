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
 * Immutable: instances are React state, so every transition returns a new one.
 */
export class PendingEdits<T> {
	private constructor(
		/** Values requested since the store was last in agreement, in request order. */
		private readonly requested: readonly T[],
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
		return latest === undefined ? stored : latest.value;
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
	 */
	requesting(value: T, storedNow: T): PendingEdits<T> {
		return new PendingEdits<T>([...this.requested, value], this.baseline ?? { value: storedNow });
	}

	/**
	 * Folds a freshly observed stored value in. Returns THIS instance when nothing
	 * changes, so a caller can compare by identity (React re-render guard).
	 *
	 * Held while the store is still on the burst's baseline or on one of the burst's
	 * OWN earlier values; released once it reaches the latest request, or shows
	 * anything else — that "anything else" is another surface's write or a clamp, and
	 * the store is then right where the control was wrong.
	 */
	reconciled(stored: T): PendingEdits<T> {
		if (this.baseline === undefined) {
			return this;
		}
		if (Object.is(this.latestRequest()?.value, stored)) {
			return PendingEdits.none<T>();
		}
		const storeHasNotMovedYet = Object.is(this.baseline.value, stored);
		const echoOfAnEarlierRequest = this.requested.some((value) => Object.is(value, stored));
		return storeHasNotMovedYet || echoOfAnEarlierRequest ? this : PendingEdits.none<T>();
	}

	/**
	 * Boxed so an `undefined` VALUE is distinguishable from "no request" — `T` is the
	 * caller's type and may legitimately include `undefined`.
	 */
	private latestRequest(): { readonly value: T } | undefined {
		const last = this.requested[this.requested.length - 1];
		return this.requested.length === 0 ? undefined : { value: last as T };
	}

	/** Gives authority back to the store — the requested write will never be confirmed. */
	abandoned(): PendingEdits<T> {
		return PendingEdits.none<T>();
	}
}
