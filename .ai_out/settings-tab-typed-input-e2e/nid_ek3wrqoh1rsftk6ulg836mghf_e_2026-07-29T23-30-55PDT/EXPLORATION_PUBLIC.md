# Exploration: settings-tab typed-input e2e spec

Repo root: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin`

## 1. `e2e/obsidianHarness.ts` — public API

Class `ObsidianHarness` (constructor is private; use statics).

- `static resolveObsidianPath(): string` — reads `OBSIDIAN_PATH`, throws with actionable message if unset/missing.
- `static async launch(options?: LaunchOptions): Promise<ObsidianHarness>` — fresh Obsidian on a throwaway `.dev-vault` copy (or `VICINITY_E2E_VAULT` external vault). `options.extraFixtures?: Record<string,string>` layers extra vault notes on the built-in `crowd/` fixture set.
- `async relaunch(): Promise<ObsidianHarness>` — closes current instance, reopens against the SAME vault copy/config (no re-seed) — used to prove persistence survives restart.
- `async close(): Promise<void>` — disconnects CDP + kills the Electron process (waits for exit).
- `readonly page: Page` — the Playwright `Page` for Obsidian's renderer, reached via `chromium.connectOverCDP` (NOT `_electron.launch` — see file's WHY-NOT comment, obsidianHarness.ts:28-32).
- `async openFile(vaultPath: string): Promise<void>` (line 254) — opens a vault file in a main-area leaf via `app.workspace.getLeaf(false).openFile(file)`.
- `async executeCommand(commandId: string): Promise<void>` (line 267) — `app.commands.executeCommandById(id)`, throws if it returns falsy.
- `async graphViewPlacements(): Promise<ObservedGraphPlacement[]>` (line 278).
- `async openGraphView(): Promise<void>` (line 292) — runs `OPEN_GRAPH_COMMAND_ID`, waits for `.vicinity-graph-flow, .vicinity-graph-empty` to attach, detaches other right-sidebar leaves.
- `async remountGraphView(): Promise<void>` (line 333).
- **Persisted-state helpers** (THE one place that knows the `pluginDataStore` shape — specs should go through these, not hand-roll `app.plugins.plugins[id].pluginDataStore` calls):
  - `async readGlobals(): Promise<PluginGlobalsSnapshot>` (line 353) — `{ view, depths, exclusion }` in ONE round trip.
  - `async readGlobalView(): Promise<ViewSettings>` (line 365).
  - `async saveGlobalView(patch: Partial<ViewSettings>): Promise<void>` (line 378) — SHALLOW merge over current `store.globalView()`.
  - `async saveGlobalDepths(depths: DepthSettings): Promise<void>` (line 389).
  - `async saveNodeExclusion(exclusion: NodeExclusionSettings): Promise<void>` (line 400).
  - `async refreshOpenViews(): Promise<void>` (line 419) — rebuilds every open GRAPH view (not the settings tab; reaches `plugin.refreshOpenViews()` — private, called by name via an `any` cast).
  - `async reloadPlugin(): Promise<void>` (line 433) — disable/enable to drop in-memory state, so a subsequent read proves it came off `data.json`.
  - `async setGlobalNodeCap(nodeCap: number): Promise<void>` (line 447).
  - `async setMaxNodeSizePx(maxPx: number): Promise<void>` (line 456) — shallow-merges `sizing.maxPx` via `saveGlobalView`.
  - `async setNodePreviewPreference(pref): Promise<void>` (line 471) — writes + `refreshOpenViews()` (graph views, not tab).
  - `async setTheme(theme: "dark"|"light"): Promise<void>` (line 488) — toggles body class only, no persistence (safe under `VICINITY_E2E_VAULT`).
- Constants: `PLUGIN_ID = "vicinity-graph"`, `OPEN_GRAPH_COMMAND_ID`, `OPEN_GRAPH_BELOW_COMMAND_ID`.

**Opening the settings tab is NOT on `ObsidianHarness`** — it is `SettingsTabPage.open()` (see §2), which internally does `app.setting.open(); app.setting.openTabById(pluginId)` via `page.evaluate`.

Every spec's shape: `test.beforeAll` calls `harness = await ObsidianHarness.launch()`, `page = harness.page`, `settingsTab = new SettingsTabPage(page)`; `test.afterAll` calls `await harness?.close()`. Suites that share state across tests use `test.describe.configure({ mode: "serial" })`.

## 2. Page objects / selector patterns / selector guard

### `e2e/settingsTabPage.ts` — `class SettingsTabPage`
- `constructor(private readonly page: Page)`
- `async open(): Promise<void>` (line 32) — `app.setting.open(); app.setting.openTabById(PLUGIN_ID)`, then waits `expect(page.locator(".vicinity-graph-settings-section")).toHaveCount(SETTINGS_TAB_SECTIONS.length)`. **Always call this before touching the tab DOM** — `openTabById` returns before `display()` paints.
- `async close(): Promise<void>` (line 42) — `app.setting.close()`.
- `async redisplay(): Promise<void>` (line 51) — re-runs the active tab's `display()`; use after writing the store directly (bypassing the UI) so the DOM reflects it. `?.` because window may be closed.
- `card(headingText: string): Locator` (line 56) — `.vicinity-graph-settings-section` with `hasText: headingText`.
- `resetButton(headingText: string): Locator` (line 61) — `card(...).locator(".vicinity-graph-settings-reset button")`.
- `resetAllRow(): Locator` / `resetAllButton(): Locator` (lines 66-73) — `.vicinity-graph-settings-reset-all` (+ its `button`).
- `confirmDialog(): Locator` (line 80) — `openModals().last()` (settings window itself is also a `.modal-container`).
- `dialogButton(text: string): Locator` (line 85) — button inside confirmDialog filtered by text.
- `openModals(): Locator` (line 94) — `.modal-container` (count 1 ⇒ nothing else raised).

For the two target rows (see §6), a generic accessible-name locator pattern used across the suite (`settingsDependentRows.e2e.ts:96-104`):
```ts
function control(accessibleName: string): Locator {
  return page.locator(".vicinity-graph-settings").getByLabel(accessibleName);
}
function rowHolding(accessibleName: string): Locator {
  return page.locator(".vicinity-graph-settings .setting-item", {
    has: page.locator(`[aria-label="${accessibleName}"]`),
  });
}
```
`settingsUxVisual.e2e.ts:334-350` confirms every non-radio input/select/textarea in the tab MUST carry `aria-label` (its own guard test), e.g. `settings.getByLabel("Node cap")` → `type=number`, `settings.getByLabel("Exclusion patterns")` → the textarea.

### `e2e/settingsBaseline.ts`
Pure (no `fs`/`obsidian`/`react`) data module deriving e2e-side names FROM `src/view/settingsRows.ts` / `settingsResetPlan.ts` / `settingsSectionFields.ts` so nothing is re-typed:
- `SETTINGS_TAB_SECTIONS: readonly {scope, heading, resetName}[]` — one per card in render order.
- `SETTINGS_TAB_SECTION_HEADINGS`, `SECTION_RESET_NAMES`, `ALL_SETTINGS_RESET_NAME`, `ALL_SETTINGS_RESET_DESCRIPTION`, `EVERY_SETTINGS_RESET_NAME`, `ALL_SETTINGS_RESET_CONFIRM_TITLE`.
- `CONTROLS_PANEL_DISCLOSURES` / `CONTROLS_PANEL_DISCLOSURE_SUMMARIES` / `FORCE_LAYOUT_RESET_NAME` — controls-PANEL (not tab) specific, not needed for this task.

For "Node sizing" and "Node exclusion" card headings, use `settingsTab.card("Node sizing")` / `settingsTab.card("Node exclusion")` directly (matches `SETTINGS_GROUPS["node-sizing"].heading` = `"Node sizing"`, `["node-exclusion"].heading` = `"Node exclusion"`).

### `e2e/selectorGuard.test.ts` (runs under `npm test`, vitest — NOT part of `test:e2e`)
Enforces: every `.vicinity-graph-*` class string an e2e `.ts` file (page-object or spec) puts inside a **selector locator string** (i.e. prefixed with a literal dot, e.g. `page.locator(".vicinity-graph-settings-error")`) must be rendered somewhere under `src/view/**/*.{ts,tsx}` (excluding `*.test.ts(x)`) as a bare `className="…"` or Obsidian `{ cls: "…" }` string literal. Rules relevant to writing a new spec:
- Only DOTTED occurrences count as "asserted" (a bare word inside prose/comments doesn't count).
- Interpolated tails (`` `.vicinity-graph-node--${tier}` ``) are skipped (cannot be resolved statically) — safe to use freely.
- A `toHaveCount(0)` on the SAME line as the class exempts it from the "must be rendered" requirement (absence assertions).
- Anything not prefixed `vicinity-graph-` (e.g. Obsidian's `.setting-item`, `.checkbox-container`, `.tooltip`, `.modal-container`) is out of scope — free to use.
- `.vicinity-graph-settings-error` (target class for inline feedback — see §7) IS rendered in `src/view/VicinityGraphSettingTab.ts:331` (`cls: "vicinity-graph-settings-error"`), so asserting on it in a new spec passes the guard.

## 3. `src/view/VicinityGraphSettingTab.ts` — row rendering, DOM, feedback, `hide()`

### Row frame (`row()`, static, line 350-356)
```ts
new Setting(container).setName(row.label)  // + .setDesc(row.description) if present
```
Renders Obsidian's standard `.setting-item` with `.setting-item-info` (`.setting-item-name` = label text, `.setting-item-description` = description) and `.setting-item-control` holding the input.

### Accessible names
- `nameControl(el, accessibleName)` (line 135) sets `el.setAttribute("aria-label", accessibleName)` directly on the `<input>`/`<textarea>`/`<button>`.
- `nameToggle(toggle, accessibleName)` (line 154) sets `aria-label` on the checkbox `<input>` INSIDE Obsidian's `.checkbox-container` label (not the label itself).
- Row name for a sole-control row: `SettingsRowNames.sole(row)` = `row.label` verbatim (import from `settingsRows.ts`). For two-control rows (sizing metric enable+weight): `SettingsRowNames.role(row, "enabled" | "weight")` appends a role suffix, e.g. `"<Metric> weight"`.

### Inline feedback slot — `addFeedbackSlot` (static, line 330-332)
```ts
private static addFeedbackSlot(setting: Setting, role: "alert" | "status"): HTMLElement {
  return setting.descEl.createDiv({ cls: "vicinity-graph-settings-error", attr: { role } });
}
```
- MUST be created AFTER `setDesc()` (it lives inside `descEl`).
- `role="alert"` for sizing-number rows (interrupts on a REFUSED value); `role="status"` for the exclusion-patterns textarea (per-keystroke advisory, must not interrupt).
- Empty `textContent` hides it via CSS `:empty { display: none }` (§7) — showing/clearing is one assignment.
- Two render helpers write into it:
  - `showVerdict(slot, input, verdict: SizingRowVerdict)` (line 335-338) — used for sizing-number rows: `slot.textContent = verdict.message ?? ""`; `input.setAttribute("aria-invalid", String(verdict.rejected))`.
  - `showWarning(slot, feedback: SettingsFeedback | undefined)` (line 344-347) — used for exclusion patterns: `slot.textContent = feedback?.message ?? ""`; `slot.title = feedback?.detail ?? ""` (never sets `aria-invalid` — patterns are surfaced, not rejected).

### Max-node-size row — `addSizingNumber` (lines 555-598)
- `text.inputEl.type = "number"`, bounds applied via `applyBounds` (`min`, `max`, `step` HTML attrs from `accessor.bounds`).
- `nameControl(text.inputEl, name)` where `name = SettingsRowNames.sole(row)` = `"Maximum node size (px)"` for the maxPx row (label from `settingsRows.ts:325`).
- `flushOnBlur(text.inputEl)` registers a `blur` listener calling `settlePendingWrites()`.
- Initial verdict shown on render: `showVerdict(feedback, text.inputEl, write.judge(stored))` — so even a pre-existing inverted pair on open shows the error immediately (no keystroke needed).
- `text.onChange((raw) => {...})`:
  - `accessor.accept(raw)` = `parseSizingInput(raw)` — `undefined` for blank/non-numeric/non-finite ⇒ `debounced.drop(name)` (forgets pending write) and returns.
  - Else `verdict = write.judge(parsed)`; `showVerdict(...)`; if `verdict.rejected` ⇒ `debounced.drop(name)`, return (NOTHING is scheduled — a rejected value never persists, and the field itself keeps the typed text).
  - Else `debounced.schedule(name, thunk)` where thunk applies `write.interactionIfAccepted(parsed)` through the pipeline's writer.

### Exclusion-patterns row — `addExclusionPatterns` (lines 461-487)
- `text.inputEl.rows = EXCLUSION_TEXTAREA_ROWS` (4).
- `nameControl(text.inputEl, name)` where `name = "Exclusion patterns"`.
- `text.setDisabled(isSettingsRowDisabled(row, state))` — ALWAYS rendered, disabled when the "Exclude notes from the graph" toggle (`exclusion-enabled`) is off. Registered as a `DependentControl` so `applyRowDependencies` can flip it in place without a rebuild.
- Initial feedback shown on render via `describeInvalidExclusionPatterns(initial)` (see §5).
- `text.onChange((raw) => {...})`: ALWAYS shows the warning (never rejects/drops), and ALWAYS schedules a write: `debounced.schedule(name, (writer) => writer.apply(accessor.interaction(parseExclusionPatterns(raw))))` — invalid lines are simply not written into the stored list (they are filtered out only for compile failures downstream by the engine, but `parseExclusionPatterns` itself just trims/splits — the INVALID-but-nonblank pattern IS still stored verbatim; the engine skips it at match time). So typing an invalid regex line into the textarea and letting it settle WILL persist that literal line into `exclusion.patterns`, with the feedback slot showing the warning.

### `hide()` (lines 284-287)
```ts
hide(): void {
  void this.settlePendingWrites();
  super.hide();
}
```
`settlePendingWrites()` (lines 312-318) calls `await this.debounced.flush()` (§4) wrapped in try/catch (logs on error, never throws) — so closing the settings window (or navigating away) flushes any pending debounced write immediately rather than waiting out the window. A spec can therefore either (a) wait `SETTINGS_WRITE_DEBOUNCE_MS` (400ms, via `expect.poll`), or (b) trigger `hide()` (e.g. `settingsTab.close()`, which calls `app.setting.close()` → Obsidian calls the tab's `hide()`) to force an immediate flush, or (c) blur the field (`flushOnBlur` is wired on every typed input) to flush without closing anything.

## 4. `src/view/settingsDebounce.ts` — debounce semantics

- `SETTINGS_WRITE_DEBOUNCE_MS = 400` (`src/view/constants.ts:29`), distinct from `REBUILD_DEBOUNCE_MS = 500` (constants.ts:19, graph rebuild after a settings change — NOT the write debounce).
- `class DebouncedSettingsWrites` (constructed once per tab instance, `this.debounced = new DebouncedSettingsWrites(SETTINGS_WRITE_DEBOUNCE_MS, this.writes)`):
  - `schedule(field: string, write: SettingsWriteThunk): void` — replaces `field`'s pending write (latest-wins per field) and RESTARTS the whole shared settle window (so a second keystroke resets the 400ms clock).
  - `drop(field: string): void` — removes `field`'s pending write with no persist (used for rejected/blank values).
  - `flush(): Promise<void>` — cancels the timer and drains immediately, resolves once persisted (or the error is swallowed/logged, see `settlePendingWrites`).
  - Internal `drain()` runs all pending thunks, in edit (insertion) order, through ONE `writes.runSerialised(...)` call, each awaited before the next.
- Practical e2e wait strategies:
  1. `await page.waitForTimeout(500)` after the last keystroke (gives 400ms window + margin) then read via `harness.readGlobals()`.
  2. Preferred idiom used elsewhere in the suite: `await expect.poll(async () => (await harness.readGlobalView()).sizing.maxPx).toBe(200)` — polls until the debounced write lands, no manual timing.
  3. Blur the field (`input.blur()` or click elsewhere) — triggers `flushOnBlur`'s immediate `settlePendingWrites()`.
  4. `await settingsTab.close()` — triggers `hide()` → `settlePendingWrites()` (guaranteed flush), but tears down the tab, so only use at the end of a test.
- There is NO exported test double for the scheduler reachable from e2e (that's `src/view/settingsDebounce.test.ts`'s concern, unit-level with an injectable `DebounceScheduler`); e2e must go through the REAL 400ms window (via `expect.poll` or blur).

## 5. `src/view/settingsValidation.ts` — exact rejection messages

### (a) Inverted max/min node size — `describeSizingRejection(sizing: SizingSettings): string | undefined` (lines 76-81)
Rule: `sizing.maxPx >= sizing.minPx` is FINE (equal allowed); otherwise:
```
`Not applied: maximum node size (${sizing.maxPx}px) must be at least the minimum (${sizing.minPx}px).`
```
Example with defaults minPx=40: typing `maxPx = 30` while `minPx` stays 40 produces exactly:
```
Not applied: maximum node size (30px) must be at least the minimum (40px).
```
This message is shown via `showVerdict` into `.vicinity-graph-settings-error`, and the input gets `aria-invalid="true"`. Nothing is written (`SizingRowWrite.judge`/`interactionIfAccepted` both refuse — see `src/view/sizingRowWrite.ts:51-75`). The rejection check is CROSS-FIELD only for `minPx`/`maxPx` (`CROSS_FIELD_ROWS` set in `sizingRowWrite.ts:28`); `depthDecayK` is exempt.

Also, even a value that IS accepted but gets clamped shows a (non-rejecting) notice: `` `Stored as ${stored} — the allowed range is ${range.min}–${range.max}.` `` (`sizingRowWrite.ts:92-99`, `aria-invalid` stays `"false"` since `rejected=false`). For maxPx the range is `min:1, max:400, step:4` (see §6) — e.g. typing `99999` would show `Stored as 400 — the allowed range is 1–400.`

### (b) Invalid regex line in exclusion patterns — `describeInvalidExclusionPatterns(raw: string): SettingsFeedback | undefined` (lines 58-69)
Per invalid (non-compiling) NON-BLANK line (1-based, blank lines don't count towards numbering... actually blank lines ARE counted for line number since `numberedPatternLines` maps over `raw.split("\n")` with `index+1` BEFORE filtering blanks — so line numbers are literal textarea line numbers, blank or not):
```
message: invalid.map(({lineNumber, pattern}) =>
  `Line ${lineNumber}: "${pattern}" is not a valid regular expression — ignored.`
).join("\n")

