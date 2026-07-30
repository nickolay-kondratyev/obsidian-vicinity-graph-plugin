import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import { ObsidianHarness } from "./obsidianHarness";
import { ALL_SETTINGS_RESET_DESCRIPTION, ALL_SETTINGS_RESET_NAME } from "./settingsBaseline";
import { SettingsTabPage } from "./settingsTabPage";

/**
 * UI_IMPLEMENTATION_REVIEW iteration-1 verification, kept as the complement to
 * `settingsResetReview.e2e.ts`: only the claims that suite does NOT pin down.
 *
 * - The confirmation renders user content VERBATIM — regex metacharacters and
 *   markup-ish text must survive as text (a `<b>…</b>` pattern shown as bold
 *   would misrepresent what is about to be deleted).
 * - ESCAPE (not just Cancel) on the exclusion confirmation is a true no-op,
 *   asserted against a whole-store snapshot.
 * - A long pattern list scrolls inside its inset instead of pushing Cancel out
 *   of the viewport — the failure mode that would make the safe exit unreachable.
 * - The reworded tab-wide description (NIT-3) reads correctly on screen in both
 *   themes.
 *
 * The section-isolation matrix and modal keyboard flow live in the review suite
 * and are deliberately NOT duplicated here.
 *
 * Screenshots → `.out/settings-reset-verify/` (never source-controlled).
 */

test.describe.configure({ mode: "serial" });

const OUT_DIR = ".out/settings-reset-verify";

/** Regex-ish + markup-ish on purpose: the list must render these VERBATIM. */
const TRICKY_PATTERNS = ["^archive/.*\\.md$", "<b>templates</b>/", "daily/2024-\\d{2}"];

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

/** Writes the exclusion slice, then re-renders the open tab so its rows follow. */
async function setExclusion(enabled: boolean, patterns: readonly string[]): Promise<void> {
	await harness.saveNodeExclusion({ enabled, patterns });
	await settingsTab.redisplay();
}

// ---------------------------------------------------------------------------
// MAJOR-1
// ---------------------------------------------------------------------------

test("VERIFY: exclusion reset with the textarea COLLAPSED confirms and lists the patterns verbatim", async () => {
	await settingsTab.open();
	await setExclusion(false, TRICKY_PATTERNS);
	// Precondition: the patterns exist but there is NO on-screen surface showing them.
	await expect(settingsTab.card("Node exclusion").locator("textarea")).toHaveCount(0);
	await page.screenshot({ path: `${OUT_DIR}/01-exclusion-collapsed.png` });

	await settingsTab.resetButton("Node exclusion").click();
	await expect(settingsTab.confirmDialog()).toContainText("Restore node exclusion defaults?");
	await expect(settingsTab.confirmDialog()).toContainText("3 exclusion patterns");
	await expect(settingsTab.confirmDialog()).toContainText("This cannot be undone.");
	const listed = await settingsTab.confirmDialog()
		.locator(".vicinity-graph-confirm-items code")
		.evaluateAll((els) => els.map((el) => el.textContent));
	// Verbatim AND in stored order; markup-ish text must survive as text.
	expect(listed).toEqual(TRICKY_PATTERNS);
	await page.screenshot({ path: `${OUT_DIR}/02-exclusion-confirm-collapsed.png` });
	await page.keyboard.press("Escape");
});

test("VERIFY: ESCAPE on the exclusion confirmation is a true no-op", async () => {
	await settingsTab.open();
	await setExclusion(false, TRICKY_PATTERNS);
	const before = await harness.readGlobals();
	await settingsTab.resetButton("Node exclusion").click();
	await expect(settingsTab.confirmDialog()).toContainText("Restore node exclusion defaults?");
	await page.keyboard.press("Escape");
	await expect(settingsTab.openModals()).toHaveCount(1);
	expect(await harness.readGlobals()).toEqual(before);
});

