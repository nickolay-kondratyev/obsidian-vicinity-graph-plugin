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
 * WHY it tracks the REQUESTED values rather than "am I dirty": mid-burst, the
 * store echoes the user's EARLIER requests one at a time. A rule that released the
 * override on any store change would flicker the control back through every
 * intermediate value it had already moved past. Holding until the store reaches the
 * LATEST request is what makes a burst feel like one continuous edit — while a
 * value nobody requested (another surface wrote it, or the write path clamped what
 * was typed) still wins at once, so the control can never lie about what is stored.
 *
 * Immutable: instances are React state, so every transition returns a new one.
 */
export class PendingEdits<T> {
	private constructor(
		/** Values requested since the store was last in agreement, in request order. */
		private readonly requested: readonly T[],
	) {}

	/** No edit outstanding — the store is authoritative. */
	static none<T>(): PendingEdits<T> {
		return new PendingEdits<T>([]);
	}

	/** What the control shows: the latest request while one is outstanding, else the store. */
	valueOver(stored: T): T {
		const latest = this.latestRequest();
		return latest === undefined ? stored : latest.value;
	}

	/** Records a value the user asked for, before any write has landed. */
	requesting(value: T): PendingEdits<T> {
		return new PendingEdits<T>([...this.requested, value]);
	}

	/**
	 * Folds a freshly observed stored value in. Returns THIS instance when nothing
	 * changes, so a caller can compare by identity (React re-render guard).
	 */
	reconciled(stored: T): PendingEdits<T> {
		if (this.requested.length === 0) {
			return this;
		}
		const caughtUp = Object.is(this.latestRequest()?.value, stored);
		const echoOfAnEarlierRequest = this.requested.some((value) => Object.is(value, stored));
		return caughtUp || !echoOfAnEarlierRequest ? PendingEdits.none<T>() : this;
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