detail: invalid.map(({lineNumber, reason}) =>
  `Line ${lineNumber}: ${reason}`
).join("\n")
```
`message` is what lands in `.vicinity-graph-settings-error` textContent (CSS `white-space: pre-line` — multi-line messages wrap by embedded `\n`, §7). `detail` becomes the element's `title` attribute (hover tooltip), NOT visible text.
- The offending line IS named, both in the visible message (`Line N: "pattern" is not a valid...`) and in the hover detail (`Line N: <engine's own regex compile error>`), via `PathExclusionMatcher.compileFailure(pattern)` (asked of the real engine, not re-implemented — `settingsValidation.ts:49`).
- Example: textarea content `^archive/\n[unterminated` → line 2 is invalid → message:
```
Line 2: "[unterminated" is not a valid regular expression — ignored.
```
- Ignored lines are NEVER rejected from the write: `parseExclusionPatterns(raw)` (line 39-41) just trims/splits/drops-blanks — it does NOT filter out non-compiling lines, so the invalid pattern IS persisted into `exclusion.patterns` verbatim; only the graph engine skips it at match time. A spec should therefore assert BOTH the visible warning text AND that `harness.readGlobals().exclusion.patterns` still contains the literal invalid line after the debounce settles.
- To get a concrete "not a valid regular expression" from a JS regex compile, use an unbalanced bracket/paren, e.g. `"["` or `"(unclosed"`.

