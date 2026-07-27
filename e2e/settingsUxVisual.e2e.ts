import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import { ObsidianHarness } from "./obsidianHarness";
import {
	ALL_SETTINGS_RESET_CONFIRM_TITLE,
	CONTROLS_PANEL_DISCLOSURE_SUMMARIES,
	CONTROLS_PANEL_DISCLOSURES,
	PINNED_CENTRALS_SUMMARY_PATTERN,
	SECTION_RESET_NAMES,
	SETTINGS_TAB_SECTION_HEADINGS,
	SETTINGS_TAB_SECTIONS,
} from "./settingsBaseline";
import { SettingsTabPage } from "./settingsTabPage";
// Type-only, so the pure engine barrel never loads in the node-side test process.
import type { NodePreviewPreference } from "../src/engine";

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
let settingsTab: SettingsTabPage;

test.beforeAll(async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	harness = await ObsidianHarness.launch();
	page = harness.page;
	settingsTab = new SettingsTabPage(page);
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
	for (const { summaryText, startsOpen, summaryAlsoMatchesAnAncestor } of CONTROLS_PANEL_DISCLOSURES) {
		// `.first()` per entry, never uniformly — see PanelDisclosure's field doc.
		const details = summaryAlsoMatchesAnAncestor ? disclosure(summaryText).first() : disclosure(summaryText);
		const openState = expect(details, `panel disclosure=[${summaryText}]`);
		if (startsOpen) {
			await openState.toHaveAttribute("open", "");
		} else {
			await openState.not.toHaveAttribute("open", "");
		}
	}
	await page.screenshot({ path: `${OUT_DIR}/panel-default-open.png` });
});

/**
 * Every TOP-LEVEL panel disclosure's summary.
 *
 * `>` twice, deliberately: the panel's sections are direct children of
 * `.vicinity-graph-toolbar__body`, so a direct-child chain both scopes the count
 * to the top level and drops the NESTED "Advanced spacing" disclosure (and its
 * summary) structurally — no name to maintain.
 */
const TOP_LEVEL_PANEL_SUMMARY_SELECTOR =
	".vicinity-graph-toolbar__body > .vicinity-graph-disclosure > .vicinity-graph-disclosure__summary";

/**
 * The panel's top-level disclosure summaries MINUS the conditional "Pinned
 * centrals (n)", in DOM order.
 *
 * That one is filtered out BY NAME rather than left to the fixture: this spec
 * happens never to pin a central today, but that is an invisible invariant, and
 * the day a test above it pins one the count would silently become 6. The price
 * is that this locator cannot see the disclosure rendering UNCONDITIONALLY —
 * covered by the absence test below.
 */
function topLevelPanelSummaries(): Locator {
	return page.locator(TOP_LEVEL_PANEL_SUMMARY_SELECTOR).filter({ hasNotText: PINNED_CENTRALS_SUMMARY_PATTERN });
}

