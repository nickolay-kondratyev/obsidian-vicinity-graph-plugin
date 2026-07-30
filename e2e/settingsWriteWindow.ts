import { expect } from "@playwright/test";
import type { ObsidianHarness, PluginGlobalsSnapshot } from "./obsidianHarness";
import type { SettingsTabPage } from "./settingsTabPage";
import { SettingsRowAccessors } from "../src/view/settingsRowAccessors";
import { SETTINGS_WRITE_DEBOUNCE_MS } from "../src/view/constants";
import { sizingNumberControlName } from "./settingsBaseline";

/**
 * THE debounce-window pattern for e2e specs that TYPE into a settings field —
 * the one thing no spec had before ticket `nid_ek3wrqoh1rsftk6ulg836mghf_e`,
 * because every other spec writes through `harness.save*` and therefore never
 * meets {@link SETTINGS_WRITE_DEBOUNCE_MS}.
 *
 * A typed settings edit does not persist when the keystroke happens: it persists
 * when `DebouncedSettingsWrites` drains its shared settle window (400ms after the
 * LAST keystroke in any typed row). So a spec has two distinct questions, and only
 * one of them is a plain poll:
 *
 * - "did this edit land?" → {@link expectPersisted}: poll the store until it does.
 *   Web-first, no timing assumption at all.
 * - "did this edit NOT land?" → an ABSENCE claim, which no poll can settle. This is
 *   exactly where a spec is tempted to sleep for `SETTINGS_WRITE_DEBOUNCE_MS + margin`
 *   — a magic wait that passes for the wrong reason on a slow machine and hides the
 *   race it is papering over. {@link drain} answers it by ORDERING instead.
 *
 * WHY-NOT reach into the tab's own `settlePendingWrites()` through `page.evaluate`:
 * it would be deterministic, but it replaces the window under test with a barrier of
 * our own making — the spec would then prove that an explicitly flushed write behaves,
 * not that the DEBOUNCE does.
 *
 * Pure page automation, no `fs` (see the note in {@link SettingsTabPage}).
 */
export class SettingsWriteWindow {
	constructor(
		private readonly harness: ObsidianHarness,
		private readonly tab: SettingsTabPage,
	) {}

	/**
	 * Waits until the debounced write for one persisted value has actually reached
	 * `data.json` — the only honest evidence that a typed edit was STORED, as opposed
	 * to merely displayed in the input it was typed into.
	 *
	 * `expect.poll` and not a wait-then-read: the settle window is only a LOWER bound
	 * on when the write starts, and the persist itself is another await behind it.
	 */
	async expectPersisted<T>(read: (globals: PluginGlobalsSnapshot) => T, expected: T, message: string): Promise<void> {
		await expect.poll(async () => read(await this.harness.readGlobals()), { message }).toEqual(expected);
	}

	/**
	 * Resolves once the settle window that was open when this was called has DRAINED,
	 * so anything still pending at the call has either persisted or was never scheduled.
	 * A spec asserting "the rejected value is NOT in the store" calls this first, and
	 * its absence claim is then a statement about a settled store rather than a race.
	 *
	 * HOW, without a sleep: `DebouncedSettingsWrites` keeps ONE window shared by every
	 * typed row and drains ALL pending thunks together. So this makes a SENTINEL edit in
	 * an unrelated typed row and polls until THAT value is stored. Seeing the sentinel
	 * land proves the shared window opened after the edit under test and drained — a
	 * pending write for the edit under test would have drained in the very same pass.
	 *
	 * It is also a positive control: if `fill()` did not drive the real handler at all,
	 * the sentinel would never land and this fails LOUD instead of turning the caller's
	 * absence assertion into a vacuous pass.
	 */
	async drain(): Promise<void> {
		const sentinel = await this.nextSentinelValue();
		await this.tab.typeInto(SENTINEL_CONTROL_NAME, String(sentinel));
		await this.expectPersisted(
			(globals) => globals.view.sizing[SENTINEL_FIELD],
			sentinel,
			`the sentinel edit never persisted, so the ${SETTINGS_WRITE_DEBOUNCE_MS}ms settle window cannot be shown to have drained`,
		);
	}

	/**
	 * The sentinel's next value: whichever of the two candidates the store does NOT
	 * hold. It must CHANGE the stored number every time — a sentinel that writes the
	 * value already there is indistinguishable from no write at all, and {@link drain}
	 * would then pass without any window having drained.
	 */
	private async nextSentinelValue(): Promise<number> {
		const stored = (await this.harness.readGlobalView()).sizing[SENTINEL_FIELD];
		return stored === SENTINEL_VALUES.low ? SENTINEL_VALUES.high : SENTINEL_VALUES.low;
	}
}

/**
 * The row {@link SettingsWriteWindow.drain} writes its sentinel into: `Depth decay k`.
 *
 * WHY this row: it is a DEBOUNCED typed field (so it rides the same shared window as
 * the edit under test) and it is the one sizing number with NO cross-field rule
 * (`CROSS_FIELD_ROWS` in `src/view/sizingRowWrite.ts` covers only min/max px) — so the
 * sentinel can never itself be refused by whatever inverted pair a caller just typed.
 */
const SENTINEL_FIELD = "depthDecayK";

/** Read from the declared row model, never re-typed: a renamed row fails HERE, not in a spec. */
const SENTINEL_CONTROL_NAME = sizingNumberControlName(SENTINEL_FIELD);

/**
 * Two in-bounds sentinel values, taken from the row's OWN accessor bounds so they
 * cannot fall outside the range the write path clamps to (a clamped sentinel would
 * store a number this module never polls for, and `drain` would hang).
 */
const SENTINEL_VALUES = ((): { readonly low: number; readonly high: number } => {
	const bounds = SettingsRowAccessors.sizingNumber(SENTINEL_FIELD).bounds;
	return { low: bounds.min, high: bounds.min + bounds.step };
})();