## 6. Concrete target rows

From `src/view/settingsRows.ts` (`SETTINGS_GROUPS`):
- **Max node size row** (`"node-sizing"` section, card heading `"Node sizing"`, `src/view/settingsRows.ts:325`):
  ```ts
  { label: "Maximum node size (px)", control: { kind: "sizing-number", field: "maxPx" } }
  ```
  Sibling row: `{ label: "Minimum node size (px)", control: { kind: "sizing-number", field: "minPx" } }` (line 324) — useful to seed a known `minPx` via `harness.saveGlobalView({ sizing: { ...view.sizing, minPx: 40 } })` before typing an inverted `maxPx`.
  Accessor: `SettingsRowAccessors.sizingNumber("maxPx")` (`src/view/settingsRowAccessors.ts:148-157`) — `bounds: SIZING_RANGES.maxPx = { min: 1, max: 400, step: 4 }` (from `NODE_SIZE_PX_BOUNDS` in `src/engine/SettingsSpec.ts:154`, default 160px, `src/engine/SettingsSpec.ts:231`), `accept: parseSizingInput`, `interaction: (value) => ({ kind: "global-sizing-number", field: "maxPx", value: settlesAt(value) })`.
  Locator: `settingsTab.card("Node sizing").getByLabel("Maximum node size (px)")`, type=`number`.

