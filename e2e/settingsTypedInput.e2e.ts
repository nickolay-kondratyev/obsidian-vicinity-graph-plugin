import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import { SettingsTabPage } from "./settingsTabPage";
import { SettingsWriteWindow } from "./settingsWriteWindow";
import { sizingNumberControlName, soleRowControlName } from "./settingsBaseline";
import {
	describeInvalidExclusionPatterns,
	describeSizingRejection,
	parseExclusionPatterns,
} from "../src/view/settingsValidation";

/**
 * Ticket `nid_ek3wrqoh1rsftk6ulg836mghf_e`: until this spec, NO e2e spec ever TYPED
 * into a settings-tab field. Every other one writes through `harness.save*` and
 * asserts on the re-rendered DOM, so the settings tab's typed-input WIRING — the
 * debounce settle, the flush on leaving, and the inline feedback the row shows — had
 * real-Obsidian coverage of exactly zero.
 *
 * WHAT THIS SPEC IS FOR, and what it deliberately is not: the DECISIONS are already
 * unit-tested (`src/view/settingsDebounce.test.ts`, `src/view/settingsValidation.test.ts`,
 * `src/view/sizingRowWrite.test.ts`). Nothing here re-tests them — every expected
 * string and every expected stored value is COMPUTED by importing the same pure module
 * the tab renders from, so this file cannot disagree with the product about what the
 * copy says. What it asserts is that the wiring reaches a real Obsidian: that a
 * keystroke drives the handler, that a refused value is shown under its own row and
 * never persisted, and that the feedback element is the styled error affordance it is
 * meant to be.
 *
 * The debounce window is handled by {@link SettingsWriteWindow} — the pattern other
 * typed-input specs should copy, and the reason there is not a single
 * `waitForTimeout` in this file.
 *
 * Screenshots → `.out/settings-typed-input/` (never source-controlled).
 */

test.describe.configure({ mode: "serial" });

const OUT_DIR = ".out/settings-typed-input";

/** The rows under test, named as the DECLARED model names them (never hand-typed). */
const MAX_PX_CONTROL = sizingNumberControlName("maxPx");
const MIN_PX_CONTROL = sizingNumberControlName("minPx");
const EXCLUSION_PATTERNS_CONTROL = soleRowControlName("exclusion-patterns");

/**
 * The GIVEN pair every sizing test seeds: a valid, unambiguous minimum with plenty of
 * room above it, so a typed maximum can be put clearly BELOW it. Both inside
 * `SIZING_RANGES.maxPx` (`1..400`), which the write path clamps to — a value outside it
 * would be judged for the wrong reason (a cap notice, not an inversion).
 */
const SEEDED_MIN_PX = 40;
const SEEDED_MAX_PX = 160;

/** Accepted: above {@link SEEDED_MIN_PX}, inside the range, so it is stored verbatim. */
const TYPED_VALID_MAX_PX = 200;

/** Refused: a maximum BELOW the seeded minimum — the one cross-field sizing rule. */
const TYPED_INVERTED_MAX_PX = 8;

/** A pattern that compiles, kept in the edit to prove the valid line survives the invalid one. */
const VALID_PATTERN = "^archive/";
/** An unterminated character class — the shortest thing `new RegExp` refuses. */
const INVALID_PATTERN = "[unterminated";
/** What gets typed into the textarea: the invalid line is line TWO, and must be named as such. */
const TYPED_PATTERNS = `${VALID_PATTERN}\n${INVALID_PATTERN}`;

/**
 * Obsidian's own CSS variable for error text. The settings-error rule is declared as
 * `color: var(--text-error)` (`src/view/settings-tab.css`), and "styled as intended"
 * means exactly that: the THEME's error colour, not a hard-coded red that would look
 * wrong in half the themes.
 */
const ERROR_TEXT_CSS_VARIABLE = "--text-error";

/**
 * The feedback slot's declared `white-space`. A message about several bad lines is ONE
 * newline-joined string, so losing this collapses it into an unreadable run-on.
 */
const FEEDBACK_WHITE_SPACE = "pre-line";

let harness: ObsidianHarness;
let page: Page;
let settingsTab: SettingsTabPage;
let writeWindow: SettingsWriteWindow;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
	settingsTab = new SettingsTabPage(page);
	writeWindow = new SettingsWriteWindow(harness, settingsTab);
});

test.afterAll(async () => {
	await harness?.close();
});

/**
 * GIVEN the settings tab open on a known, VALID sizing pair. Seeded through the store
 * and re-rendered, so what the rows show is what is stored — the baseline every
 * "did it persist?" claim below is measured against.
 */
