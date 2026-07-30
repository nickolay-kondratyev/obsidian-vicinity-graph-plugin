import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import { ObsidianHarness } from "./obsidianHarness";
import { SettingsTabPage } from "./settingsTabPage";
import { SIZING_METRICS } from "../src/view/sizingMetrics";

/**
 * Ticket `nid_9k11zke41l6ze3p7n7suuo4v2_e`: the settings tab's two DEPENDENT
 * controls — the exclusion-patterns textarea and each sizing metric's weight input
 * — used to be refreshed by calling `display()`, which empties `containerEl` and
 * rebuilds all six cards. That is invisible in a screenshot and invisible to every
 * other spec, but it costs the user their scroll position and their keyboard focus
 * on every flip.
 *
 * Since `nid_qp56jugz8en8wkgjirwcb269p_e` BOTH are the same shape: the dependent
 * control is always rendered and merely toggles `disabled` (declared as
 * `disabledWhen` in `src/view/settingsRows.ts`), so both tests below assert node
 * IDENTITY across the flip.
 *
 * So each test here asserts the same three things across ONE toggle, and they are
 * the only assertions that can tell a targeted update from a rebuild:
 *  1. `document.activeElement` is still the control it was;
 *  2. the tab's scroll offset is unchanged;
 *  3. an UNRELATED row's DOM node is the SAME node (see {@link IDENTITY_PROBE}).
 *
 * A SEPARATE spec from `settingsUxVisual.e2e.ts` on purpose: that file is serial
 * and its tests hand state to each other, while these need a deliberately scrolled
 * and focused tab as their GIVEN.
 *
 * Screenshots → `.out/settings-dependent-rows/` (never source-controlled).
 */

test.describe.configure({ mode: "serial" });

const OUT_DIR = ".out/settings-dependent-rows";

/**
 * The unrelated control that carries focus and the identity probe. In the
 * Performance card — a DIFFERENT card from either toggle under test, so nothing
 * about the row being updated can legitimately touch it.
 */
const UNRELATED_CONTROL_LABEL = "Node cap";

/**
 * The sizing metric whose weight input is driven by its toggle — the first one the
 * card renders. Read from the shared table rather than re-typed, so a renamed metric
 * fails HERE instead of drifting. Unwrapped with an explicit throw because
 * `noUncheckedIndexedAccess` makes `[0]` optional and an empty table is a bug, not a
 * reason to silently skip.
 */
const METRIC_UNDER_TEST = SIZING_METRICS[0];
if (METRIC_UNDER_TEST === undefined) {
	throw new Error("SIZING_METRICS is empty — the Node sizing card has no metric row to exercise");
}

/**
 * How far to scroll the tab before flipping a toggle. Deep enough that a rebuild's
 * reset to 0 is unmistakable, and shallow enough to stay clear of the browser
 * CLAMPING the offset against a shorter document — a clamp would fail this test for
 * a reason that is not a rebuild. (No row changes height any more; kept modest
 * anyway, since the tab's total height is not this test's business.)
 */
const SCROLL_OFFSET_PX = 200;

/**
 * A property (never an attribute) stamped onto a DOM node so a later read can ask
 * "is this the same node?". Properties do not survive `containerEl.empty()` +
 * rebuild, and they are not serialised anywhere, so reading one back is a direct
 * test of node identity — which is exactly the difference between updating one row
 * and re-rendering the tab.
 */
const IDENTITY_PROBE = "__vicinityGraphIdentityProbe";

let harness: ObsidianHarness;
let page: Page;
let settingsTab: SettingsTabPage;

test.beforeAll(async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	harness = await ObsidianHarness.launch();
	page = harness.page;
	settingsTab = new SettingsTabPage(page);
});

test.afterAll(async () => {
	await harness?.close();
});

// The tab root, a named control and the row holding it all live on `SettingsTabPage`
// now — this spec was where those three locators were written first, and a second
// typed-input spec needing the same three is what made them the page object's.

/** The plugin's root element in the settings modal — also the tab's scroll container. */
function settingsRoot(): Locator {
	return settingsTab.root();
}

/** A control anywhere in the tab, by the accessible name the tab gives it. */
function control(accessibleName: string): Locator {
	return settingsTab.control(accessibleName);
}