- **Exclusion-patterns row** (`"node-exclusion"` section, card heading `"Node exclusion"`, `src/view/settingsRows.ts:383-388`):
  ```ts
  {
    label: "Exclusion patterns",
    description: "One regular expression per line, tested (case-sensitively, unanchored) against each note's vault path including extension. E.g. `^archive/` matches the archive folder at the vault root; `templates/` matches anywhere. Invalid patterns are ignored.",
    control: { kind: "exclusion-patterns" },
    disabledWhen: "exclusion-enabled",
  }
  ```
  Sibling toggle: `{ label: "Exclude notes from the graph", control: { kind: "exclusion-enabled" } }` — the textarea is DISABLED unless this toggle is on; a spec must flip it first via UI click on `settingsTab.card("Node exclusion").locator(".checkbox-container input")` (programmatic `.evaluate(el => el.click())`, per `settingsDependentRows.e2e.ts:112-114`) OR seed `harness.saveNodeExclusion({ enabled: true, patterns: [...] })` + `settingsTab.redisplay()`.
  Accessor: `SettingsRowAccessors.exclusionPatterns()` (`settingsRowAccessors.ts:235-239`) — no bounds (plain string-array value), `interaction: (patterns) => ({ kind: "global-exclusion-patterns", patterns })`.
  Locator: `settingsTab.card("Node exclusion").getByLabel("Exclusion patterns")` (also `.locator("textarea")`, since the card has exactly one), `disabled` state gate via `toBeEnabled()`/`toBeDisabled()`.