async function givenSizingPairSeeded(): Promise<void> {
	await settingsTab.open();
	const view = await harness.readGlobalView();
	// Spread by hand: `saveGlobalView` merges SHALLOWLY, so `sizing` is replaced whole.
	await harness.saveGlobalView({ sizing: { ...view.sizing, minPx: SEEDED_MIN_PX, maxPx: SEEDED_MAX_PX } });
	await settingsTab.redisplay();
	await expect(settingsTab.control(MAX_PX_CONTROL)).toHaveValue(String(SEEDED_MAX_PX));
}

/** GIVEN the exclusion patterns row open and EDITABLE (it is inert while exclusion is off). */
async function givenExclusionPatternsEditable(): Promise<void> {
	await settingsTab.open();
	await harness.saveNodeExclusion({ enabled: true, patterns: [] });
	await settingsTab.redisplay();
	await expect(settingsTab.control(EXCLUSION_PATTERNS_CONTROL)).toBeEnabled();
}

/**
 * The rejection the product itself would compose for the inverted pair typed below —
 * asked of the STORED sizing with the typed maximum laid over it, which is exactly the
 * prospective value `SizingRowWrite` judges. So this can neither re-type the copy nor
 * judge a pair the tab was not looking at.
 */
async function expectedInversionMessage(): Promise<string> {
	const { sizing } = await harness.readGlobalView();
	const message = describeSizingRejection({ ...sizing, maxPx: TYPED_INVERTED_MAX_PX });
	if (message === undefined) {
		throw new Error(
			`maxPx=${TYPED_INVERTED_MAX_PX} against minPx=${SEEDED_MIN_PX} is no longer an inversion — this spec has nothing to reject`,
		);
	}
	return message;
}

/** The warning the product itself would compose for {@link TYPED_PATTERNS}. */
function expectedInvalidPatternMessage(): string {
	const feedback = describeInvalidExclusionPatterns(TYPED_PATTERNS);
	if (feedback === undefined) {
		throw new Error(`"${INVALID_PATTERN}" now compiles — this spec has no invalid line to name`);
	}
	return feedback.message;
}

/** The computed value of a theme CSS variable, resolved by the LIVE stylesheet cascade. */
async function resolvedThemeColor(cssVariable: string): Promise<string> {
	return settingsTab.root().evaluate((root, variable) => {
		// A throwaway child of the settings root inherits the exact same cascade the
		// feedback slot sits in, so `var()` resolves to what that slot would resolve to.
		const probe = root.ownerDocument.createElement("div");
		probe.style.color = `var(${variable})`;
		root.appendChild(probe);
		const color = getComputedStyle(probe).color;
		probe.remove();
		return color;
	}, cssVariable);
}

/** One resolved CSS property of an element, named as the stylesheet names it. */
async function computedStyleOf(target: Locator, cssProperty: string): Promise<string> {
	return target.evaluate((el, property) => getComputedStyle(el).getPropertyValue(property), cssProperty);
}

test("settings tab: WHEN a valid maximum node size is typed THEN it persists once the settle window drains", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_VALID_MAX_PX));

	// The positive control for every absence claim below: a keystroke DOES reach the
	// store on its own, without a blur, a close or any help from the harness.
	await writeWindow.expectPersisted(
		(globals) => globals.view.sizing.maxPx,
		TYPED_VALID_MAX_PX,
		"a typed maximum node size must persist when the debounce window drains",
	);
});

test("settings tab: WHEN a valid maximum node size is typed THEN the row says nothing", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_VALID_MAX_PX));

	// `:empty { display: none }` is how the slot hides, so "hidden" IS "no message".
	await expect(settingsTab.feedbackUnder(MAX_PX_CONTROL)).toBeHidden();
});

test("settings tab: WHEN an inverted maximum node size is typed THEN the rejection is shown under that row", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_INVERTED_MAX_PX));

	// Located THROUGH the row and its description (see `feedbackUnder`): the message
	// being visible somewhere is not the promise — being visible under the field the
	// user just typed into is.
	await expect(settingsTab.feedbackUnder(MAX_PX_CONTROL)).toHaveText(await expectedInversionMessage());
	await page.screenshot({ path: `${OUT_DIR}/01-inverted-max-rejected.png` });
});

test("settings tab: WHEN an inverted maximum node size is typed THEN the field is marked invalid", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_INVERTED_MAX_PX));

	await expect(settingsTab.control(MAX_PX_CONTROL)).toHaveAttribute("aria-invalid", "true");
});