/** The `.setting-item` row that holds `control` — a row is addressed by what it contains. */
function rowHolding(accessibleName: string): Locator {
	return settingsTab.rowHolding(accessibleName);
}

/**
 * Obsidian's toggle is a hidden checkbox inside `.checkbox-container`. Clicked
 * PROGRAMMATICALLY on purpose: a real pointer click would move focus to the toggle
 * itself, which would destroy the very thing these tests measure.
 */
async function flipToggleIn(row: Locator): Promise<void> {
	await row.locator(".checkbox-container input").evaluate((el) => (el as HTMLInputElement).click());
}

async function markIdentity(target: Locator): Promise<void> {
	await target.evaluate((el, key) => {
		(el as unknown as Record<string, boolean>)[key] = true;
	}, IDENTITY_PROBE);
}

/** TRUE only if the element matching `target` is the very node {@link markIdentity} stamped. */
async function isSameNodeAsMarked(target: Locator): Promise<boolean> {
	return target.evaluate((el, key) => (el as unknown as Record<string, boolean>)[key] === true, IDENTITY_PROBE);
}

/** The `aria-label` of whatever currently holds focus, or `null` when nothing named does. */
async function focusedControlName(): Promise<string | null> {
	return page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
}

async function scrollTabTo(offsetPx: number): Promise<number> {
	return settingsRoot().evaluate((el, offset) => {
		el.scrollTop = offset;
		return el.scrollTop;
	}, offsetPx);
}

async function tabScrollTop(): Promise<number> {
	return settingsRoot().evaluate((el) => el.scrollTop);
}

/**
 * The GIVEN both tests share: an unrelated control focused and probed, and the tab
 * scrolled away from the top. Returns the offset the browser actually accepted.
 *
 * The offset is ASSERTED non-zero rather than assumed: if the tab were ever short
 * enough not to scroll, `scrollTop` would be 0 before and after the flip and the
 * scroll assertion would pass by matching nothing.
 */
async function givenTabScrolledAndFocusedElsewhere(): Promise<number> {
	const unrelated = control(UNRELATED_CONTROL_LABEL);
	await markIdentity(unrelated);
	await unrelated.focus();
	const offset = await scrollTabTo(SCROLL_OFFSET_PX);
	expect(offset, "the settings tab must be taller than its viewport for this test to mean anything").toBeGreaterThan(
		0,
	);
	return offset;
}

/** The three "nothing else moved" claims, asserted together because they fail together. */
async function expectTabUndisturbed(offset: number): Promise<void> {
	expect(await focusedControlName(), "focus must survive a dependent-row update").toBe(UNRELATED_CONTROL_LABEL);
	expect(await tabScrollTop(), "scroll position must survive a dependent-row update").toBe(offset);
	expect(
		await isSameNodeAsMarked(control(UNRELATED_CONTROL_LABEL)),
		"an unrelated row was rebuilt — the tab was re-rendered instead of the one dependent row",
	).toBe(true);
}

/** The stored patterns the exclusion tests seed, so a re-shown row has something to re-seed FROM. */
const SEEDED_PATTERNS = ["^archive/"];

/**
 * The flip must still be PERSISTED, not merely painted. Asserted separately from the
 * row's appearance because the two now come from different halves of the handler: the
 * row updates optimistically, the write lands after an await. Without this, deleting
 * the write from either handler would leave every assertion above it green.
 *
 * `expect.poll` rather than a bare read: the handler's `saveData` is still in flight
 * when the DOM assertions resolve.
 */
async function expectExclusionPersisted(enabled: boolean): Promise<void> {
	await expect
		.poll(async () => (await harness.readGlobals()).exclusion.enabled, {
			message: "the exclusion toggle must persist, not just repaint its row",
		})
		.toBe(enabled);
}

// An arrow const, not a `function` declaration: a hoisted declaration is callable
// before the throw above, so TS would not see `METRIC_UNDER_TEST` as narrowed.
const expectMetricEnabledPersisted = async (enabled: boolean): Promise<void> => {
	await expect
		.poll(async () => (await harness.readGlobalView()).sizing.metrics[METRIC_UNDER_TEST.id]?.enabled, {
			message: "the metric toggle must persist, not just disable its weight input",
		})
		.toBe(enabled);
};

