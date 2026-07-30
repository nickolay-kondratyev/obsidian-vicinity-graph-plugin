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
	 * Waits until the debounced write for one persisted value has reached the plugin's
	 * SETTINGS STORE — much stronger evidence than the input still showing what was
	 * typed into it, and the level at which every assertion in a typed-input spec is
	 * made.
	 *
	 * SCOPE, stated so no caller over-reads it: `readGlobals()` asks the live
	 * `pluginDataStore` for its in-memory view, so this proves the write reached the
	 * store — NOT that `data.json` on disk holds it. The file round trip is a
	 * different claim, and the way to make it is `harness.reloadPlugin()` (which drops
	 * every in-memory store) and then read.
	 *
	 * `expect.poll` and not a wait-then-read: the settle window is only a LOWER bound
	 * on when the write starts, and the persist itself is another await behind it.
	 */
	async expectPersisted<T>(
		read: (globals: PluginGlobalsSnapshot) => T,
		expected: T,
		message: string,
		// Mutable `number[]` because that is what Playwright's own option type is.
		intervals?: number[],
	): Promise<void> {
		await expect.poll(async () => read(await this.harness.readGlobals()), { message, intervals }).toEqual(expected);
	}

	/**
	 * Asserts that `editAndLeave` — a typed edit followed by whatever is supposed to
	 * FLUSH it (leaving the field, closing the window) — reached the store WITHOUT
	 * waiting out the settle window.
	 *
	 * WHY it takes the action instead of a start time: the soundness of the claim rests
	 * entirely on the clock starting before the keystroke, so the clock is started here
	 * and a caller cannot get that wrong.
	 *
	 * WHY it cannot pass for the wrong reason: the fallback path is a
	 * `window.setTimeout(…, {@link SETTINGS_WRITE_DEBOUNCE_MS})` armed AT the keystroke,
	 * and `setTimeout` is allowed to fire late but never early. The keystroke happens
	 * after the clock starts, so a timer-driven write cannot be observed before
	 * `startedAt + SETTINGS_WRITE_DEBOUNCE_MS` on any machine at any load. Everything
	 * inside {@link FLUSH_LATENCY_BUDGET_MS} therefore came from the flush — delete the
	 * flush and this test goes red instead of quietly passing 400ms later.
	 */
	async expectFlushedAheadOfWindow<T>(
		editAndLeave: () => Promise<void>,
		read: (globals: PluginGlobalsSnapshot) => T,
		expected: T,
		message: string,
	): Promise<void> {
		const startedAt = Date.now();
		await editAndLeave();
		await this.expectPersisted(read, expected, message, FLUSH_POLL_INTERVALS_MS);
		const elapsedMs = Date.now() - startedAt;
		expect(
			elapsedMs,
			`${message} — it only landed after ${elapsedMs}ms, i.e. it was the ${SETTINGS_WRITE_DEBOUNCE_MS}ms debounce timer that persisted it, not the flush`,
		).toBeLessThan(FLUSH_LATENCY_BUDGET_MS);
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
	 *
	 * CONTRACT, for the specs told to copy this pattern:
	 * - PRECONDITION: the settings tab is OPEN with the sentinel row rendered and
	 *   enabled. Called with the window closed, this cannot type and instead hangs
	 *   until the `expect` timeout, reporting a missing sentinel rather than the truth.
	 * - It bars the TAB's `DebouncedSettingsWrites` only. An edit made in the in-graph
	 *   controls panel rides a different instance and is NOT covered by this barrier.
	 * - It MUTATES a real setting: `sizing.{@link SENTINEL_FIELD}` flips between the two
	 *   {@link SENTINEL_VALUES}. Harmless while nothing asserts on that field — a spec
	 *   that does assert on it must seed it after the last `drain()`.
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
 * How much of the settle window a genuine flush is allowed to spend before
 * {@link SettingsWriteWindow.expectFlushedAheadOfWindow} calls it a timer.
 *
 * It is NOT what makes the assertion true — anything under 1 whole window is
 * unreachable by the timer (see that method's WHY). It is purely anti-flake headroom,
 * so it is set as HIGH as it can be while still being unmistakably inside the window:
 * a flush that costs ~15ms on an idle box may cost several times that on a loaded CI
 * machine without meaning anything is broken.
 *
 * MEASURED (75 runs of `settingsTypedInput.e2e.ts`, `--repeat-each=5`, real Obsidian):
 * a flushed edit lands in 12-16ms — a ~20x margin under this budget — while the same
 * edit with the flush REMOVED lands at 414-415ms, well outside it. Both directions
 * were checked by mutation, so this is a measured gap, not a hoped-for one.
 */
const FLUSH_BUDGET_SHARE_OF_WINDOW = 0.75;

/** @see FLUSH_BUDGET_SHARE_OF_WINDOW */
const FLUSH_LATENCY_BUDGET_MS = SETTINGS_WRITE_DEBOUNCE_MS * FLUSH_BUDGET_SHARE_OF_WINDOW;

/**
 * Poll cadence while a flush is being TIMED. Fine-grained on purpose: here the
 * elapsed time IS the assertion, and `expect.poll`'s default first interval (100ms)
 * would charge a quarter of the budget to detection alone.
 */
const FLUSH_POLL_INTERVALS_MS = [10];

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
