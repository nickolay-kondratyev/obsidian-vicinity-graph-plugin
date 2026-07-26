# EXPLORATION_PUBLIC — e2e: assert settings-tab sliders show their value

Read-only exploration of the repo for ticket `nid_14phm98g7w64oparxz5wvfqwh_e`.
(Findings produced by the Explore agent; persisted here by TOP_LEVEL_AGENT.)

## 1. `e2e/settingsUxVisual.e2e.ts` (404 lines)

Header imports:
```ts
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import fs from "node:fs";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";
```
- `test.describe.configure({ mode: "serial" })` (line 15); `const OUT_DIR = ".out/settings-ux"` (line 18); module-level `let harness: ObsidianHarness; let page: Page;`
- `beforeAll` (23-30): `fs.mkdirSync(OUT_DIR, {recursive:true})`, `harness = await ObsidianHarness.launch()`, `page = harness.page`, `await harness.openGraphView()`, `await harness.openFile(ALPHA_PATH)`. `afterAll` (32-34): `await harness?.close()`.

**Local helper to reuse — lines 150-156:**
```ts
async function openSettingsTab(): Promise<void> {
	await page.evaluate((pluginId) => {
		const app = (window as any).app;
		app.setting.open();
		app.setting.openTabById(pluginId);
	}, PLUGIN_ID);
}
```
- Settings root locator used throughout: `page.locator(".vicinity-graph-settings")` (line 209); section cards: `.vicinity-graph-settings-section` (6 of them).
- Slider locating precedent (215-217): `await expect(settings.getByLabel("Repel force")).toHaveAttribute("type", "range");` also `"Outline depth"`, `"Outgoing depth"`.
- Test-name conventions: mixed; newest/BDD one at line 198 is
  `test("settings tab: WHEN the tab renders THEN every input carries its row name as accessible name", …)`. **Use the `WHEN … THEN …` form.**
- Screenshot idiom: `await page.screenshot({ path: `${OUT_DIR}/name.png` })`; element shots `await card.screenshot({...})`; theme via `await harness.setTheme("dark" | "light")`.
- **Placement matters (serial mode):** the last two tests (380-403) start with
  `await page.evaluate(() => (window as any).app.setting.close())` and operate on the controls panel.
  Insert the new test **after the pill test ending at line 378 and BEFORE line 380**, starting it with `await openSettingsTab();`.

## 2. `e2e/obsidianHarness.ts`

No Playwright fixtures — a hand-rolled class. Exports `PLUGIN_ID = "vicinity-graph"`, `OPEN_GRAPH_COMMAND_ID`, `GlobalViewSnapshot`, `class ObsidianHarness`.
Members: `static launch({extraFixtures?})` (130), `relaunch()`, `close()`, `readonly page: Page`, `openFile()`, `openGraphView()`, `remountGraphView()`, `setGlobalNodeCap()`, `setMaxNodeSizePx()`, `setNodePreviewPreference()`, `readGlobalView()`, `setTheme("dark"|"light")` (349).
**No settings-tab helper and no version helper on the harness.** Launch spawns real Obsidian over CDP with `--user-data-dir`, `--remote-debugging-port=0`, `--no-sandbox`, `OBSIDIAN_E2E_EXTRA_ARGS`.

## 3. `settingsResetReview.e2e.ts` / `settingsResetVerify.e2e.ts`

Each has its OWN private copy of `openSettingsTab()` (Review 75-81, Verify 53-58). The Review variant adds a readiness assertion worth copying:
```ts
async function openSettingsTab(): Promise<void> {
	await page.evaluate((pluginId) => { const app = (window as any).app; app.setting.open(); app.setting.openTabById(pluginId); }, PLUGIN_ID);
	await expect(page.locator(".vicinity-graph-settings-section")).toHaveCount(6);
}
```
Also `card(headingText)` = `page.locator(".vicinity-graph-settings-section", { hasText })` (Review 83-85) and `confirmDialog()` = `.modal-container` `.last()` (WHY: the settings window is itself a `.modal-container`).
The helper is **deliberately duplicated per spec file** (no shared e2e utils module besides the harness) — do NOT extract; just reuse the existing in-file `openSettingsTab` in `settingsUxVisual.e2e.ts`.

## 4. `src/view/VicinityGraphSettingTab.ts`

