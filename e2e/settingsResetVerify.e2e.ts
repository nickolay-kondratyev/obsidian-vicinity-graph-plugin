import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

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

test.beforeAll(async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	harness = await ObsidianHarness.launch();
	page = harness.page;
});

test.afterAll(async () => {
	await harness?.close();
});

function readGlobals(): Promise<any> {
	return page.evaluate((pluginId) => {
		const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
		return { view: store.globalView(), depths: store.globalDepths(), exclusion: store.nodeExclusion() };
	}, PLUGIN_ID);
}

async function openSettingsTab(): Promise<void> {
	await page.evaluate((pluginId) => {
		const app = (window as any).app;
		app.setting.open();
		app.setting.openTabById(pluginId);
	}, PLUGIN_ID);
	await expect(page.locator(".vicinity-graph-settings-section")).toHaveCount(6);
}

function card(headingText: string): Locator {
	return page.locator(".vicinity-graph-settings-section", { hasText: headingText });
}

function resetButton(headingText: string): Locator {
	return card(headingText).locator(".vicinity-graph-settings-reset button");
}

/** Obsidian's settings window is itself a `.modal-container`; ours is the last. */
function confirmDialog(): Locator {
	return page.locator(".modal-container").last();
}

async function setExclusion(enabled: boolean, patterns: readonly string[]): Promise<void> {
	await page.evaluate(
		async ({ pluginId, enabled, patterns }) => {
			const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
			await store.saveNodeExclusion({ enabled, patterns });
			(window as any).app.setting.activeTab?.display();
		},
		{ pluginId: PLUGIN_ID, enabled, patterns },
	);
}

// ---------------------------------------------------------------------------
// MAJOR-1
// ---------------------------------------------------------------------------

test("VERIFY: exclusion reset with the textarea COLLAPSED confirms and lists the patterns verbatim", async () => {
	await openSettingsTab();
	await setExclusion(false, TRICKY_PATTERNS);
	// Precondition: the patterns exist but there is NO on-screen surface showing them.
	await expect(card("Node exclusion").locator("textarea")).toHaveCount(0);
	await page.screenshot({ path: `${OUT_DIR}/01-exclusion-collapsed.png` });

	await resetButton("Node exclusion").click();
	await expect(confirmDialog()).toContainText("Restore node exclusion defaults?");
	await expect(confirmDialog()).toContainText("3 exclusion patterns");
	await expect(confirmDialog()).toContainText("This cannot be undone.");
	const listed = await confirmDialog()
		.locator(".vicinity-graph-confirm-items code")
		.evaluateAll((els) => els.map((el) => el.textContent));
	// Verbatim AND in stored order; markup-ish text must survive as text.
	expect(listed).toEqual(TRICKY_PATTERNS);
	await page.screenshot({ path: `${OUT_DIR}/02-exclusion-confirm-collapsed.png` });
	await page.keyboard.press("Escape");
});

test("VERIFY: ESCAPE on the exclusion confirmation is a true no-op", async () => {
	await openSettingsTab();
	await setExclusion(false, TRICKY_PATTERNS);
	const before = await readGlobals();
	await resetButton("Node exclusion").click();
	await expect(confirmDialog()).toContainText("Restore node exclusion defaults?");
	await page.keyboard.press("Escape");
	await expect(page.locator(".modal-container")).toHaveCount(1);
	expect(await readGlobals()).toEqual(before);
});

test("VERIFY: CANCEL on the exclusion confirmation is a true no-op", async () => {
	await openSettingsTab();
	await setExclusion(true, TRICKY_PATTERNS);
	const before = await readGlobals();
	await resetButton("Node exclusion").click();
	await confirmDialog().locator("button").filter({ hasText: "Cancel" }).click();
	await expect(page.locator(".modal-container")).toHaveCount(1);
	expect(await readGlobals()).toEqual(before);
	// The textarea still shows the untouched patterns.
	await expect(card("Node exclusion").locator("textarea")).toHaveValue(TRICKY_PATTERNS.join("\n"));
});

test("VERIFY: confirming deletes the patterns and turns exclusion off", async () => {
	await openSettingsTab();
	await setExclusion(false, TRICKY_PATTERNS);
	await resetButton("Node exclusion").click();
	await confirmDialog().locator("button").filter({ hasText: "Delete patterns and restore defaults" }).click();
	await expect.poll(async () => (await readGlobals()).exclusion).toEqual({ enabled: false, patterns: [] });
});

test("VERIFY: exclusion reset with ZERO patterns applies with no dialog at all", async () => {
	await openSettingsTab();
	await setExclusion(true, []);
	await resetButton("Node exclusion").click();
	await expect.poll(async () => (await readGlobals()).exclusion.enabled).toBe(false);
	// Only Obsidian's own settings window remains — no confirmation was raised.
	await expect(page.locator(".modal-container")).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// NIT-3 wording, on screen, both themes
// ---------------------------------------------------------------------------

async function setTheme(theme: "moonstone" | "obsidian"): Promise<void> {
	await page.evaluate((t) => (window as any).app.customCss.setTheme?.(t) ?? (window as any).app.changeTheme(t), theme);
	await page.waitForTimeout(200);
}

test("VERIFY: tab-wide description names the survivors and never says 'this tab'", async () => {
	await openSettingsTab();
	const footer = page.locator(".vicinity-graph-settings-reset-all");
	const text = (await footer.textContent()) ?? "";
	expect(text).toContain("Per-note depth overrides and pinned notes are kept.");
	expect(text).not.toContain("this tab");
	expect(text).toContain("Restore all Vicinity Graph settings");

	await setTheme("moonstone");
	await footer.scrollIntoViewIfNeeded();
	await page.screenshot({ path: `${OUT_DIR}/03-restore-all-copy-light.png` });
	await footer.screenshot({ path: `${OUT_DIR}/04-restore-all-row-light.png` });

	await setTheme("obsidian");
	await footer.scrollIntoViewIfNeeded();
	await page.screenshot({ path: `${OUT_DIR}/05-restore-all-copy-dark.png` });
	await footer.screenshot({ path: `${OUT_DIR}/06-restore-all-row-dark.png` });
});

test("VERIFY: a long pattern list scrolls instead of pushing Cancel off screen", async () => {
	await openSettingsTab();
	const many = Array.from({ length: 40 }, (_, i) => `folder-${i}/very/long/path/segment/pattern-${i}\\.md$`);
	await setExclusion(false, many);
	await resetButton("Node exclusion").click();
	const list = confirmDialog().locator(".vicinity-graph-confirm-items");
	await expect(list).toBeVisible();
	const scrolls = await list.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
	expect(scrolls).toBe(true);
	// Cancel must still be reachable inside the viewport.
	const cancel = confirmDialog().locator("button").filter({ hasText: "Cancel" });
	await expect(cancel).toBeInViewport();
	await page.screenshot({ path: `${OUT_DIR}/08-exclusion-confirm-long-list.png` });
	await page.keyboard.press("Escape");
	await setExclusion(false, []);
});

test("VERIFY: the confirmation renders legibly in dark theme", async () => {
	await openSettingsTab();
	await setExclusion(false, TRICKY_PATTERNS);
	await resetButton("Node exclusion").click();
	await expect(confirmDialog()).toContainText("Restore node exclusion defaults?");
	await page.screenshot({ path: `${OUT_DIR}/07-exclusion-confirm-dark.png` });
	await page.keyboard.press("Escape");
	await setTheme("moonstone");
});