## 7. `.vicinity-graph-settings-error` CSS — `src/view/settings-tab.css:89-102`

```css
.vicinity-graph-settings .vicinity-graph-settings-error {
  margin-top: var(--size-2-2);
  color: var(--text-error);
  font-size: var(--font-ui-smaller);
  white-space: pre-line;   /* messages are newline-joined, one per offending line */
}
.vicinity-graph-settings .vicinity-graph-settings-error:empty {
  display: none;
}
```
Asserted-able:
- Presence/count: `settingsTab.card("Node sizing").locator(".vicinity-graph-settings-error")` should exist per row that has a feedback slot (max/min/depthDecayK sizing rows + exclusion-patterns row — 4 total feedback slots in the tab, one per `addFeedbackSlot` call site).
- Visibility toggling is IMPLICIT via `:empty` — an empty slot has `display:none`, so `toBeVisible()`/`toBeHidden()` is a valid proxy for "has a message" vs not, in addition to asserting `textContent`/`toContainText(...)`.
- `role` attribute differs by row: `role="alert"` for the sizing-number slot, `role="status"` for the exclusion-patterns slot — assertable via `toHaveAttribute("role", "alert"|"status")`.
- `aria-invalid` lands on the INPUT itself (not the feedback slot) — only for sizing rows (`showVerdict`), never set for exclusion patterns (`showWarning` never touches it).
- `white-space: pre-line` means a multi-line invalid-patterns message (several bad lines) renders as multiple visual lines from embedded `\n` — a computed-style assertion (`getComputedStyle(el).whiteSpace === "pre-line"`) can prove the CSS reached the DOM, mirroring the existing `borderTopStyle`/`overflow` computed-style probes in `settingsUxVisual.e2e.ts:276-277,441-452`.

