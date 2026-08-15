import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import { SettingsRowNames, settingsRowsFor } from "../src/view/settingsRows";
import type { SettingsRowControlKind } from "../src/view/settingsRows";
import { ObsidianHarness } from "./obsidianHarness";
import { SettingsTabPage } from "./settingsTabPage";

/**
 * Ticket `nid_9k11zke41l6ze3p7n7suuo4v2_e`: the settings tab's DEPENDENT control
 * — the exclusion-patterns textarea — used to be refreshed by calling
 * `display()`, which empties `containerEl` and rebuilds all six cards. That is
 * invisible in a screenshot and invisible to every other spec, but it costs the
 * user their scroll position and their keyboard focus on every flip.
 *
 * Since `nid_qp56jugz8en8wkgjirwcb269p_e` the shape is: the dependent control is
 * always rendered and merely toggles `disabled` (declared as `disabledWhen` in
 * `src/view/settingsRows.ts`), so the tests below assert node IDENTITY across
 * the flip. (The sizing-metric weight rows this spec also covered were REMOVED
 * with the content-fit sizing rework, nid_cx5zoz7ptucg9nxalibv0mbjb_e.) The
 * `disabledWhen` rows today: the exclusion patterns list (master: the exclusion
 * toggle) and the two dependent Grouping rows (master: the "Folder grouping
 * depth" slider — ticket nid_dqu2jc1kln9ltwzy3lxxocdw7_e).
 *
 * So each test here asserts the same three things across ONE master flip, and they are
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

test("settings tab: WHEN the exclusion toggle is switched off THEN its patterns row is disabled in place, keeping scroll and focus", async () => {
	await settingsTab.open();
	await harness.saveNodeExclusion({ enabled: true, patterns: SEEDED_PATTERNS });
	await settingsTab.redisplay();
	const card = settingsTab.card("Node exclusion");
	// The card holds exactly one toggle, so `flipToggleIn` needs no finer scope.
	const textarea = card.locator("textarea");
	await expect(textarea).toBeEnabled();
	// Probed too: the textarea must be DISABLED, not torn down and rebuilt. Since
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

/* ========================================================================== *
 * The Grouping card's dependent rows (master: the Folder grouping depth slider)
 * ========================================================================== */

/** The declared accessible name of a Grouping-card row — the model's copy, never retyped. */
function declaredName(kind: SettingsRowControlKind): string {
	const [row] = settingsRowsFor(kind);
	if (row === undefined) {
		throw new Error(`the declared model has no ${kind} row`);
	}
	return SettingsRowNames.sole(row);
}

/** A depth with grouping ON — any value ≥ 1 re-enables the dependent rows. */
const GROUPING_ON_DEPTH = 2;

/**
 * Drives the tab's "Folder grouping depth" SLIDER — the real master gesture, so the
 * dependent verdicts flow through the tab's own onChange (write, then the
 * authoritative `applyRowDependencies` pass). Set through the native value setter,
 * then BOTH `input` and `change` events: Obsidian's `SliderComponent` decides which
 * of the two fires `onChange` (`setInstant`), and dispatching both keeps this helper
 * agnostic to that choice. Programmatic on purpose — a pointer drag would move
 * focus, destroying what {@link expectTabUndisturbed} measures.
 */
async function setFolderGroupingDepthSlider(value: number): Promise<void> {
	const slider = control(declaredName("folder-grouping-depth"));
	await slider.evaluate((el, next) => {
		const input = el as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		setter?.call(input, String(next));
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, value);
	await expect(slider).toHaveValue(String(value));
}

/** Like {@link expectExclusionPersisted}: the slider write must land in the store, not just paint. */
async function expectGroupingDepthPersisted(depth: number): Promise<void> {
	await expect
		.poll(async () => (await harness.readGlobalView()).folderGroupingDepth, {
			message: "the folder grouping depth slider must persist, not just repaint its dependents",
		})
		.toBe(depth);
}

test("settings tab: WHEN Folder grouping depth is set to 0 THEN both dependent grouping rows are disabled in place, keeping scroll and focus", async () => {
	await settingsTab.open();
	await harness.saveGlobalView({ folderGroupingDepth: GROUPING_ON_DEPTH });
	await settingsTab.redisplay();
	const fullPathToggle = control(declaredName("group-label-full-path"));
	const edgeDepthSlider = control(declaredName("edge-depth-into-groups"));
	await expect(fullPathToggle).toBeEnabled();
	await expect(edgeDepthSlider).toBeEnabled();
	await markIdentity(fullPathToggle);
	await markIdentity(edgeDepthSlider);
	const offset = await givenTabScrolledAndFocusedElsewhere();

	await setFolderGroupingDepthSlider(0);

	await expect(fullPathToggle).toBeDisabled();
	await expect(edgeDepthSlider).toBeDisabled();
	expect(await isSameNodeAsMarked(fullPathToggle), "the full-path toggle was rebuilt instead of disabled in place").toBe(
		true,
	);
	expect(
		await isSameNodeAsMarked(edgeDepthSlider),
		"the edge-depth slider was rebuilt instead of disabled in place",
	).toBe(true);
	await expectGroupingDepthPersisted(0);
	await expectTabUndisturbed(offset);
	await page.screenshot({ path: `${OUT_DIR}/03-grouping-off-rows-disabled.png` });
});

test("settings tab: WHEN Folder grouping depth leaves 0 THEN both dependent grouping rows are re-enabled in place", async () => {
	await settingsTab.open();
	await harness.saveGlobalView({ folderGroupingDepth: 0 });
	await settingsTab.redisplay();
	const fullPathToggle = control(declaredName("group-label-full-path"));
	const edgeDepthSlider = control(declaredName("edge-depth-into-groups"));
	await expect(fullPathToggle).toBeDisabled();
	await expect(edgeDepthSlider).toBeDisabled();
	await markIdentity(fullPathToggle);
	await markIdentity(edgeDepthSlider);
	const offset = await givenTabScrolledAndFocusedElsewhere();

	await setFolderGroupingDepthSlider(GROUPING_ON_DEPTH);

	await expect(fullPathToggle).toBeEnabled();
	await expect(edgeDepthSlider).toBeEnabled();
	expect(
		await isSameNodeAsMarked(fullPathToggle),
		"the full-path toggle was rebuilt instead of re-enabled in place",
	).toBe(true);
	expect(
		await isSameNodeAsMarked(edgeDepthSlider),
		"the edge-depth slider was rebuilt instead of re-enabled in place",
	).toBe(true);
	await expectGroupingDepthPersisted(GROUPING_ON_DEPTH);
	await expectTabUndisturbed(offset);
	await page.screenshot({ path: `${OUT_DIR}/04-grouping-on-rows-enabled.png` });
});
