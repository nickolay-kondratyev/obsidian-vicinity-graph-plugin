# EXPLORATION — a11y toggle labels

Ticket: `nid_d2z2jgt6v49ssej8hxmwd2xi6_e` — "Settings-tab toggles have no accessible name".
Produced by the EXPLORE agent (read-only), persisted by TOP_LEVEL_AGENT.

## 1. `src/view/VicinityGraphSettingTab.ts` (825 lines)

### The one rule + helper (`:113-125`)
```ts
	private static nameControl(el: HTMLElement, accessibleName: string): void {
		el.setAttribute("aria-label", accessibleName);
	}
```
Its doc comment (`:113-122`) is the rule's spec text: "a control carries an `aria-label` equal to the row
name a sighted user reads (plus the control's role where one row holds two controls) … 
`e2e/settingsUxVisual.e2e.ts` fails if any input in the tab lacks one." Extend that comment; do not add a
second competing rule.

### Every current `nameControl` call site
| Line | Control | Element passed | Name string |
|---|---|---|---|
| `:241` | section reset button | `button.buttonEl` (after `.setTooltip(label)`) | `SETTINGS_RESET_SCOPES[scope].label` |
| `:276` | restore-all button | `button.buttonEl` (after `.setTooltip(label)`) | same |
| `:391` | exclusion patterns textarea | `text.inputEl` | `"Exclusion patterns"` |
| `:503` | sizing metric weight | `text.inputEl` | `` `${label} weight` `` |
| `:610` | node cap | `text.inputEl` | `"Node cap"` |
| `:657` | ALL 10 sliders (`addLabeledSlider`) | `slider.sliderEl` via `.then(() => …)` | row `name` |
| `:706` | 3 sizing numbers (`addSizingNumber`) | `text.inputEl` | row `name` |

Two idioms: direct `nameControl(component.inputEl, name)` where the component exposes an element field, and
`.then(() => nameControl(component.xEl, name))` chained into the builder (buttons/sliders).
`ToggleComponent` exposes only `toggleEl` (§4), so the toggle fix will use the `.then(...)` idiom.

### The two unlabeled `addToggle` sites

**A. Exclusion enable — `renderExclusion()` `:316-345`**, row name at `:321`:
```ts
		const toggleRow = new Setting(section)
			.setName("Exclude notes from the graph")
			.setDesc("Hide matching neighbor notes before the graph is built. …");
		const patternsSlot = section.createDiv();
		toggleRow.addToggle((toggle) =>
			toggle.setValue(exclusion.enabled).onChange(async (enabled) => { … }),
		);
```
The builder callback returns the `onChange(...)` result — a `.then()` insert must not break that
arrow-expression shape (chain `.then()` before/after `onChange`, or convert to a block body).

**B. Sizing metric enable — `addSizingMetricRow()` `:459-520`**, called once per `SIZING_METRICS` entry from
`renderSizing()` `:442-444`:
```ts
		for (const { id, label } of SIZING_METRICS) {
			this.addSizingMetricRow(section, id, label, sizing.metrics[id]);
		}
```
Row: `new Setting(section).setName(label).addToggle(...).addText(...)` (`:470-519`). The row's `label` is the
toggle's natural name; the paired number input is already `` `${label} weight` `` (`:498`, comment: "Two
controls share this row (toggle + weight), so the row name alone would not distinguish them").
`SIZING_METRICS` (`src/view/sizingMetrics.ts:16-22`) = "Own file size", "Total linker size", "Backlinks",
"Outlinks", "Depth decay" → 5 toggles + 1 exclusion toggle = **6 toggles total**.

⚠️ Naming a toggle exactly `label` makes Playwright's substring-matching `getByLabel("Own file size")` match
BOTH the toggle and "Own file size weight" → strict-mode violation inside `.vicinity-graph-settings`. Either
use `getByLabel(name, { exact: true })` in the new assertions, or disambiguate the toggle name (e.g.
`` `${label} enabled` ``) — the ticket AC says "its visible row name", so `exact: true` is the lower-friction
choice. No existing spec line is affected (`controlsRestart.e2e.ts:145` is scoped to the
`.vicinity-graph-sizing` panel, not the tab).

### Existing aria / tooltip usage in the tab
- `setTooltip(label)` on both reset buttons (`:240`, `:275`) alongside `nameControl` — established
  "tooltip + aria-label from the same string" pattern. `ToggleComponent.setTooltip` exists (since 1.1.1) and
  would mirror it, but adds hover UI → brushes AC "no visual change"; treat as an explicit decision.
- `aria-invalid` via `showVerdict` (`:200-203`); `role="alert"|"status"` feedback slots (`:195-197`).
- `role="radiogroup"` + `aria-label` on the Preview pill group (`:571-576`); radios named by wrapping
  `<label>` (`:581-591`).
- `setDynamicTooltip()` on sliders with a long WHY block (`:625-659`) — **do not touch** (a prior review
  caught its removal as blocking).

## 2. `e2e/settingsUxVisual.e2e.ts` (551 lines)

### The guard, verbatim (`:231-277`)
```ts
/*
 * … The two exclusions are intentional, not oversights:
 * - `radio`: the Preview pill's <label> WRAPS its radio …
 * - `checkbox`: Obsidian toggles are a div.checkbox-container around a hidden
 *   checkbox and are still unnamed — tracked in nid_d2z2jgt6v49ssej8hxmwd2xi6_e.
 *   Closing that ticket means deleting the `:not([type=checkbox])` clause here.
 */
const NAMED_CONTROL_SELECTORS = ["input:not([type=radio]):not([type=checkbox])", "select", "textarea"] as const;
const ANY_NAMED_CONTROL = NAMED_CONTROL_SELECTORS.join(", ");
const ANY_UNNAMED_CONTROL = NAMED_CONTROL_SELECTORS.map((selector) => `${selector}:not([aria-label])`).join(", ");
const MIN_NAMED_CONTROLS = 20;

test("settings tab: WHEN the tab renders THEN every input carries its row name as accessible name", async () => {
	await settingsTab.open();
	await harness.saveNodeExclusion({ ...(await harness.readGlobals()).exclusion, enabled: true });
	await settingsTab.redisplay();
	const settings = page.locator(".vicinity-graph-settings");
	await expect(settings.getByLabel("Repel force")).toHaveAttribute("type", "range");
	await expect(settings.getByLabel("Outline depth")).toHaveAttribute("type", "range");
	await expect(settings.getByLabel("Outgoing depth")).toHaveAttribute("type", "range");
	await expect(settings.getByLabel("Node cap")).toHaveAttribute("type", "number");
	await expect(settings.getByLabel("Exclusion patterns")).toHaveCount(1);
	expect(await settings.locator(ANY_NAMED_CONTROL).count()).toBeGreaterThanOrEqual(MIN_NAMED_CONTROLS);
	await expect(settings.locator(ANY_UNNAMED_CONTROL)).toHaveCount(0);
});
```
Mechanics: enumeration is a **selector-based "everything except"** list scoped to `.vicinity-graph-settings`
(the tab root); "row name" is not derived from the DOM — positive assertions hard-code expected names, and the
negative assertion proves no `aria-label` is missing. Floor `20` = 10 sliders + 9 number inputs + 1 textarea.
Extending to checkboxes: drop `:not([type=checkbox])`, add ≥1 positive per-family assertion, bump the floor to
**26** (20 + 6 toggles), and update the block comment (it explicitly says closing this ticket means deleting
that clause). Leave the `radio` exemption and its rationale intact.

Toggle-adjacent DOM already exercised by this file (`:150-168`) is the **controls panel** toggle
(`.vicinity-graph-disclosure` → `ToggleSwitch.tsx`), not the settings tab:
```ts
	const checkbox = disclosure("Node exclusion").locator(".checkbox-container input");
	await checkbox.evaluate((el) => (el as HTMLInputElement).click());
	await expect(disclosure("Node exclusion").locator(".checkbox-container")).toHaveClass(/is-enabled/);
```

### Shared e2e settings helpers ("e2e-settings-helper-dry")
- `e2e/settingsTabPage.ts` — `SettingsTabPage` page object: `open()`, `close()`, `redisplay()`,
  `card(heading)`, `resetButton(heading)`, `resetAllRow/Button()`, `confirmDialog()`, `dialogButton()`,
  `openModals()`. Deliberately **no `fs`**. No toggle helper today — a `toggle(name)` accessor could land here.
- `e2e/settingsBaseline.ts` — `SETTINGS_TAB_SECTIONS`, `SETTINGS_TAB_SECTION_HEADINGS`,
  `SECTION_RESET_NAMES`, `CONTROLS_PANEL_DISCLOSURES*`; derived from `src/view/settingsResetPlan`. Pure
  (no obsidian/react/fs), guarded by `e2e/settingsBaseline.test.ts`. **`SIZING_METRICS` is not mirrored here**
  — importing `../src/view/sizingMetrics` (pure) is safe and matches the module's purity rule.
- `e2e/obsidianHarness.ts` — `launch()`, `readGlobals()`, `readGlobalView()`, `saveGlobalView/Depths/NodeExclusion`,
  `refreshOpenViews()`, `setTheme()`, `setGlobalNodeCap()`, `resolveObsidianPath()` (`:136`).
- Precedent: `e2e/settingsDependentRows.e2e.ts:88-107` already has name-based tab helpers —
  ```ts
  function control(accessibleName: string): Locator { return settingsRoot().getByLabel(accessibleName); }
  function rowHolding(accessibleName: string): Locator { … has: page.locator(`[aria-label="${accessibleName}"]`) … }
  async function flipToggleIn(row: Locator) { await row.locator(".checkbox-container input").evaluate((el) => (el as HTMLInputElement).click()); }
  ```
  `flipToggleIn` clicks programmatically **on purpose** (a real click moves focus and destroys what that spec
  measures). Once toggles are named it could become `control(name)`-based — optional, outside minimal scope.
- `e2e/selectorGuard.test.ts` — runs under `npm test`; requires `.vicinity-graph-*` selectors used in e2e to be
  rendered in `src/view/`. `aria-label`/`.checkbox-container` selectors are outside its scope.

## 3. Running e2e in THIS environment

`npm run test:e2e` → `scripts/run-e2e.sh`:
1. `OBSIDIAN_PATH` unset → `scripts/setup-obsidian-bin.sh` downloads pinned **Obsidian 1.12.7** into
   `.tmp/obsidian/`. **Already cached here:** `.tmp/obsidian/obsidian-1.12.7/obsidian` (x86_64 Linux) → no
   network needed.
2. No `DISPLAY`/`WAYLAND_DISPLAY` → the script auto-exports
   `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"`. Headless run is plausible here.
3. `npm run setup:dev-vault` (seeds a throwaway copy of `.dev-vault`) then `npm run build` inside `check`.
4. `npx playwright test --config e2e/playwright.config.ts "$@"` — `workers: 1`, serial, `retries: 0`, 120 s
   test timeout, 15 s expect timeout, artifacts → `.tmp/e2e-artifacts`, screenshots → `.out/settings-ux/`.

Implementer commands:
```bash
npm run check                                    # tsc over src + e2e
npm test                                         # vitest fast gate (includes selectorGuard)
npm run test:e2e -- settingsUxVisual.e2e.ts      # the guard spec alone
npm run test:e2e -- settingsDependentRows.e2e.ts # the other toggle-touching spec
```
Gotchas: macOS/Windows need `OBSIDIAN_PATH`; `VICINITY_E2E_VAULT` must stay unset (drives a real vault in
place); bumping the pinned Obsidian version changes slider-readout behaviour; the suite is a release gate, NOT
part of `npm test`. Notes: `docs-internal/notes/e2e-obsidian-docker-setup.md`, README `:229-300`. A known
pre-existing red exists elsewhere (`vicinityGraph.e2e.ts:160` gamma breadcrumb) — unrelated.

## 4. Obsidian API surface (`node_modules/obsidian/obsidian.d.ts`)

```ts
// :7155
export class ToggleComponent extends ValueComponent<boolean> {
    toggleEl: HTMLElement;                 // @since 0.9.7
    constructor(containerEl: HTMLElement);
    setDisabled(disabled: boolean): this;  // @since 1.2.3
    getValue(): boolean;
    setValue(on: boolean): this;
    setTooltip(tooltip: string, options?: TooltipOptions): this;  // @since 1.1.1
    onClick(): void;
    onChange(callback: (value: boolean) => any): this;
}

// :7297
export abstract class ValueComponent<T> extends BaseComponent {
    registerOptionListener(listeners: Record<string, (value?: T) => T>, key: string): this;
    abstract getValue(): T;
    abstract setValue(value: T): this;
}

// :497
export abstract class BaseComponent {
    disabled: boolean;
    then(cb: (component: this) => any): this;   // "Facilitates chaining"
    setDisabled(disabled: boolean): this;
}
```
`Setting.addToggle(cb: (component: ToggleComponent) => any): this` at `:5802`.

**There is NO `inputEl` on `ToggleComponent`** — the only DOM handle is `toggleEl: HTMLElement` (contrast
`SliderComponent.sliderEl: HTMLInputElement` `:6726`, `AbstractTextComponent.inputEl`). Whether `toggleEl` is
the `div.checkbox-container` or the inner `<input type=checkbox>` is NOT stated in the typings, and
`node_modules/obsidian` ships **types only** (`"main": ""`, no JS) — it cannot be resolved from source.
**Must be verified empirically on 1.12.7.**

Consequences to verify, not assume:
- If `toggleEl` is the container div, `nameControl(toggle.toggleEl, name)` puts `aria-label` on a role-less
  `div` — that would NOT satisfy the extended guard, which selects `input[type=checkbox]:not([aria-label])`.
  The input would have to be reached via `toggleEl.querySelector("input")`, itself an assumption needing a probe.
- Whether the real checkbox is visually hidden/zero-size matters for `toBeVisible()` / `getByLabel().click()`
  (existing specs deliberately use `.evaluate(el => el.click())`).
- `src/view/ToggleSwitch.tsx` (our React clone of Obsidian's markup) documents the contract as "a
  `checkbox-container` div (+ `is-enabled` when on) wrapping a native checkbox … Obsidian's app stylesheet
  renders the pill/knob and stretches the invisible checkbox over it" and puts `aria-label` on the **input** —
  in-repo precedent for where the name belongs, but it is our code, not Obsidian's.
- Suggested probe (read-only): dump `outerHTML` of a `.setting-item .checkbox-container` under
  `.vicinity-graph-settings`, plus `document.activeElement` after Tab, plus Playwright's computed accessible
  name (`getByRole('checkbox', { name })`).

## 5. Unit tests / test doubles

There are **no unit tests for `VicinityGraphSettingTab`** and no `Setting`/`ToggleComponent` fake anywhere in
`src/`. The change log states the reason:

> **WHY-NOT a vitest DOM test** — "Vitest runs in a `node` environment and `node_modules/obsidian` is
> types-only (`"main": ""`), so a real `Setting` cannot be constructed. Asserting a hand-written `Setting` fake
> would test the fake, not Obsidian — the guard lives in e2e instead." (`_change_log/2026-07-25_17-41-12Z.md`)

Nothing to extend on the unit side; the guard is e2e-only **by design**.

## 6. Prior ticket & the established pattern

- **This ticket:** `_tickets/settings-tab-toggles-have-no-accessible-name.md`, `nid_d2z2jgt6v49ssej8hxmwd2xi6_e`,
  open, tags `[a11y, settings]`.
- **Prior ticket:** `_tickets/settings-tab-sliders-have-no-accessible-label-a11y.md`,
  `nid_5wiribg2mn0mqcr7ni4ya0cfe_e`, **closed** 2026-07-25; explicitly deferred toggles "to avoid guessing at
  Obsidian internals".
- **Branch `a11y-slider-labels`, merged at `280526f`:** `2f61c7d` file ticket → `a970bc7` exploration →
  `b59a65a` `fix(a11y): give every settings-tab control an accessible name` → `f4a193b` review →
  `b334209` `test(a11y): make the settings-tab accessible-name guard non-vacuous and complete` →
  `3b9403f`/`deff9ea` review rounds (caught a blocking `setDynamicTooltip` removal) → `44d21e9` change log +
  ticket closure. Docs in `.ai_out/a11y-slider-labels/a11y-slider-labels/`.
- **Change log** `_change_log/2026-07-25_17-41-12Z.md` is the template: What changed / WHY-NOT vitest /
  near-miss / verified counts.

**Pattern the toggle fix should keep:**
1. One rule stated once (`nameControl`), applied from the **shared row helper** so future rows inherit it.
   Exclusion toggle is inline (one site); sizing toggles all flow through `addSizingMetricRow` (one site).
2. `aria-label` set from the **same string that renders visibly**; zero use of `aria-labelledby`/`for`/`id`
   pairing anywhere in `src/`.
3. Buttons additionally get `setTooltip(sameString)`; mirroring with `ToggleComponent.setTooltip` is an
   explicit decision (hover UI vs "no visual change"), not a freebie.
4. Guard must be **non-vacuous**: ≥1 positive per-family assertion plus the floor count, mutation-checked
   (temporarily remove one label → RED).
5. Delete the stale exemption comment + `:not([type=checkbox])` clause; bump `MIN_NAMED_CONTROLS` 20 → 26.

### Open questions — answer EMPIRICALLY, not from source
1. Is `ToggleComponent.toggleEl` the `div.checkbox-container` or the inner `input[type=checkbox]` on 1.12.7?
2. Is the inner checkbox focusable/visible enough for `getByLabel(...)` assertions, or must the spec keep
   `.evaluate(el => el.click())` and attribute-level assertions?
3. Toggle name text: bare row label (`"Own file size"`) with `exact: true` locators, or disambiguated
   (`"Own file size enabled"`) given the sibling `"Own file size weight"` input?