## 8. Running e2e / typing rules

- `npm run test:e2e` = `bash scripts/run-e2e.sh` → auto-resolves `OBSIDIAN_PATH` (downloads a pinned Obsidian via `scripts/setup-obsidian-bin.sh` if unset, Linux/Docker), auto-detects headless (`--ozone-platform=headless --disable-gpu` when no `$DISPLAY`/`$WAYLAND_DISPLAY`), runs `npm run setup:dev-vault` (or `npm run build` if `VICINITY_E2E_VAULT` is set), then `npx playwright test --config e2e/playwright.config.ts <extra args>`. Extra args pass through file filters, e.g. `npm run test:e2e -- settingsTypedInput.e2e.ts`.
- `e2e/playwright.config.ts`: `testMatch: "**/*.e2e.ts"` (so a new spec file MUST be named `*.e2e.ts` to be picked up), `timeout: 120_000` per test, `expect.timeout: 15_000` (retry window for `expect(...)`/`expect.poll(...)`), `workers: 1`, `fullyParallel: false`, `retries: 0` — single serial Obsidian instance across the whole run, so a new spec file runs after/alongside the others in the same launched app unless it manages its own `beforeAll`/`afterAll` harness (every existing spec launches its OWN harness in `beforeAll`).
- Whether it can run IN THIS SANDBOXED ENVIRONMENT: requires either a pre-set `OBSIDIAN_PATH` or network access to download Obsidian (`setup-obsidian-bin.sh`), plus the ability to spawn an Electron process with `--no-sandbox` (Linux). This may or may not be available in the current harness — the implementer should attempt `npm run test:e2e -- <newfile>.e2e.ts` and treat a launch failure (missing binary / no network / no permission to spawn) as an environment limitation, not a code defect; typing rules (`npm run check:e2e`) should still be verified as they require no Electron.
- `npm run check:e2e` = `tsc -noEmit -p e2e/tsconfig.json` — `e2e/tsconfig.json` extends the ROOT `tsconfig.json` (same strict flags: `noUncheckedIndexedAccess`, `noImplicitReturns`, etc. — verify against root `tsconfig.json` if stricter rules are needed), overrides `compilerOptions.types: ["node"]` (no DOM/browser globals beyond what `page.evaluate` callbacks need — those callbacks run in the RENDERER and get DOM typings from the root config's `lib`), and `include: ["./**/*.ts"]` — so any new `.ts` file placed under `e2e/` is automatically included and must type-check. `npm run check` runs `tsc -noEmit` (root/src) THEN `check:e2e`; `npm run build` runs `check` first. `scripts/run-e2e.sh` relies on `npm run build`/`npm run setup:dev-vault` already type-checking `e2e/`, so a broken new spec fails BEFORE Obsidian even launches.
- `npm test` (vitest) does NOT run `*.e2e.ts` files — it only picks up `src/**/*.test.{ts,tsx}` and the e2e HARNESS guard tests (`e2e/*.test.ts`, e.g. `selectorGuard.test.ts`, `vaultTarget.test.ts`, `settingsBaseline.test.ts`) — a new `*.e2e.ts` spec is invisible to `npm test` and only exercised by `npm run test:e2e`.

## Other useful references
- `src/view/constants.ts:19` `REBUILD_DEBOUNCE_MS = 500` and `:29` `SETTINGS_WRITE_DEBOUNCE_MS = 400` — two DIFFERENT debounces; a settings write triggers a store persist (400ms) and, on refresh, a separate graph-rebuild debounce (500ms) — not relevant to the settings TAB itself (the tab doesn't auto-rebuild the graph; `redisplay()`/writes only affect the store + open GRAPH views via `refreshOpenViews`, which the settings tab itself never calls automatically).
- `src/view/settingsRowAccessors.ts` accessor shapes: `SettingsValueAccessor<T>` (`{read,interaction}`) vs `SettingsTrackAccessor`/`SettingsTypedNumberAccessor` (adds `bounds`, `settlesAt`, and for typed-number also `accept: (raw:string) => number|undefined`).
- `src/view/sizingInput.ts` `parseSizingInput` — rejects blank string, non-numeric, and non-finite (`Infinity`/`NaN`); this is the ONE gate for whether a keystroke even reaches `SizingRowWrite.judge`.
- Existing typed-input coverage in the repo is ZERO for the settings TAB (confirmed): `settingsDependentRows.e2e.ts` only clicks toggles (`flipToggleIn` via programmatic `.click()`), never types into a text/number/textarea field and never asserts `.vicinity-graph-settings-error` or the debounce window. `settingsResetVerify.e2e.ts` / `settingsUxVisual.e2e.ts` write via `harness.save*` + `redisplay()` and read rendered values; the controls-PANEL slider test in `settingsUxVisual.e2e.ts:230-263` types via a synthetic native-setter `input`-event dispatch on a RANGE input (not a text/number field, and sliders are NOT debounced — `addSlider` calls `writes.apply` directly, no `DebouncedSettingsWrites` involvement). None of this exercises `DebouncedSettingsWrites`, `parseSizingInput`, `SizingRowWrite`, or `describeInvalidExclusionPatterns` end-to-end in a real browser — this is genuinely new ground.
