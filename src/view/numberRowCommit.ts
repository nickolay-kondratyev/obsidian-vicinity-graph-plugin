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

/** What a blur does: at most one write, plus at most one thing to say about it. */
export interface NumberRowCommit {
	/** The value to write, or `null` for "write nothing" — mid-edit, out of spec, or refused. */
	readonly value: number | null;
	/**
	 * Why the value was REFUSED, or `undefined` when there is nothing to say.
	 *
	 * Refusals ONLY. The panel deliberately does not carry the settings tab's
	 * "Stored as N — the allowed range is …" notice: the tab keeps the typed text in
	 * its field, so without that sentence it would show a number the plugin replaced,
	 * whereas the panel reseeds its field FROM THE STORE on an accepted commit and so
	 * states the same fact by simply showing the stored number.
	 */
	readonly refusal: string | undefined;
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
			// silence the settings tab keeps for a field left mid-edit.
			return { value: null, refusal: undefined };
		}
		const verdict = this.judge.judge(parsed);
		return verdict.rejected ? { value: null, refusal: verdict.message } : { value: parsed, refusal: undefined };
	}
}
