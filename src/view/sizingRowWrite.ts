import type { SizingSettings } from "../engine";
import { SIZING_RANGES, clampSizingSettings } from "../engine";
import { describeSizingRejection } from "./settingsValidation";

/**
 * One typed sizing row's whole write policy: what a typed value means, whether it
 * is allowed, and what actually reaches the store when the debounce window drains.
 *
 * WHY a class rather than logic in the settings tab: the verdict is taken TWICE —
 * once per keystroke (for the inline message) and once inside the debounced thunk
 * (where the write happens, possibly hundreds of ms later, against globals another
 * surface may have moved). Keeping both in one object is what makes them agree,
 * and keeps them unit-testable — the obsidian tab itself has no test harness.
 */

/** The three sizing rows that take a typed number. Metric weights write their own path. */
export type SizingNumberField = "minPx" | "maxPx" | "depthDecayK";

/**
 * The rows the `maxPx >= minPx` rule is ABOUT. `depthDecayK` is deliberately absent:
 * the pair it would be judged against is not its own, so an inverted stored pair
 * would refuse every keystroke in an unrelated row, with a message naming other fields.
 */
const CROSS_FIELD_ROWS: ReadonlySet<SizingNumberField> = new Set<SizingNumberField>(["minPx", "maxPx"]);

/** What the row shows for a typed value, and whether that value will be persisted. */
export interface SizingRowVerdict {
	/** Inline feedback, `undefined` when the value needs no comment at all. */
	readonly message: string | undefined;
	/** `true` ⇒ refused: nothing is written and the message explains why. */
	readonly rejected: boolean;
}

export class SizingRowWrite {
	constructor(
		private readonly field: SizingNumberField,
		/** Globals read FRESH on every call so successive edits compose. */
		private readonly readSizing: () => SizingSettings,
		private readonly persist: (sizing: SizingSettings) => Promise<void>,
	) {}

	/** The value currently stored for this row (what the input seeds from). */
	storedValue(): number {
		return this.readSizing()[this.field];
	}

	/** Judged against the globals as they are NOW — for the row's inline feedback. */
	judge(value: number): SizingRowVerdict {
		const prospective = this.prospective(value);
		const rejection = this.rejectionOf(prospective);
		if (rejection !== undefined) {
			return { message: rejection, rejected: true };
		}
		return { message: SizingRowWrite.capNotice(this.field, prospective, value), rejected: false };
	}

	/**
	 * The debounced write. Re-derives from the CURRENT globals and re-takes the
	 * verdict: a pair that became inverted after the keystroke was judged must not
	 * reach the store just because it was acceptable when it was typed.
	 */
	persistIfAccepted(value: number): Promise<void> {
		const prospective = this.prospective(value);
		if (this.rejectionOf(prospective) !== undefined) {
			return Promise.resolve();
		}
		return this.persist(prospective);
	}

	private prospective(value: number): SizingSettings {
		return { ...this.readSizing(), [this.field]: value };
	}

	private rejectionOf(sizing: SizingSettings): string | undefined {
		return CROSS_FIELD_ROWS.has(this.field) ? describeSizingRejection(sizing) : undefined;
	}

	/**
	 * `undefined` unless the write path will store something other than what was
	 * typed. `clampSizingSettings` is the SAME clamp `planSettingsWrite` applies, so
	 * this cannot claim a cap the store does not perform; an `<input max=…>` does
	 * not block a typed value, so without this the field would keep showing a number
	 * the plugin silently replaced.
	 */
	private static capNotice(field: SizingNumberField, prospective: SizingSettings, typed: number): string | undefined {
		const stored = clampSizingSettings(prospective)[field];
		if (stored === typed) {
			return undefined;
		}
		const range = SIZING_RANGES[field];
		return `Stored as ${stored} — the allowed range is ${range.min}–${range.max}.`;
	}
}
