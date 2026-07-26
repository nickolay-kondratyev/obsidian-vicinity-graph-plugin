import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";
import {
	ALL_SETTINGS_RESET_CONFIRM_TITLE,
	EVERY_SETTINGS_RESET_NAME,
	SETTINGS_TAB_SECTIONS,
} from "./settingsBaseline";

/**
 * UI_IMPLEMENTATION_REVIEW spec for the restore-defaults affordances
 * (commit 3c86c7f). Goes past the feature spec: full cross-section isolation
 * matrix, confirm-modal keyboard operability, persistence across a settings-tab
 * reopen AND a plugin reload, and narrow-width / dark-theme visual evidence.
 *
 * Screenshots land in `.out/settings-reset-review/` (never source-controlled).
 */

test.describe.configure({ mode: "serial" });

const OUT_DIR = ".out/settings-reset-review";

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

interface Globals {
	readonly view: {
		readonly nodeCap: number;
		readonly outlineMaxDepth: number;
		readonly nodePreviewPreference: string;
		readonly groupByFolder: boolean;
		readonly edgeVisibility: string;
		readonly sizing: { readonly minPx: number; readonly maxPx: number; readonly depthDecayK: number };
		readonly forceLayout: { readonly repelStrength: number; readonly collidePaddingPx: number };
	};
	readonly depths: { readonly outgoingDepth: number; readonly incomingDepth: number };
	readonly exclusion: { readonly enabled: boolean; readonly patterns: readonly string[] };
}

function readGlobals(): Promise<Globals> {
	return page.evaluate((pluginId) => {
		const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
		return { view: store.globalView(), depths: store.globalDepths(), exclusion: store.nodeExclusion() };
	}, PLUGIN_ID);
}

/** Puts EVERY section into a non-default state, then re-renders the tab. */
async function dirtyEverySection(): Promise<void> {
	await page.evaluate(async (pluginId) => {
		const plugin = (window as any).app.plugins.plugins[pluginId];
		const store = plugin.pluginDataStore;
		await store.saveGlobalDepths({ outgoingDepth: 4, incomingDepth: 3 });
		const view = store.globalView();
		await store.saveGlobalView({
			...view,
			nodeCap: 42,
			outlineMaxDepth: 5,
			// The Node contents card's SECOND field. A non-default here is what makes
			// every "…and left the preference dirty" assertion below non-vacuous.
			nodePreviewPreference: "image",
			sizing: { ...view.sizing, minPx: 11, maxPx: 99, depthDecayK: 0.75 },
			forceLayout: { ...view.forceLayout, repelStrength: 800, collidePaddingPx: 77 },
		});
		await store.saveNodeExclusion({ enabled: true, patterns: ["^archive/", "templates/"] });
		(window as any).app.setting.activeTab?.display();
	}, PLUGIN_ID);
}

async function openSettingsTab(): Promise<void> {
	await page.evaluate((pluginId) => {
		const app = (window as any).app;
		app.setting.open();
		app.setting.openTabById(pluginId);
	}, PLUGIN_ID);
	await expect(page.locator(".vicinity-graph-settings-section")).toHaveCount(SETTINGS_TAB_SECTIONS.length);
}

function card(headingText: string): Locator {
	return page.locator(".vicinity-graph-settings-section", { hasText: headingText });
}

function resetButton(headingText: string): Locator {
	return card(headingText).locator(".vicinity-graph-settings-reset button");
}

/**
 * Obsidian's settings window is ITSELF a `.modal-container`, so the confirmation
 * is always the LAST one (a plain `.modal-container` locator is a strict-mode
 * violation here).
 */
function confirmDialog(): Locator {
	return page.locator(".modal-container").last();
}

function dialogButton(text: string): Locator {
	return confirmDialog().locator("button").filter({ hasText: text });
}