test("VERIFY: CANCEL on the exclusion confirmation is a true no-op", async () => {
	await settingsTab.open();
	await setExclusion(true, TRICKY_PATTERNS);
	const before = await harness.readGlobals();
	await settingsTab.resetButton("Node exclusion").click();
	await settingsTab.dialogButton("Cancel").click();
	await expect(settingsTab.openModals()).toHaveCount(1);
	expect(await harness.readGlobals()).toEqual(before);
	// The textarea still shows the untouched patterns.
	await expect(settingsTab.card("Node exclusion").locator("textarea")).toHaveValue(TRICKY_PATTERNS.join("\n"));
});

test("VERIFY: confirming deletes the patterns and turns exclusion off", async () => {
	await settingsTab.open();
	await setExclusion(false, TRICKY_PATTERNS);
	await settingsTab.resetButton("Node exclusion").click();
	await settingsTab.dialogButton("Delete patterns and restore defaults").click();
	await expect.poll(async () => (await harness.readGlobals()).exclusion).toEqual({ enabled: false, patterns: [] });
});

test("VERIFY: exclusion reset with ZERO patterns applies with no dialog at all", async () => {
	await settingsTab.open();
	await setExclusion(true, []);
	await settingsTab.resetButton("Node exclusion").click();
	await expect.poll(async () => (await harness.readGlobals()).exclusion.enabled).toBe(false);
	// Only Obsidian's own settings window remains — no confirmation was raised.
	await expect(settingsTab.openModals()).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// NIT-3 wording, on screen, both themes
// ---------------------------------------------------------------------------

test("VERIFY: tab-wide description names the survivors and never says 'this tab'", async () => {
	await settingsTab.open();
	const footer = settingsTab.resetAllRow();
	const text = (await footer.textContent()) ?? "";
	// The WHOLE description, derived — stronger than the old hand-copied fragment
	// (which named per-note overrides that no longer exist) and it cannot go stale.
	expect(text).toContain(ALL_SETTINGS_RESET_DESCRIPTION);
	expect(text).not.toContain("this tab");
	expect(text).toContain(ALL_SETTINGS_RESET_NAME);

	await harness.setTheme("light");
	await footer.scrollIntoViewIfNeeded();
	await page.screenshot({ path: `${OUT_DIR}/03-restore-all-copy-light.png` });
	await footer.screenshot({ path: `${OUT_DIR}/04-restore-all-row-light.png` });

	await harness.setTheme("dark");
	await footer.scrollIntoViewIfNeeded();
	await page.screenshot({ path: `${OUT_DIR}/05-restore-all-copy-dark.png` });
	await footer.screenshot({ path: `${OUT_DIR}/06-restore-all-row-dark.png` });
});

test("VERIFY: a long pattern list scrolls instead of pushing Cancel off screen", async () => {
	await settingsTab.open();
	const many = Array.from({ length: 40 }, (_, i) => `folder-${i}/very/long/path/segment/pattern-${i}\\.md$`);
	await setExclusion(false, many);
	await settingsTab.resetButton("Node exclusion").click();
	const list = settingsTab.confirmDialog().locator(".vicinity-graph-confirm-items");
	await expect(list).toBeVisible();
	const scrolls = await list.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
	expect(scrolls).toBe(true);
	// Cancel must still be reachable inside the viewport.
	const cancel = settingsTab.dialogButton("Cancel");
	await expect(cancel).toBeInViewport();
	await page.screenshot({ path: `${OUT_DIR}/08-exclusion-confirm-long-list.png` });
	await page.keyboard.press("Escape");
	await setExclusion(false, []);
});

test("VERIFY: the confirmation renders legibly in dark theme", async () => {
	await settingsTab.open();
	await setExclusion(false, TRICKY_PATTERNS);
	await settingsTab.resetButton("Node exclusion").click();
	await expect(settingsTab.confirmDialog()).toContainText("Restore node exclusion defaults?");
	await page.screenshot({ path: `${OUT_DIR}/07-exclusion-confirm-dark.png` });
	await page.keyboard.press("Escape");
	await harness.setTheme("light");
});