test("panel: WHEN the controls panel renders THEN its top-level disclosures are exactly the listed ones, in order", async () => {
	await setOpen(toolbar(), true);
	const summaries = topLevelPanelSummaries();

	// The count first, for a failure that names the arithmetic ("6 vs 5") before
	// the text diff does. This is what closes the hole the per-entry loop above
	// leaves: a NEW top-level disclosure that nobody added to the baseline.
	await expect(summaries).toHaveCount(CONTROLS_PANEL_DISCLOSURE_SUMMARIES.length);
	// Identity + order too, mirroring the settings tab's heading assertion — a
	// section that was renamed or reordered still counts.
	//
	// Fully anchored regexes rather than plain strings, for ONE reason: "Node
	// exclusion" renders an OPTIONAL excluded-count badge inside its own <summary>
	// (NodeExclusionSection), so its textContent is "Node exclusion" or
	// "Node exclusion12" depending on the fixture, and an exact string would be a
	// latent flake for that entry. `\d*` tolerates that badge and NOTHING else —
	// tail-anchoring keeps a rename like "Depth" → "Depth & scope" failing, which
	// an open-ended prefix would have let through. If the badge ever stops being a
	// bare integer, the resulting failure is intended, not a flake.
	await expect(summaries).toHaveText(
		CONTROLS_PANEL_DISCLOSURE_SUMMARIES.map(
			(text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d*$`),
		),
	);
});

/*
 * The blind spot the filter above creates, closed. The exhaustiveness pin removes
 * "Pinned centrals (n)" from its own locator by name, so a `GraphToolbar` that
 * dropped the `pinned.length > 0` guard and rendered "Pinned centrals (0)" on
 * every view would leave it — and every other spec — green: the two specs that
 * touch this disclosure only assert PRESENCE, and only AFTER pinning.
 *
 * Ordering matters and is why this lives here: the file is serial and its fixture
 * never pins, so the GIVEN holds only as long as no test above it clicks a pin.
 */
test("panel: WHEN no central is pinned THEN the panel has no Pinned centrals disclosure", async () => {
	await setOpen(toolbar(), true);

	// One chained statement on ONE line, so `selectorGuard.test.ts` can recognise it
	// as an absence assertion — see its ABSENCE_ASSERTION_PATTERN note.
	await expect(page.locator(TOP_LEVEL_PANEL_SUMMARY_SELECTOR).filter({ hasText: PINNED_CENTRALS_SUMMARY_PATTERN })).toHaveCount(0);
});

test("exclusion toggle switches on, shows patterns state, and persists", async () => {
	await setOpen(disclosure("Node exclusion"), true);
	const checkbox = disclosure("Node exclusion").locator(".checkbox-container input");
	await checkbox.evaluate((el) => (el as HTMLInputElement).click());
	// Fixture vault has no patterns → designed empty state must appear.
	await expect(page.locator(".vicinity-graph-exclusion__hint")).toContainText("No patterns yet");
	await expect(disclosure("Node exclusion").locator(".checkbox-container")).toHaveClass(/is-enabled/);
	const persisted = (await harness.readGlobals()).exclusion;
	expect(persisted.enabled).toBe(true);
	await page.screenshot({ path: `${OUT_DIR}/panel-exclusion-on.png` });
	// Seed patterns straight into the store to photograph the read-only list.
	await harness.saveNodeExclusion({ enabled: true, patterns: ["^archive/", "templates/"] });
	await harness.refreshOpenViews();
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
	const persisted = (await harness.readGlobalView()).forceLayout;
	expect(persisted.repelStrength).toBe(800);
	await page.screenshot({ path: `${OUT_DIR}/panel-forcelayout.png` });
	await forceLayout.getByRole("button", { name: "Restore defaults" }).click();
	await expect(repel).toHaveValue(defaultRepel);
});

test("settings tab renders one framed card per section, headed and with plugin CSS applied", async () => {
	await settingsTab.open();
	const sections = page.locator(".vicinity-graph-settings-section");
	await expect(sections).toHaveCount(SETTINGS_TAB_SECTIONS.length);
	// The headings, not just the count: a card that lost or renamed its heading
	// still counts. This is what makes the shared baseline load-bearing rather
	// than a prose comment nobody updates.
	await expect(sections.locator(".setting-item-heading .setting-item-name")).toHaveText(
		SETTINGS_TAB_SECTION_HEADINGS,
	);
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

test("settings tab: every section card ends with its own scoped restore row", async () => {
	await settingsTab.open();
	const resets = page.locator(".vicinity-graph-settings-section .vicinity-graph-settings-reset");
	await expect(resets).toHaveCount(SECTION_RESET_NAMES.length);
	// Scope must be readable from the row itself — no bare "Restore defaults".
	await expect(resets.locator(".setting-item-name")).toHaveText(SECTION_RESET_NAMES);
	await page.screenshot({ path: `${OUT_DIR}/settings-tab-resets-light.png` });
});

/*
 * Every control family the settings tab can render that MUST carry its own
 * `aria-label` — deliberately written as "any input EXCEPT …" rather than an
 * allow-list of types, so a future `addText` (defaults to type=text), `addSearch`
 * or `addDropdown` (<select>) row cannot ship unnamed with this suite green.
 *
 * The one exclusion is intentional, not an oversight:
 * - `radio`: the Preview pill's <label> WRAPS its radio, so the visible segment
 *   text already IS the accessible name (VicinityGraphSettingTab renders it so).
 *
 * Toggles are NOT exempt: Obsidian wraps its checkbox in a bare
 * `<label class="checkbox-container">` that carries no text, so the checkbox has
 * no name of its own and the tab must set one (VicinityGraphSettingTab.nameToggle).
 */
const NAMED_CONTROL_SELECTORS = ["input:not([type=radio])", "select", "textarea"] as const;
const ANY_NAMED_CONTROL = NAMED_CONTROL_SELECTORS.join(", ");
const ANY_UNNAMED_CONTROL = NAMED_CONTROL_SELECTORS.map((selector) => `${selector}:not([aria-label])`).join(", ");
/**
 * Floor for the controls the guard covers (today exactly 26: 10 sliders + 9 number
 * inputs + the exclusion textarea + 6 toggles — 5 sizing metrics and the exclusion
 * enable). A floor, not an exact count, so ADDING a row does not break this test —
 * but a section that stopped rendering can no longer let "nothing is unlabeled"
 * pass by matching nothing.
 */
const MIN_NAMED_CONTROLS = 26;

test("settings tab: WHEN the tab renders THEN every input carries its row name as accessible name", async () => {
	await settingsTab.open();
	// GIVEN node exclusion is ON: its textarea is the tab's only non-<input>
	// control and renders only while enabled, and the exclusion test above ends by
	// switching it OFF. Without this the textarea clause would assert 0-out-of-0.
	await harness.saveNodeExclusion({ ...(await harness.readGlobals()).exclusion, enabled: true });
	await settingsTab.redisplay();
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
	await expect(settings.getByLabel("Exclude notes from the graph")).toHaveAttribute("type", "checkbox");
	// Two controls share a sizing-metric row, so its toggle carries the row name
	// plus its role — same convention as the "<metric> weight" input beside it.
	await expect(settings.getByLabel("Own file size enabled")).toHaveAttribute("type", "checkbox");
	// By ROLE, not just by attribute: this is the only assertion that proves the
	// browser's own accessible-name computation resolves the label we set — an
	// aria-label parked on an element with no role would satisfy everything else here.
	await expect(settings.getByRole("checkbox", { name: "Depth decay enabled" })).toHaveCount(1);

	// The guarantee for rows added LATER: no control in the tab may lack a name.
	expect(await settings.locator(ANY_NAMED_CONTROL).count()).toBeGreaterThanOrEqual(MIN_NAMED_CONTROLS);
	await expect(settings.locator(ANY_UNNAMED_CONTROL)).toHaveCount(0);
});

test("settings tab: a section restore resets ONLY that section", async () => {
	await settingsTab.open();
	// Scoped to the settings DOM: page-wide would turn strict-mode-ambiguous the day
	// the controls panel grows its own node-cap row.
	const nodeCap = page.locator(".vicinity-graph-settings").getByLabel("Node cap");
	await harness.setGlobalNodeCap(42);
	await harness.saveGlobalDepths({ outgoingDepth: 4, incomingDepth: 4 });
	await settingsTab.redisplay();
	await expect(nodeCap).toHaveValue("42");
	await settingsTab.resetButton("Performance").click();
	const after = await harness.readGlobals();
	expect(after.view.nodeCap).toBe(100);
	// The other section stays exactly as the user left it.
	expect(after.depths.outgoingDepth).toBe(4);
});

test("settings tab: restore-all asks first, then resets every section", async () => {
	await settingsTab.open();
	const restoreAll = settingsTab.resetAllButton();
	await restoreAll.click();
	const modal = settingsTab.confirmDialog();
	await expect(modal).toContainText(ALL_SETTINGS_RESET_CONFIRM_TITLE);
	await page.screenshot({ path: `${OUT_DIR}/settings-tab-restore-all-confirm.png` });
	await modal.getByRole("button", { name: "Cancel" }).click();
	// Cancel must be a true no-op.
	expect((await harness.readGlobals()).depths.outgoingDepth).toBe(4);
	await restoreAll.click();
	await modal.getByRole("button", { name: "Restore all defaults" }).click();
	const after = await harness.readGlobals();
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
const storedPreviewPreference = async (): Promise<NodePreviewPreference> =>
	(await harness.readGlobalView()).nodePreviewPreference;

/**
 * Writes the preference straight to the store and re-renders the SETTINGS TAB, so
 * a test's GIVEN does not depend on what an earlier test left behind.
 *
 * WHY-NOT `harness.setNodePreviewPreference`: that one fans the write out to the
 * open GRAPH views instead — a different side effect, and the tab would keep
 * showing the old segment.
 */
async function seedPreviewPreference(value: NodePreviewPreference): Promise<void> {
	await harness.saveGlobalView({ nodePreviewPreference: value });
	await settingsTab.redisplay();
}

/** The tab's pill. Scoped to the settings DOM: the panel has a second radiogroup. */
function tabPreviewRadio(optionLabel: string): Locator {
	return settingsTab.card("Node contents").getByRole("radio", { name: optionLabel, exact: true });
}

test("settings tab: the Preview pill shows one segment per option and checks the stored one", async () => {
	await settingsTab.open();
	await seedPreviewPreference("auto");
	// Precondition: all three options are offered (a pill that lost one would
	// still satisfy the checked-state assertion below).
	await expect(settingsTab.card("Node contents").getByRole("radio")).toHaveCount(3);

	await expect(tabPreviewRadio("Auto")).toBeChecked();
});

test("settings tab: clicking a Preview segment persists the new preference", async () => {
	await settingsTab.open();
	await seedPreviewPreference("auto");

	await tabPreviewRadio("Outline").click();

	await expect.poll(storedPreviewPreference).toBe("outline");
});

test("settings tab: the segmented-control stylesheet reaches the settings modal DOM", async () => {
	await settingsTab.open();
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
	await settingsTab.open();
	await seedPreviewPreference("auto");
	const card = settingsTab.card("Node contents");
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

/**
 * Short on purpose: this only runs on a path that is ALREADY failing, and the
 * elements it reads are ones the test just located — so a slow read here means
 * "gone", which is itself the answer. Keeps one assertion timeout from becoming several.
 */
const READOUT_DIAGNOSTIC_TIMEOUT_MS = 1_000;

/**
 * The DOM a maintainer would otherwise have to reproduce by hand after a slider-readout red.
 *
 * WHY: the assertion is a locator UNION and Playwright reports a union miss as ONE opaque
 * timeout — it names both sub-locators but never says which arm missed or what the row
 * actually rendered. The likeliest future red is a `minAppVersion` bump to 1.13, where the
 * unverified INLINE arm has to do the matching; that red must read as "our locator is wrong"
 * rather than "the product regressed", and only the captured DOM can tell those apart.
 *
 * Best-effort per field: a diagnostic must never replace the failure it is describing, so
 * each read that throws degrades to a note and the caller still re-throws the original.
 */
async function sliderReadoutDiagnostic(row: Locator, expectedValue: string): Promise<string> {
	const capture = async (what: string, read: () => Promise<string>): Promise<string> => {
		try {
			return `${what}=[${await read()}]`;
		} catch (error) {
			return `${what}=[UNREADABLE: ${String(error)}]`;
		}
	};
	const control = row.locator(".setting-item-control");
	const readOptions = { timeout: READOUT_DIAGNOSTIC_TIMEOUT_MS };
	return [
		`expected value=[${expectedValue}]`,
		// Empty list ⇒ the 1.12-style tooltip arm had nothing to match at all.
		await capture("body .tooltip texts", async () =>
			JSON.stringify(await page.locator(".tooltip").allTextContents()),
		),
		await capture("row .setting-item-control text", async () => await control.innerText(readOptions)),
		await capture("row .setting-item-control html", async () => await control.innerHTML(readOptions)),
		// The whole row, because "rendered, but OUTSIDE .setting-item-control" is a
		// scoping bug in the inline arm and is invisible in the two captures above.
		await capture("row html", async () => await row.innerHTML(readOptions)),
	].join("\n  ");
}

/*
 * A slider whose value is nowhere on screen is unreadable, and NOTHING else in
 * this repo asserts that readout: `aria-label` and the `value` attribute both
 * survive its removal. This test exists because `setDynamicTooltip()` was once
 * deleted from `addLabeledSlider` on the strength of the `@deprecated` tag in
 * the 1.13 typings — blanking the value of all 10 sliders on every supported
 * build below 1.13 — with the whole suite green.
 *
 * Deliberately mechanism-agnostic: on the pinned 1.12.7 runtime the value lands
 * in a body-level `.tooltip` on hover; from 1.13 it renders inline in the row.
 * Either satisfies "the value is readable", so a future `minAppVersion` bump
 * needs no edit here.
 *
 * As of 2026-07-26 ONLY the `.tooltip` arm is verified: 1.13 is not GA (newest
 * public release 1.12.7; 1.13.x is Catalyst-gated), so the inline arm has never
 * run against a shipped build. Its ENTIRE basis is one line of `obsidian.d.ts` —
 * "@deprecated The value is now always shown inline next to the slider." — which
 * names no selector, no ancestry and no number formatting. It is a reasoned guess.
 * Hence the catch below: a 1.13 red is likelier a locator miss than a regression.
 *
 * Two things the assertion must NOT be satisfiable by, hence its exact shape:
 * - the `<input value=…>` attribute → match on rendered TEXT only;
 * - a digit in the row's own name/desc → scoped to `.setting-item-control`
 *   (name and desc live in the sibling `.setting-item-info`) and matched exactly.
 * And it asserts only the post-hover state — WHY-NOT a "hidden before hover"
 * precondition: from 1.13 the inline readout is there before any hover, and that
 * precondition would then fail for a reason that is not a regression.
 */
test("settings tab: WHEN a slider is hovered THEN its current value is readable", async () => {
	await settingsTab.open();
	// "Outline depth", because the advanced force-layout sliders sit inside a
	// collapsed <details> and cannot be hovered without opening it.
	const row = page.locator(".vicinity-graph-settings .setting-item", {
		has: page.locator('input[aria-label="Outline depth"]'),
	});
	const slider = row.locator('input[type="range"]');
	const value = await slider.inputValue();
	// Escape before interpolating: a fractional-step slider ("0.5") would otherwise
	// build `/^0.5$/`, whose `.` matches any char — "015" would pass.
	const exactly = new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
	const valueReadout = page
		.locator(".tooltip")
		.filter({ hasText: exactly })
		.or(row.locator(".setting-item-control").getByText(value, { exact: true }));

	// Clear pointer state FIRST: `.tooltip` is body-level and this file is serial, so a
	// tooltip left behind by an earlier test must not be able to satisfy the assertion —
	// and a mouse already parked on the slider would make `hover()` a no-op. It is an
	// action, not an assertion — see the WHY-NOT above on the missing pre-hover check.
	await page.mouse.move(0, 0);
	await slider.hover();

	// `.first()`: a 1.13 build may well render BOTH readouts, and one is enough.
	try {
		await expect(valueReadout.first()).toBeVisible();
	} catch (error) {
		// Enrich, never soften: same reds as before, with the DOM attached.
		throw new Error(
			`Slider value is not readable by EITHER mechanism (body .tooltip, or inline text in the row's ` +
				`.setting-item-control). If the value IS present below but we did not match it, this is a ` +
				`test-locator problem — most likely the 1.13 inline readout differing in placement or number ` +
				`formatting from what the union guesses. See the WHY block above this test.\n  ` +
				`${await sliderReadoutDiagnostic(row, value)}\n  cause=[${String(error)}]`,
		);
	}
});

test("controls panel: clicking its Preview segment writes the SAME global the tab writes", async () => {
	// The settings modal must go: with it open there are TWO Preview radiogroups
	// in the document and every unscoped radio locator is strict-mode ambiguous.
	await settingsTab.close();
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