test("REVIEW: isolation matrix — each section reset touches only its own keys", async () => {
	await openSettingsTab();

	// --- Depth defaults -----------------------------------------------------
	await dirtyEverySection();
	await resetButton("Depth defaults").click();
	let after = await readGlobals();
	expect(after.depths).toEqual({ outgoingDepth: 1, incomingDepth: 1 });
	expect(after.view.nodeCap).toBe(42);
	expect(after.view.sizing.minPx).toBe(11);
	expect(after.view.forceLayout.repelStrength).toBe(800);
	expect(after.view.outlineMaxDepth).toBe(5);
	expect(after.view.nodePreviewPreference).toBe("image");
	expect(after.exclusion.patterns).toEqual(["^archive/", "templates/"]);

	// --- Node sizing --------------------------------------------------------
	await dirtyEverySection();
	await resetButton("Node sizing").click();
	after = await readGlobals();
	expect(after.view.sizing.minPx).not.toBe(11);
	expect(after.view.sizing.maxPx).not.toBe(99);
	expect(after.view.sizing.depthDecayK).not.toBe(0.75);
	expect(after.depths.outgoingDepth).toBe(4);
	expect(after.view.nodeCap).toBe(42);
	expect(after.view.forceLayout.repelStrength).toBe(800);
	// Node CONTENTS is the adjacent card and shares the `global-view` slice with
	// sizing — the pairing most likely to reset each other by accident.
	expect(after.view.outlineMaxDepth).toBe(5);
	expect(after.view.nodePreviewPreference).toBe("image");
	expect(after.exclusion.enabled).toBe(true);

	// --- Node contents ------------------------------------------------------
	await dirtyEverySection();
	await resetButton("Node contents").click();
	after = await readGlobals();
	expect(after.view.outlineMaxDepth).toBe(2);
	// The card resets BOTH its fields in one write — depth alone would be a half fix.
	expect(after.view.nodePreviewPreference).toBe("auto");
	expect(after.depths.outgoingDepth).toBe(4);
	expect(after.view.nodeCap).toBe(42);
	expect(after.view.sizing.minPx).toBe(11);
	expect(after.view.forceLayout.repelStrength).toBe(800);
	expect(after.exclusion.enabled).toBe(true);

	// --- Force layout -------------------------------------------------------
	await dirtyEverySection();
	await resetButton("Force layout").click();
	after = await readGlobals();
	expect(after.view.forceLayout.repelStrength).not.toBe(800);
	expect(after.view.forceLayout.collidePaddingPx).not.toBe(77);
	expect(after.depths.outgoingDepth).toBe(4);
	expect(after.view.nodeCap).toBe(42);
	expect(after.view.sizing.minPx).toBe(11);
	expect(after.view.outlineMaxDepth).toBe(5);
	expect(after.view.nodePreviewPreference).toBe("image");
	expect(after.exclusion.enabled).toBe(true);

	// --- Node exclusion -----------------------------------------------------
	await dirtyEverySection();
	await resetButton("Node exclusion").click();
	// The only section reset that destroys content → it confirms first.
	await dialogButton("Delete patterns and restore defaults").click();
	await expect.poll(async () => (await readGlobals()).exclusion.patterns).toEqual([]);
	after = await readGlobals();
	expect(after.exclusion).toEqual({ enabled: false, patterns: [] });
	expect(after.depths.outgoingDepth).toBe(4);
	expect(after.view.nodeCap).toBe(42);
	expect(after.view.sizing.minPx).toBe(11);
	expect(after.view.forceLayout.repelStrength).toBe(800);
	expect(after.view.outlineMaxDepth).toBe(5);
	expect(after.view.nodePreviewPreference).toBe("image");

	// --- Performance --------------------------------------------------------
	await dirtyEverySection();
	await resetButton("Performance").click();
	after = await readGlobals();
	expect(after.view.nodeCap).toBe(100);
	expect(after.depths.outgoingDepth).toBe(4);
	expect(after.view.sizing.minPx).toBe(11);
	expect(after.view.forceLayout.repelStrength).toBe(800);
	expect(after.view.outlineMaxDepth).toBe(5);
	expect(after.view.nodePreviewPreference).toBe("image");
	expect(after.exclusion.enabled).toBe(true);
});

test("REVIEW: every reset control has a distinct accessible name", async () => {
	await openSettingsTab();
	const names = await page
		.locator(".vicinity-graph-settings button")
		.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
	const resetNames = names.filter((name): name is string => name?.startsWith("Restore") === true);
	expect(resetNames).toEqual(EVERY_SETTINGS_RESET_NAME);
	expect(new Set(resetNames).size).toBe(resetNames.length);
});