`setDynamicTooltip()` **IS present** (reverted back in). `addLabeledSlider` at **469-488**, WHY doc at 456-468:
```ts
private addLabeledSlider(container, name, desc, bounds, value, onChange): void {
	new Setting(container).setName(name).setDesc(desc)
		.addSlider((slider) => slider
			.setLimits(bounds.min, bounds.max, bounds.step)
			.setValue(value)
			.setDynamicTooltip()
			.then(() => VicinityGraphSettingTab.nameControl(slider.sliderEl, name))
			.onChange(onChange));
}
```
`nameControl` (116-118) does `el.setAttribute("aria-label", accessibleName)` → every slider is reachable via `getByLabel(rowName)`, is `input[type=range]` inside `.setting-item-control > .slider`. Root container gets `containerEl.addClass("vicinity-graph-settings")` (124).

**10 sliders confirmed**: 2 depth (`addDepthSlider` 284, 291 → "Outgoing depth"/"Incoming depth"), 1 `"Outline depth"` (378, Node contents), 7 force-layout (218 main + 223 advanced).
⚠ The advanced force-layout sliders live inside `details.vicinity-graph-settings-advanced` → **hidden unless opened**. Hover a NON-advanced slider ("Outline depth" or "Outgoing depth").
(Settings-tab advanced class `vicinity-graph-settings-advanced` is distinct from the panel's `vicinity-graph-forcelayout__advanced`.)

## 5. Version at test time

- Pinned: `scripts/setup-obsidian-bin.sh` ~line 28 `OBSIDIAN_VERSION="1.12.7"`; cached binary exists at `.tmp/obsidian/obsidian-1.12.7/obsidian`.
- `manifest.json` `minAppVersion: "1.12.4"`; `node_modules/obsidian` typings are **1.13.1** (hence `@deprecated` on `setDynamicTooltip()` at `obsidian.d.ts:6774` — "The value is now always shown inline next to the slider").
- **No e2e test reads the running Obsidian version today** (no hits for `apiVersion|appVersion|requireApiVersion|app.appId` in `e2e/` or `src/`). If a version gate is wanted: node-side `process.env.OBSIDIAN_PATH` (auto-download path contains `obsidian-1.12.7`, but not when the user sets it), or renderer-side `page.evaluate(() => (window as any).require?.("obsidian")?.apiVersion)` / `(window as any).app?.appVersion` — both **unverified**.
- **Recommended (matches the ticket's guidance)**: assert mechanism-agnostically — hover the slider, then assert the value string is visible either in a `.tooltip` (≤1.12.x) or inside the setting row (≥1.13).
  ⚠ The `.tooltip` element is appended to `document.body`, **NOT** inside `.vicinity-graph-settings` → scope it to `page`, not to `settings`.
- Reproduction evidence from the ticket file (`_tickets/e2e-assert-settings-tab-sliders-show-their-value-hover-tooltip.md:27-30`): before revert `.tooltip` allTextContents = `[]` vs core Appearance>Font size `["16"]`; after revert ours = `["1"]`. So the failing-without-fix assertion is genuinely `.tooltip` non-empty.

## 6. Running e2e

- `npm run test:e2e` → `scripts/run-e2e.sh`: auto-resolves `OBSIDIAN_PATH` via `setup-obsidian-bin.sh` (binary already cached → no download), sets `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"` when no `DISPLAY`, runs `npm run setup:dev-vault`, `npx tsc -p e2e/tsconfig.json`, then `npx playwright test --config e2e/playwright.config.ts "$@"`.
- Single file: `npm run test:e2e -- settingsUxVisual.e2e.ts`. Single test: `npm run test:e2e -- settingsUxVisual.e2e.ts -g "WHEN a slider is hovered"`. `-g` still boots one Obsidian via `beforeAll`.
- Config (`e2e/playwright.config.ts`): `workers: 1`, `fullyParallel: false`, `retries: 0`, test timeout 120s, expect timeout 15s, reporter `list`, outputDir `../.tmp/e2e-artifacts`. Boot alone is tens of seconds; the 14-test file takes on the order of a couple of minutes.
- `setup:dev-vault` refreshes the dev-vault build, so source changes are picked up automatically.

## 7. Existing tooltip assertions

None on Obsidian's `.tooltip` element anywhere. Existing tooltip references are the plugin's own `title` attributes / badge copy (`src/view/badgeText.test.ts:36,40`, `src/view/truncationBadges.test.ts:32`, `src/view/ForceLayoutSection.tsx:24`, `src/view/NodeContentsSection.tsx:59`, `src/view/graph-view.css:408,727`). The new test would be the repo's **first** `.tooltip` assertion.