test("settings tab: WHEN an inverted maximum node size is typed THEN the refused value is never persisted", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_INVERTED_MAX_PX));

	// The absence claim needs a SETTLED store, not a hopeful read: `drain()` returns only
	// once a write scheduled after that keystroke has landed, so a refused value that HAD
	// been scheduled would already be in `data.json` by now.
	await writeWindow.drain();
	await writeWindow.expectPersisted(
		(globals) => globals.view.sizing.maxPx,
		SEEDED_MAX_PX,
		"a REFUSED maximum node size reached the store — the inverted pair was persisted",
	);
	// The typed text is deliberately left in the field (never silently reverted), so this
	// also pins that the store and the input disagree ON PURPOSE.
	await expect(settingsTab.control(MAX_PX_CONTROL)).toHaveValue(String(TYPED_INVERTED_MAX_PX));
});

test("settings tab: WHEN an invalid regex line is typed into the exclusion patterns THEN the feedback names that line", async () => {
	await givenExclusionPatternsEditable();

	await settingsTab.typeInto(EXCLUSION_PATTERNS_CONTROL, TYPED_PATTERNS);

	await expect(settingsTab.feedbackUnder(EXCLUSION_PATTERNS_CONTROL)).toHaveText(expectedInvalidPatternMessage());
	await page.screenshot({ path: `${OUT_DIR}/02-invalid-pattern-named.png` });
});

test("settings tab: WHEN an invalid regex line is typed THEN it is still stored, warning and all", async () => {
	await givenExclusionPatternsEditable();

	await settingsTab.typeInto(EXCLUSION_PATTERNS_CONTROL, TYPED_PATTERNS);

	// The DECLARED policy, not an oversight (`settingsValidation.ts`): an invalid line is
	// SURFACED, never rejected — the engine skips it at match time, and refusing the write
	// would throw away the valid line typed in the same edit. Expected value computed by
	// the product's own parser so this cannot drift from it.
	await writeWindow.expectPersisted(
		(globals) => globals.exclusion.patterns,
		parseExclusionPatterns(TYPED_PATTERNS),
		"a typed pattern list must persist verbatim — invalid lines are surfaced, not dropped",
	);
});

test("settings tab: WHEN a rejection is shown THEN it is coloured as the theme's error text", async () => {
	await givenSizingPairSeeded();
	const errorColor = await resolvedThemeColor(ERROR_TEXT_CSS_VARIABLE);
	// Guards the assertion below against passing on a variable that resolves to nothing:
	// an unset `var()` would leave the slot with plain body text colour, and comparing two
	// inherited colours would be true for the wrong reason.
	const bodyColor = await computedStyleOf(settingsTab.root(), "color");
	expect(errorColor, `${ERROR_TEXT_CSS_VARIABLE} must resolve to a colour of its own`).not.toBe(bodyColor);

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_INVERTED_MAX_PX));

	await expect(settingsTab.feedbackUnder(MAX_PX_CONTROL)).toBeVisible();
	expect(await computedStyleOf(settingsTab.feedbackUnder(MAX_PX_CONTROL), "color")).toBe(errorColor);
});

test("settings tab: WHEN a rejection is shown THEN its line breaks are preserved", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_INVERTED_MAX_PX));

	// A multi-line message (several bad exclusion lines) is one newline-joined string.
	expect(await computedStyleOf(settingsTab.feedbackUnder(MAX_PX_CONTROL), "white-space")).toBe(FEEDBACK_WHITE_SPACE);
});

test("settings tab: WHEN a row has nothing to say THEN its feedback slot takes no space", async () => {
	await givenSizingPairSeeded();

	// The minimum row is untouched and valid, so its slot is empty — and an empty slot
	// must not leave a gap under the row (the CSS `:empty` rule is the whole mechanism by
	// which showing and clearing a message are the same assignment).
	expect(await computedStyleOf(settingsTab.feedbackUnder(MIN_PX_CONTROL), "display")).toBe("none");
});

test("settings tab: WHEN the settings window is closed right after a typed edit THEN the edit is not lost", async () => {
	await givenSizingPairSeeded();

	await settingsTab.typeInto(MAX_PX_CONTROL, String(TYPED_VALID_MAX_PX));
	await settingsTab.close();

	// `hide()` flushes the pending window (`VicinityGraphSettingTab.hide`) so leaving the
	// tab cannot swallow the user's last keystroke.
	//
	// WHY-NOT also assert the write landed FASTER than the settle window (which is what
	// would prove the flush rather than the timer): that is a wall-clock race against a
	// 400ms budget on a machine that is simultaneously running Electron, and a release
	// gate that goes red on load is worse than one claim less. This test therefore pins
	// the USER-visible contract — the edit is not lost — and the flush itself is unit
	// territory (`settingsDebounce.test.ts` owns `flush()`).
	await writeWindow.expectPersisted(
		(globals) => globals.view.sizing.maxPx,
		TYPED_VALID_MAX_PX,
		"closing the settings window lost a typed edit that was still inside the settle window",
	);
});