test("REVIEW: section reset re-renders the tab so displayed values actually move", async () => {
	await openSettingsTab();
	await dirtyEverySection();
	const nodeCap = card("Performance").locator("input[type=number]");
	await expect(nodeCap).toHaveValue("42");
	await resetButton("Performance").click();
	await expect(nodeCap).toHaveValue("100");
});

/** Puts the tab in the state where patterns exist but the textarea is hidden. */
async function storeHiddenPatterns(): Promise<void> {
	await page.evaluate(async (pluginId) => {
		const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
		// Disabled + patterns kept: the tab hides the textarea in this state.
		await store.saveNodeExclusion({ enabled: false, patterns: ["^archive/", "templates/"] });
		(window as any).app.setting.activeTab?.display();
	}, PLUGIN_ID);
	await expect(card("Node exclusion").locator("textarea")).toHaveCount(0);
}

test("REVIEW: exclusion reset shows the hidden patterns it is about to delete", async () => {
	await openSettingsTab();
	await storeHiddenPatterns();
	await page.screenshot({ path: `${OUT_DIR}/exclusion-disabled-with-hidden-patterns.png` });
	await resetButton("Node exclusion").click();
	// MAJOR-1 fix: the patterns are off screen, so the confirmation is the only
	// place the user can see WHAT is being destroyed.
	await expect(confirmDialog()).toContainText("Restore node exclusion defaults?");
	const listed = await confirmDialog()
		.locator(".vicinity-graph-confirm-items code")
		.evaluateAll((els) => els.map((el) => el.textContent));
	expect(listed).toEqual(["^archive/", "templates/"]);
	await page.screenshot({ path: `${OUT_DIR}/exclusion-confirm-hidden-patterns.png` });
	await page.keyboard.press("Escape");
});

test("REVIEW: cancelling the exclusion confirmation keeps every pattern", async () => {
	await openSettingsTab();
	await storeHiddenPatterns();
	await resetButton("Node exclusion").click();
	await dialogButton("Cancel").click();
	expect((await readGlobals()).exclusion).toEqual({ enabled: false, patterns: ["^archive/", "templates/"] });
});

test("REVIEW: with no patterns stored, the exclusion reset applies without a dialog", async () => {
	await openSettingsTab();
	await page.evaluate(async (pluginId) => {
		const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
		await store.saveNodeExclusion({ enabled: true, patterns: [] });
		(window as any).app.setting.activeTab?.display();
	}, PLUGIN_ID);
	await resetButton("Node exclusion").click();
	// Nothing irreplaceable to lose → no dialog worth the user's attention.
	await expect.poll(async () => (await readGlobals()).exclusion.enabled).toBe(false);
	await expect(page.locator(".modal-container")).toHaveCount(1);
});

test("REVIEW: confirm modal — Escape is non-destructive and Cancel holds initial focus", async () => {
	await openSettingsTab();
	await dirtyEverySection();
	await page.locator(".vicinity-graph-settings-reset-all button").click();
	const modal = page.locator(".modal-container").last();
	await expect(modal).toContainText(ALL_SETTINGS_RESET_CONFIRM_TITLE);
	const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
	expect(focused).toBe("Cancel");
	await page.screenshot({ path: `${OUT_DIR}/confirm-modal-focus.png` });
	await page.keyboard.press("Escape");
	await expect(page.locator(".modal-container.mod-dim")).toHaveCount(1);
	expect((await readGlobals()).depths.outgoingDepth).toBe(4);
});

test("REVIEW: confirm modal — keyboard-only confirm restores everything", async () => {
	await openSettingsTab();
	await dirtyEverySection();
	await page.locator(".vicinity-graph-settings-reset-all button").click();
	await expect(page.locator(".modal-container").last()).toContainText(ALL_SETTINGS_RESET_CONFIRM_TITLE);
	// Tab from Cancel → confirm, then activate with the keyboard only.
	await page.keyboard.press("Tab");
	const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
	expect(focused).toBe("Restore all defaults");
	await page.keyboard.press("Enter");
	// The three slice writes are awaited in sequence, so poll for the LAST one.
	await expect.poll(async () => (await readGlobals()).exclusion).toEqual({ enabled: false, patterns: [] });
	const after = await readGlobals();
	expect(after.depths).toEqual({ outgoingDepth: 1, incomingDepth: 1 });
	expect(after.view.nodeCap).toBe(100);
	expect(after.view.sizing.minPx).not.toBe(11);
	expect(after.view.forceLayout.repelStrength).not.toBe(800);
	// "Restore ALL" must include the newest section too, not just the ones that
	// existed when the footer button was written.
	expect(after.view.outlineMaxDepth).toBe(2);
	expect(after.view.nodePreviewPreference).toBe("auto");
});

