import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import fs from "node:fs";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

/**
 * Settings-ux-improvements feature spec: asserts the controls panel's default
 * open/closed disclosure states (only Depth starts open), the exclusion-toggle
 * round-trip with its read-only pattern list, force-layout slider parity +
 * Restore defaults, and that the settings-tab card CSS actually reaches
 * Obsidian's settings modal DOM. Screenshots land in `.out/settings-ux/`
 * (never source-controlled) as visual-QA artifacts.
 */

test.describe.configure({ mode: "serial" });

const ALPHA_PATH = "projects/alpha.md";
const OUT_DIR = ".out/settings-ux";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	harness = await ObsidianHarness.launch();
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(ALPHA_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-path="${ALPHA_PATH}"]`)).toHaveAttribute("data-tier", "main");
});

test.afterAll(async () => {
	await harness?.close();
});

function toolbar(): Locator {
	return page.locator(".vicinity-graph-toolbar");
}

function disclosure(summaryText: string): Locator {
	return page.locator(".vicinity-graph-disclosure", {
		has: page.locator(".vicinity-graph-disclosure__summary", { hasText: summaryText }),
	});
}

async function setOpen(details: Locator, open: boolean): Promise<void> {
	await details.first().evaluate((el, next) => {
		(el as HTMLDetailsElement).open = next;
	}, open);
}

test("panel defaults: every section is a disclosure, only Depth starts open", async () => {
	await setOpen(toolbar(), true);
	await expect(disclosure("Depth").first()).toHaveAttribute("open", "");
	await expect(disclosure("Node exclusion")).not.toHaveAttribute("open", "");
	await expect(disclosure("Node sizing")).not.toHaveAttribute("open", "");
	await expect(disclosure("Force layout").first()).not.toHaveAttribute("open", "");
	await page.screenshot({ path: `${OUT_DIR}/panel-default-open.png` });
});

test("exclusion toggle switches on, shows patterns state, and persists", async () => {
	await setOpen(disclosure("Node exclusion"), true);
	const checkbox = disclosure("Node exclusion").locator(".checkbox-container input");
	await checkbox.evaluate((el) => (el as HTMLInputElement).click());
	// Fixture vault has no patterns → designed empty state must appear.
	await expect(page.locator(".vicinity-graph-exclusion__hint")).toContainText("No patterns yet");
	await expect(disclosure("Node exclusion").locator(".checkbox-container")).toHaveClass(/is-enabled/);
	const persisted = await page.evaluate(
		(pluginId) => (window as any).app.plugins.plugins[pluginId].pluginDataStore.nodeExclusion(),
		PLUGIN_ID,
	);
	expect(persisted.enabled).toBe(true);
	await page.screenshot({ path: `${OUT_DIR}/panel-exclusion-on.png` });
	// Seed patterns straight into the store to photograph the read-only list.
	await page.evaluate(async (pluginId) => {
		const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
		await store.saveNodeExclusion({ enabled: true, patterns: ["^archive/", "templates/"] });
		(window as any).app.plugins.plugins[pluginId].refreshOpenViews();
	}, PLUGIN_ID);
	await expect(page.locator(".vicinity-graph-exclusion__patterns li")).toHaveCount(2);
	await page.screenshot({ path: `${OUT_DIR}/panel-exclusion-patterns.png` });
	// Toggle back off through the UI.
	await checkbox.evaluate((el) => (el as HTMLInputElement).click());
	await expect(disclosure("Node exclusion").locator(".checkbox-container")).not.toHaveClass(/is-enabled/);
});

test("force layout: 6 sliders, live write, restore defaults", async () => {
	const forceLayout = disclosure("Force layout").first();
	await setOpen(forceLayout, true);
	// Target the advanced <details> by its OWN class: a summary-text `has:`
	// locator would also match the ancestor Force-layout details (it contains
	// the advanced summary), and setOpen's `.first()` would open the wrong one.
	const advanced = forceLayout.locator("details.vicinity-graph-forcelayout__advanced");
	await setOpen(advanced, true);
	await expect(advanced).toHaveAttribute("open", "");
	await expect(forceLayout.locator("input[type=range]")).toHaveCount(6);
	// toHaveCount alone also counts hidden inputs — additionally prove the two
	// advanced sliders are genuinely user-reachable behind the opened disclosure.
	await expect(forceLayout.getByLabel("Node spacing")).toBeVisible();
	await expect(forceLayout.getByLabel("Group member spacing")).toBeVisible();
	const repel = forceLayout.getByLabel("Repel force");
	const defaultRepel = await repel.inputValue();
	await repel.evaluate((el) => {
		const input = el as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		setter?.call(input, "800");
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await expect(forceLayout.locator(".vicinity-graph-forcelayout__value").nth(1)).toHaveText("800");
	const persisted = await page.evaluate(
		(pluginId) => (window as any).app.plugins.plugins[pluginId].pluginDataStore.globalView().forceLayout,
		PLUGIN_ID,
	);
	expect(persisted.repelStrength).toBe(800);
	await page.screenshot({ path: `${OUT_DIR}/panel-forcelayout.png` });
	await forceLayout.getByRole("button", { name: "Restore defaults" }).click();
	await expect(repel).toHaveValue(defaultRepel);
});

test("settings tab renders five framed section cards with plugin CSS applied", async () => {
	await page.evaluate((pluginId) => {
		const app = (window as any).app;
		app.setting.open();
		app.setting.openTabById(pluginId);
	}, PLUGIN_ID);
	const sections = page.locator(".vicinity-graph-settings-section");
	await expect(sections).toHaveCount(5);
	// The framed-card border proves settings-tab.css reached the settings DOM.
	const borderStyle = await sections.first().evaluate((el) => getComputedStyle(el).borderTopStyle);
	expect(borderStyle).toBe("solid");
	// The sandbox boots LIGHT — set each theme explicitly so the screenshot
	// filenames are truthful (dark evidence was previously mislabeled light).
	await harness.setTheme("dark");
	await page.screenshot({ path: `${OUT_DIR}/settings-tab-cards-dark.png` });
	await harness.setTheme("light");
	await page.screenshot({ path: `${OUT_DIR}/settings-tab-cards-light.png` });
});
