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
	await expect(disclosure("Node contents")).not.toHaveAttribute("open", "");
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

test("force layout: 7 sliders, live write, restore defaults", async () => {
	const forceLayout = disclosure("Force layout").first();
	await setOpen(forceLayout, true);
	// Target the advanced <details> by its OWN class: a summary-text `has:`
	// locator would also match the ancestor Force-layout details (it contains
	// the advanced summary), and setOpen's `.first()` would open the wrong one.
	const advanced = forceLayout.locator("details.vicinity-graph-forcelayout__advanced");
	await setOpen(advanced, true);
	await expect(advanced).toHaveAttribute("open", "");
	await expect(forceLayout.locator("input[type=range]")).toHaveCount(7);
	// toHaveCount alone also counts hidden inputs — additionally prove the
	// advanced sliders are genuinely user-reachable behind the opened disclosure.
	await expect(forceLayout.getByLabel("Node spacing")).toBeVisible();
	await expect(forceLayout.getByLabel("Group member spacing")).toBeVisible();
	await expect(forceLayout.getByLabel("Edge clearance")).toBeVisible();
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

test("settings tab renders six framed section cards with plugin CSS applied", async () => {
	await page.evaluate((pluginId) => {
		const app = (window as any).app;
		app.setting.open();
		app.setting.openTabById(pluginId);
	}, PLUGIN_ID);
	const sections = page.locator(".vicinity-graph-settings-section");
	// Depth defaults, node sizing, node contents, force layout, node exclusion, performance.
	await expect(sections).toHaveCount(6);
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

/** The plugin's persisted globals, straight from the store (no UI in the middle). */
function readGlobals(): Promise<{ view: { nodeCap: number }; depths: { outgoingDepth: number } }> {
	return page.evaluate((pluginId) => {
		const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
		return { view: store.globalView(), depths: store.globalDepths() };
	}, PLUGIN_ID);
}

async function openSettingsTab(): Promise<void> {
	await page.evaluate((pluginId) => {
		const app = (window as any).app;
		app.setting.open();
		app.setting.openTabById(pluginId);
	}, PLUGIN_ID);
}

test("settings tab: every section card ends with its own scoped restore row", async () => {
	await openSettingsTab();
	const resets = page.locator(".vicinity-graph-settings-section .vicinity-graph-settings-reset");
	await expect(resets).toHaveCount(6);
	// Scope must be readable from the row itself — no bare "Restore defaults".
	await expect(resets.locator(".setting-item-name")).toHaveText([
		"Restore depth defaults",
		"Restore node sizing defaults",
		"Restore node contents defaults",
		"Restore force layout defaults",
		"Restore node exclusion defaults",
		"Restore performance defaults",
	]);
	await page.screenshot({ path: `${OUT_DIR}/settings-tab-resets-light.png` });
});

/*
 * Every control family the settings tab can render that MUST carry its own
 * `aria-label` — deliberately written as "any input EXCEPT …" rather than an
 * allow-list of types, so a future `addText` (defaults to type=text), `addSearch`
 * or `addDropdown` (<select>) row cannot ship unnamed with this suite green.
 *
 * The two exclusions are intentional, not oversights:
 * - `radio`: the Preview pill's <label> WRAPS its radio, so the visible segment
 *   text already IS the accessible name (VicinityGraphSettingTab renders it so).
 * - `checkbox`: Obsidian toggles are a div.checkbox-container around a hidden
 *   checkbox and are still unnamed — tracked in nid_d2z2jgt6v49ssej8hxmwd2xi6_e.
 *   Closing that ticket means deleting the `:not([type=checkbox])` clause here.
 */
const NAMED_CONTROL_SELECTORS = ["input:not([type=radio]):not([type=checkbox])", "select", "textarea"] as const;
const ANY_NAMED_CONTROL = NAMED_CONTROL_SELECTORS.join(", ");
const ANY_UNNAMED_CONTROL = NAMED_CONTROL_SELECTORS.map((selector) => `${selector}:not([aria-label])`).join(", ");
/**
 * Floor for the controls the guard covers (today exactly 20: 10 sliders + 9 number
 * inputs + the exclusion textarea). A floor, not an exact count, so ADDING a row
 * does not break this test — but a section that stopped rendering can no longer
 * let "nothing is unlabeled" pass by matching nothing.
 */
const MIN_NAMED_CONTROLS = 20;

test("settings tab: WHEN the tab renders THEN every input carries its row name as accessible name", async () => {
	await openSettingsTab();
	// GIVEN node exclusion is ON: its textarea is the tab's only non-<input>
	// control and renders only while enabled, and the exclusion test above ends by
	// switching it OFF. Without this the textarea clause would assert 0-out-of-0.
	await page.evaluate(async (pluginId) => {
		const plugin = (window as any).app.plugins.plugins[pluginId];
		const store = plugin.pluginDataStore;
		await store.saveNodeExclusion({ ...store.nodeExclusion(), enabled: true });
		plugin.app.setting.activeTab.display();
	}, PLUGIN_ID);
	const settings = page.locator(".vicinity-graph-settings");

	// Obsidian puts the row name in a SIBLING of the control, so this only passes
	// while the tab sets aria-label itself (src/view/VicinityGraphSettingTab.ts).
	// One positive assertion per covered family — a count of unlabeled controls is
	// only meaningful once each family is proven present AND named.
	await expect(settings.getByLabel("Repel force")).toHaveAttribute("type", "range");
	await expect(settings.getByLabel("Outline depth")).toHaveAttribute("type", "range");
	await expect(settings.getByLabel("Outgoing depth")).toHaveAttribute("type", "range");
	await expect(settings.getByLabel("Node cap")).toHaveAttribute("type", "number");
	await expect(settings.getByLabel("Exclusion patterns")).toHaveCount(1);

	// The guarantee for rows added LATER: no control in the tab may lack a name.
	expect(await settings.locator(ANY_NAMED_CONTROL).count()).toBeGreaterThanOrEqual(MIN_NAMED_CONTROLS);
	await expect(settings.locator(ANY_UNNAMED_CONTROL)).toHaveCount(0);
});

test("settings tab: a section restore resets ONLY that section", async () => {
	await openSettingsTab();
	// Scoped to the settings DOM: page-wide would turn strict-mode-ambiguous the day
	// the controls panel grows its own node-cap row.
	const nodeCap = page.locator(".vicinity-graph-settings").getByLabel("Node cap");
	await page.evaluate(async (pluginId) => {
		const plugin = (window as any).app.plugins.plugins[pluginId];
		const store = plugin.pluginDataStore;
		await store.saveGlobalView({ ...store.globalView(), nodeCap: 42 });
		await store.saveGlobalDepths({ outgoingDepth: 4, incomingDepth: 4 });
		plugin.app.setting.activeTab.display();
	}, PLUGIN_ID);
	await expect(nodeCap).toHaveValue("42");
	await page.locator(".vicinity-graph-settings-section", { hasText: "Performance" }).getByRole("button").click();
	const after = await readGlobals();
	expect(after.view.nodeCap).toBe(100);
	// The other section stays exactly as the user left it.
	expect(after.depths.outgoingDepth).toBe(4);
});

test("settings tab: restore-all asks first, then resets every section", async () => {
	await openSettingsTab();
	const restoreAll = page.locator(".vicinity-graph-settings-reset-all").getByRole("button");
	await restoreAll.click();
	// `.last()`: the settings window is itself a `.modal-container`; the confirm
	// dialog stacks on top of it.
	const modal = page.locator(".modal-container").last();
	await expect(modal).toContainText("Restore all Vicinity Graph settings?");
	await page.screenshot({ path: `${OUT_DIR}/settings-tab-restore-all-confirm.png` });
	await modal.getByRole("button", { name: "Cancel" }).click();
	// Cancel must be a true no-op.
	expect((await readGlobals()).depths.outgoingDepth).toBe(4);
	await restoreAll.click();
	await modal.getByRole("button", { name: "Restore all defaults" }).click();
	const after = await readGlobals();
	expect(after.depths.outgoingDepth).toBe(1);
});

// --- The Preview pill, on BOTH surfaces ---------------------------------------
/*
 * The two pills are NOT symmetric, and it changes how they must be asserted:
 *
 * - The settings tab builds plain UNCONTROLLED DOM radios, so `.checked` flips
 *   synchronously with the click.
 * - The controls panel's radio is CONTROLLED by React off the rebuilt snapshot,
 *   so right after the click the DOM still reports the OLD value until persist +
 *   rebuild + re-render land.
 *
 * Therefore every assertion here is a RETRYING `expect(...)` / `expect.poll(...)`.
 * A one-shot `isChecked()` / `evaluate(el => el.checked)` / `inputValue()` sample
 * is flaky on the panel by construction — do not "simplify" these back.
 */

/** The plugin's persisted preview preference, straight from the store. */
const storedPreviewPreference = (): Promise<string> =>
	page.evaluate(
		(pluginId) => (window as any).app.plugins.plugins[pluginId].pluginDataStore.globalView().nodePreviewPreference,
		PLUGIN_ID,
	);

/**
 * Writes the preference straight to the store and re-renders the settings tab, so
 * a test's GIVEN does not depend on what an earlier test left behind.
 */
async function seedPreviewPreference(value: string): Promise<void> {
	await page.evaluate(
		async ({ pluginId, preference }) => {
			const store = (window as any).app.plugins.plugins[pluginId].pluginDataStore;
			await store.saveGlobalView({ ...store.globalView(), nodePreviewPreference: preference });
			(window as any).app.setting.activeTab?.display();
		},
		{ pluginId: PLUGIN_ID, preference: value },
	);
}

/** The tab's pill. Scoped to the settings DOM: the panel has a second radiogroup. */
function tabPreviewRadio(optionLabel: string): Locator {
	return page
		.locator(".vicinity-graph-settings-section", { hasText: "Node contents" })
		.getByRole("radio", { name: optionLabel, exact: true });
}

test("settings tab: the Preview pill shows one segment per option and checks the stored one", async () => {
	await openSettingsTab();
	await seedPreviewPreference("auto");
	// Precondition: all three options are offered (a pill that lost one would
	// still satisfy the checked-state assertion below).
	await expect(
		page.locator(".vicinity-graph-settings-section", { hasText: "Node contents" }).getByRole("radio"),
	).toHaveCount(3);

	await expect(tabPreviewRadio("Auto")).toBeChecked();
});

test("settings tab: clicking a Preview segment persists the new preference", async () => {
	await openSettingsTab();
	await seedPreviewPreference("auto");

	await tabPreviewRadio("Outline").click();

	await expect.poll(storedPreviewPreference).toBe("outline");
});

test("settings tab: the segmented-control stylesheet reaches the settings modal DOM", async () => {
	await openSettingsTab();
	// `npm test` cannot catch a missing AUTHORED_CSS_FILES entry — only the
	// generated styles.css inside a real Obsidian can. `overflow` is the cheapest
	// probe unique to segmented-control.css (a bare div's default is "visible").
	const overflow = await page
		.locator(".vicinity-graph-settings .vicinity-graph-segmented")
		.first()
		.evaluate((el) => getComputedStyle(el).overflow);

	expect(overflow).toBe("hidden");
});

test("settings tab: the selected Preview segment is filled distinctly from the trough", async () => {
	await openSettingsTab();
	await seedPreviewPreference("auto");
	const card = page.locator(".vicinity-graph-settings-section", { hasText: "Node contents" });
	const pill = card.locator(".vicinity-graph-segmented");

	/**
	 * Resolved colours, both themes. Logged as EVIDENCE, not asserted: the exact
	 * values are the theme's business, and this is the record a human uses to judge
	 * `--text-on-accent` legibility on the selected segment and how the trough reads
	 * against its host (see
	 * `docs-internal/tickets/ticket-node-preview-pill-human-smoke-run.md`).
	 */
	const measure = (): Promise<Record<string, string>> =>
		pill.evaluate((group) => {
			const checked = group.querySelector("input:checked")?.parentElement as HTMLElement;
			const unchecked = group.querySelector("input:not(:checked)")?.parentElement as HTMLElement;
			return {
				trough: getComputedStyle(group).backgroundColor,
				selectedFill: getComputedStyle(checked).backgroundColor,
				selectedText: getComputedStyle(checked).color,
				unselectedText: getComputedStyle(unchecked).color,
			};
		});

	await harness.setTheme("dark");
	await card.screenshot({ path: `${OUT_DIR}/preview-pill-dark.png` });
	console.log(`preview-pill colors (dark)=[${JSON.stringify(await measure())}]`);
	await harness.setTheme("light");
	await card.screenshot({ path: `${OUT_DIR}/preview-pill-light.png` });
	const light = await measure();
	console.log(`preview-pill colors (light)=[${JSON.stringify(light)}]`);

	// The one theme-independent promise: the selected segment must not be
	// indistinguishable from the trough it sits in.
	expect(light.selectedFill).not.toBe(light.trough);
});

test("controls panel: clicking its Preview segment writes the SAME global the tab writes", async () => {
	// The settings modal must go: with it open there are TWO Preview radiogroups
	// in the document and every unscoped radio locator is strict-mode ambiguous.
	await page.evaluate(() => (window as any).app.setting.close());
	await setOpen(toolbar(), true);
	const nodeContents = disclosure("Node contents");
	await setOpen(nodeContents, true);

	// `.click()`, never `.check()`: this radio is controlled off the rebuilt
	// snapshot, so `check()`'s post-action "is it checked now" verification races
	// the rebuild.
	await nodeContents.getByRole("radio", { name: "Image", exact: true }).click();

	await expect.poll(storedPreviewPreference).toBe("image");
});

test("controls panel: the pill re-checks itself from the rebuilt snapshot", async () => {
	const nodeContents = disclosure("Node contents");
	await setOpen(nodeContents, true);

	// Retrying, because the controlled radio only flips once the write has round-
	// tripped through persist → rebuild → re-render (the previous test wrote "image").
	await expect(nodeContents.getByRole("radio", { name: "Image", exact: true })).toBeChecked();
});