test("REVIEW: reset survives closing/reopening the tab AND a plugin reload", async () => {
	await openSettingsTab();
	await dirtyEverySection();
	await resetButton("Performance").click();
	// Close the settings modal, reopen the tab.
	await page.evaluate(() => (window as any).app.setting.close());
	await openSettingsTab();
	await expect(card("Performance").locator("input[type=number]")).toHaveValue("100");
	// Full plugin reload: state must come back off data.json, not memory.
	await page.evaluate(async (pluginId) => {
		const app = (window as any).app;
		app.setting.close();
		await app.plugins.disablePlugin(pluginId);
		await app.plugins.enablePlugin(pluginId);
	}, PLUGIN_ID);
	await page.waitForFunction(
		(pluginId) => Boolean((window as any).app.plugins.plugins[pluginId]),
		PLUGIN_ID,
	);
	expect((await readGlobals()).view.nodeCap).toBe(100);
	await openSettingsTab();
	await expect(card("Performance").locator("input[type=number]")).toHaveValue("100");
});

test("REVIEW: tab-wide reset sits further from the last card than cards sit apart", async () => {
	await openSettingsTab();
	const gaps = await page.evaluate(() => {
		const container = document.querySelector(".vicinity-graph-settings") as HTMLElement;
		const cards = Array.from(container.querySelectorAll(":scope > .vicinity-graph-settings-section"));
		const footer = container.querySelector(":scope > .vicinity-graph-settings-reset-all") as HTMLElement;
		const rect = (el: Element): DOMRect => el.getBoundingClientRect();
		const betweenCards = rect(cards[1]!).top - rect(cards[0]!).bottom;
		const beforeFooter = rect(footer).top - rect(cards[cards.length - 1]!).bottom;
		return { betweenCards, beforeFooter };
	});
	expect(gaps.beforeFooter).toBeGreaterThan(gaps.betweenCards);
});

test("REVIEW: visual evidence — dark theme and a narrow settings pane", async () => {
	await openSettingsTab();
	await harness.setTheme("dark");
	await page.screenshot({ path: `${OUT_DIR}/settings-resets-dark.png`, fullPage: false });
	await page.locator(".vicinity-graph-settings").last().screenshot({ path: `${OUT_DIR}/settings-resets-dark-tab.png` });
	await harness.setTheme("light");
	await page.locator(".vicinity-graph-settings").last().screenshot({ path: `${OUT_DIR}/settings-resets-light-tab.png` });
	// Narrow-width proxy: squeeze the settings content pane the way a small
	// window / mobile-ish layout would, then look for horizontal overflow.
	const overflow = await page.evaluate(() => {
		const container = document.querySelector(".vicinity-graph-settings") as HTMLElement;
		const pane = container.parentElement as HTMLElement;
		pane.style.width = "320px";
		container.style.width = "320px";
		const rows = Array.from(container.querySelectorAll(".setting-item"));
		return rows
			.filter((row) => row.scrollWidth > row.clientWidth + 1)
			.map((row) => ({
				name: row.querySelector(".setting-item-name")?.textContent ?? "(unnamed)",
				overflowPx: row.scrollWidth - row.clientWidth,
			}));
	});
	await page.locator(".vicinity-graph-settings").last().screenshot({ path: `${OUT_DIR}/settings-resets-narrow.png` });
	// Reported as evidence, not asserted: the container-width squeeze is a proxy —
	// Obsidian's own responsive settings rules key off `is-mobile`, not width.
	console.log(`narrow-width overflow rows=[${JSON.stringify(overflow)}]`);
});