test("settings tab: WHEN the exclusion toggle is switched off THEN its patterns row is disabled in place, keeping scroll and focus", async () => {
	await settingsTab.open();
	await harness.saveNodeExclusion({ enabled: true, patterns: SEEDED_PATTERNS });
	await settingsTab.redisplay();
	const card = settingsTab.card("Node exclusion");
	// The card holds exactly one toggle, so `flipToggleIn` needs no finer scope.
	const textarea = card.locator("textarea");
	await expect(textarea).toBeEnabled();
	// Probed too: the textarea must be DISABLED, not torn down and rebuilt — the same
	// claim the sizing-metric test below makes about its weight input. Since
	// `nid_qp56jugz8en8wkgjirwcb269p_e` this row is never removed, so its identity
	// across the flip is the whole assertion.
	await markIdentity(textarea);
	const offset = await givenTabScrolledAndFocusedElsewhere();

	await flipToggleIn(card);

	await expect(textarea).toBeDisabled();
	expect(await isSameNodeAsMarked(textarea), "the patterns textarea was rebuilt instead of disabled in place").toBe(
		true,
	);
	await expectExclusionPersisted(false);
	await expectTabUndisturbed(offset);
	await page.screenshot({ path: `${OUT_DIR}/01-exclusion-off-scroll-kept.png` });
});

test("settings tab: WHEN the exclusion toggle is switched back on THEN the patterns row is re-enabled with its stored value", async () => {
	await settingsTab.open();
	await harness.saveNodeExclusion({ enabled: false, patterns: SEEDED_PATTERNS });
	await settingsTab.redisplay();
	const card = settingsTab.card("Node exclusion");
	const textarea = card.locator("textarea");
	await expect(textarea).toBeDisabled();
	// Seeded from the store even while inert, so switching exclusion on reveals the
	// real patterns rather than an empty field the user would have to retype.
	await expect(textarea).toHaveValue(SEEDED_PATTERNS.join("\n"));
	await markIdentity(textarea);
	const offset = await givenTabScrolledAndFocusedElsewhere();

	await flipToggleIn(card);

	await expect(textarea).toBeEnabled();
	await expect(textarea).toHaveValue(SEEDED_PATTERNS.join("\n"));
	expect(await isSameNodeAsMarked(textarea), "the patterns textarea was rebuilt instead of re-enabled in place").toBe(
		true,
	);
	await expectExclusionPersisted(true);
	await expectTabUndisturbed(offset);
	await page.screenshot({ path: `${OUT_DIR}/02-exclusion-on-scroll-kept.png` });
});

test("settings tab: WHEN a sizing metric is switched off THEN its weight input is disabled in place, keeping scroll and focus", async () => {
	await settingsTab.open();
	const view = await harness.readGlobalView();
	const metrics = view.sizing.metrics;
	// GIVEN the metric is ON — the flip below must be a genuine on→off, whatever an
	// earlier run left behind. Spread by hand: `saveGlobalView` merges SHALLOWLY.
	await harness.saveGlobalView({
		sizing: {
			...view.sizing,
			metrics: { ...metrics, [METRIC_UNDER_TEST.id]: { ...metrics[METRIC_UNDER_TEST.id], enabled: true } },
		},
	});
	await settingsTab.redisplay();
	const weightLabel = `${METRIC_UNDER_TEST.label} weight`;
	const weight = control(weightLabel);
	await expect(weight).toBeEnabled();
	// Probed too: the weight input must be DISABLED, not rebuilt — that is the whole
	// difference between flipping one component and re-rendering its card.
	await markIdentity(weight);
	const offset = await givenTabScrolledAndFocusedElsewhere();

	await flipToggleIn(rowHolding(weightLabel));

	await expect(weight).toBeDisabled();
	expect(await isSameNodeAsMarked(weight), "the weight input was rebuilt instead of disabled in place").toBe(true);
	// Also settles the handler before `expectTabUndisturbed` measures the tab: the
	// disabled assertion above can resolve while `applySizing` is still in flight, so
	// without this the "nothing else moved" claim would be measuring a half-run handler.
	await expectMetricEnabledPersisted(false);
	await expectTabUndisturbed(offset);
	await page.screenshot({ path: `${OUT_DIR}/03-sizing-metric-off-scroll-kept.png` });
});
