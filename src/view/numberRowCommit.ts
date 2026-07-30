import type { SettingsTypedNumberAccessor } from "./settingsRowAccessors";
import type { SizingRowVerdict } from "./sizingRowWrite";

/**
 * What the CONTROLS PANEL does with the text in a typed number row when that row
 * commits — which, unlike the settings tab's debounced per-keystroke write, happens
 * once, on blur.
 *
 * WHY blur and not per keystroke: the panel's fields used to be fully controlled and
 * write on every `onChange`, so the clamp landed mid-stroke — typing `500` into Max px
 * snapped the field to `400` after the third key and moved the caret — and a row whose
 * accessor REFUSES an out-of-spec keystroke (the node cap) could not even be
 * backspaced to blank on the way to a new number, because the refused keystroke left
 * the controlled input showing the stored value again.
 *
 * WHY A MODULE OF ITS OWN: nothing under `npm test` renders React (see
 * `settingsRowParity.test.ts`), so the decision a blur makes — write what, say what —
 * has to live outside the component to be testable at all. `SettingsRowView` is then
 * markup plus one {@link NumberRowCommitPolicy} call.
 *
 * The two halves of a row's write policy stay where they already are: the accessor
 * owns what counts as a typed value ({@link SettingsTypedNumberAccessor.accept}) and
 * the {@link NumberRowJudge} owns the cross-field rule (`SizingRowWrite` is the one
 * that has one). This module only sequences them.
 */

/**
 * What a blur does: at most one write, plus at most one thing to say about it —
 * and, unless it refused, an instruction to put the stored value back in the box.
 *
 * A class with named factories rather than three object literals, so
 * {@link reseedsFromStore} is DERIVED in one place and cannot drift from the case
 * that produced it.
 */
export class NumberRowCommit {
	private constructor(
		/** The value to write, or `null` for "write nothing" — mid-edit, out of spec, or refused. */
		readonly value: number | null,
		/**
		 * Why the value was REFUSED, or `undefined` when there is nothing to say.
		 *
		 * Refusals ONLY. The panel deliberately does not carry the settings tab's
		 * "Stored as N — the allowed range is …" notice: the tab keeps the typed text in
		 * its field, so without that sentence it would show a number the plugin replaced,
		 * whereas every commit the panel does NOT refuse ends by putting the stored
		 * number back in the box ({@link reseedsFromStore}) — so the field states the
		 * same fact by simply being read.
		 */
		readonly refusal: string | undefined,
	) {}

	/** The typed value is storable. */
	static writing(value: number): NumberRowCommit {
		return new NumberRowCommit(value, undefined);
	}

	/** The typed value is not allowed, and `reason` says why. */
	static refusing(reason: string): NumberRowCommit {
		return new NumberRowCommit(null, reason);
	}

	/** The text is not a value at all (blank, mid-edit, out of spec): nothing to write, nothing to explain. */
	static nothing(): NumberRowCommit {
		return new NumberRowCommit(null, undefined);
	}

	/**
	 * `true` ⇒ the field must be RESEEDED with the stored value.
	 *
	 * Every commit except a refused one — because a commit that says nothing leaves the
	 * typed text with no meaning of its own, and the store is then the only thing that
	 * can give the box one. WHY NOT the narrower "wrote nothing AND said nothing": a
	 * write is no guarantee that the row will move. Nothing is stored when the text was
	 * blank or mid-edit, and nothing MOVES when the write path caps the typed number
	 * back onto the value already stored (a field sitting at a range bound, typed past
	 * it) or when the text merely spelled that value differently (`007`). All three end
	 * with the box holding something the plugin did not store and no message about it.
	 *
	 * Reseeding the ordinary accepted write on top of the store echo costs nothing: the
	 * echo already remounts the field on its own (the stored value is half of the input's
	 * `key` in `useNumberFieldCommit`), so the extra remount request lands on a field the
	 * echo was replacing anyway.
	 *
	 * A REFUSED commit keeps the typed text on purpose: it is what the reason is about.
	 */
	get reseedsFromStore(): boolean {
		return this.refusal === undefined;
	}
}

/**
 * A refusal a field is CARRYING — the reason a commit gave, bound to the stored value it
 * was judged against.
 *
 * WHY the binding: the panel's fields are uncontrolled, so a store move (Restore defaults,
 * the settings tab, a second graph view) reseeds the box with a number the refusal was
 * never about. Left unbound, that message would sit under a valid stored value and keep it
 * marked `aria-invalid` — a field announced as wrong for a value the user cannot see.
 *
 * A REFUSED commit writes nothing, so the stored value it was judged against does not move:
 * a refusal is never retired by the commit that earned it, only by the store moving on.
 *
 * KNOWN EDGE, stated rather than papered over: the binding is by VALUE, so a store that
 * moves away and back to the same number (two writes on another surface, the field
 * untouched between them) shows the refusal again. Committing the field clears it.
 */
export class NumberFieldRefusal {
	private constructor(
		private readonly reason: string,
		private readonly judgedAgainst: number,
	) {}

	/**
	 * What `commit` refused, if anything.
	 *
	 * @param storedWhenJudged the value the store held for this field as the commit was made
	 */
	static fromCommit(commit: NumberRowCommit, storedWhenJudged: number): NumberFieldRefusal | undefined {
		return commit.refusal === undefined ? undefined : new NumberFieldRefusal(commit.refusal, storedWhenJudged);
	}

	/** The reason, for as long as it is still about the number the field is showing. */
	messageWhileStoredIs(stored: number): string | undefined {
		return stored === this.judgedAgainst ? this.reason : undefined;
	}
}

/**
 * A row's cross-field rule — the half of the verdict an accessor cannot reach, because
 * it judges one field against the OTHERS as they are stored right now.
 *
 * An interface, not a concrete type, so the panel and the settings tab share the one
 * implementation that exists (`SizingRowWrite`) while rows without such a rule stay a
 * different, trivial implementation rather than a `null` branch.
 */
export interface NumberRowJudge {
	judge(value: number): SizingRowVerdict;
}

/**
 * The judge for a row whose accessor is its WHOLE policy: if `accept` returned a
 * number, that number is storable. Every panel row except the two sizing bounds.
 */
export const NO_CROSS_FIELD_RULE: NumberRowJudge = {
	judge: () => ({ message: undefined, rejected: false }),
};

/** One typed number row's blur decision. */
export class NumberRowCommitPolicy {
	constructor(
		private readonly accessor: SettingsTypedNumberAccessor,
		private readonly judge: NumberRowJudge,
	) {}

	/**
	 * @param raw the field's text as the user left it
	 */
	commit(raw: string): NumberRowCommit {
		const parsed = this.accessor.accept(raw);
		if (parsed === undefined) {
			// Blank or not a number: nothing to write and nothing to explain — the same
			// silence the settings tab keeps for a field left mid-edit. The panel differs
			// in one way, because its field is uncontrolled: it puts the stored value back.
			return NumberRowCommit.nothing();
		}
		const verdict = this.judge.judge(parsed);
		return verdict.rejected ? NumberRowCommit.refusing(verdict.message) : NumberRowCommit.writing(parsed);
	}
}
