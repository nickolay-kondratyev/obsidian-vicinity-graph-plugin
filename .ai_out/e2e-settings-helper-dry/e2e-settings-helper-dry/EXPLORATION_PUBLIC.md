# EXPLORATION_PUBLIC — settings-e2e DRY refactor

Source: read-only Explore sub-agent (returned inline; transcribed here by TOP_LEVEL_AGENT).
Line numbers are as-of branch `e2e-settings-helper-dry` @ `578f910`. **Re-verify before editing.**

---

## 1. Local helpers in the three specs

### `e2e/settingsResetReview.e2e.ts` (serial; `OUT_DIR=".out/settings-reset-review"`)
- `readGlobals(): Promise<Globals>` (51-56) — typed via local `interface Globals` (37-49); reads `store.globalView()/globalDepths()/nodeExclusion()`.
- `dirtyEverySection()` (59-78) — writes depths, view (incl. `nodePreviewPreference: "image"`), exclusion, then `app.setting.activeTab?.display()`. Unique to this spec.
- `openSettingsTab()` (80-87):
  ```ts
  async function openSettingsTab(): Promise<void> {
      await page.evaluate((pluginId) => {
          const app = (window as any).app;
          app.setting.open();
          app.setting.openTabById(pluginId);
      }, PLUGIN_ID);
      await expect(page.locator(".vicinity-graph-settings-section")).toHaveCount(SETTINGS_TAB_SECTIONS.length);
  }
  ```
- `card(headingText)` (89-91) — `page.locator(".vicinity-graph-settings-section", { hasText: headingText })`.
- `resetButton(headingText)` (93-95) — `card(headingText).locator(".vicinity-graph-settings-reset button")`.
- `confirmDialog()` (102-104) — `page.locator(".modal-container").last()`; comment notes Obsidian's settings window is itself a `.modal-container`.
- `dialogButton(text)` (106-108) — `confirmDialog().locator("button").filter({ hasText: text })`. **Only here.**
- `storeHiddenPatterns()` (215-223) — spec-local.
- Theme: uses `harness.setTheme("dark"/"light")` (339, 342).

### `e2e/settingsResetVerify.e2e.ts` (serial; `OUT_DIR=".out/settings-reset-verify"`)
- `readGlobals(): Promise<any>` (47-52) — **same body** as review's, but returns `any` (loses the typed shape).
- `openSettingsTab()` (54-61) — **byte-identical** to review's, incl. the `toHaveCount` wait.
- `card` (63-65), `resetButton` (67-69), `confirmDialog()` (72-74) — **identical** to review's.
- `setExclusion(enabled, patterns)` (76-85) — spec-local write helper.
- **LOCAL `setTheme` (155-158) — the divergent one:**
  ```ts
  async function setTheme(theme: "moonstone" | "obsidian"): Promise<void> {
      await page.evaluate((t) => (window as any).app.customCss.setTheme?.(t) ?? (window as any).app.changeTheme(t), theme);
      await page.waitForTimeout(200);
  }
  ```
  Diverges from `ObsidianHarness.setTheme` in three ways: (a) native theme ids `moonstone`/`obsidian` vs `light`/`dark`; (b) drives a **real Obsidian API** vs toggling `document.body` classes; (c) adds a magic-number `waitForTimeout(200)`.

### `e2e/settingsUxVisual.e2e.ts` (serial; `OUT_DIR=".out/settings-ux"`; also drives the graph view)
- `toolbar()` (45-47), `disclosure(summaryText)` (49-53), `setOpen(details, open)` (55-59), `topLevelPanelSummaries()` (94-98) — unique to this spec.
- `readGlobals()` (212-217) — **narrower**: `Promise<{ view: { nodeCap: number }; depths: { outgoingDepth: number } }>`, reads only `globalView()`/`globalDepths()`, no exclusion.
- `openSettingsTab()` (219-225) — **diverges: NO `toHaveCount` wait** (unlike review/verify). Additionally the same open-tab `evaluate` block is inlined separately at 187-191, *before* this helper is defined → open-tab logic written 3× in this one file.
- **No** local `card`/`resetButton`/`confirmDialog` — locators inlined per test (e.g. 301, 310, 314: `.vicinity-graph-settings-reset-all`, `.modal-container` last, etc.).
- `storedPreviewPreference()` (342-346), `seedPreviewPreference(value)` (352-361), `tabPreviewRadio(optionLabel)` (364-368) — unique (Preview-pill).
- Theme: `harness.setTheme("dark"/"light")` (205, 207, 429, 432).

### Divergence summary (what unification must reconcile)
1. **`readGlobals`** — 3 return shapes: typed `Globals` (review) / `any` (verify) / narrow inline `{view.nodeCap, depths.outgoingDepth}` (ux-visual).
2. **`openSettingsTab`** — review == verify (with wait); ux-visual omits the wait + duplicates inline.
3. **`setTheme`** — harness (2 specs) vs local native-id + 200ms wait (verify). Not drop-in interchangeable.
4. **`card`/`resetButton`/`confirmDialog`** — review == verify; ux-visual inlines equivalents.
5. **`dialogButton`** — review only.

---

## 2. `ObsidianHarness` public API (`e2e/obsidianHarness.ts`)

`static resolveObsidianPath()` (121) · `static async launch(options)` (147) · `relaunch()` (167) · `close()` (208) · `openFile(vaultPath)` (242) · `openGraphView()` (255) · `remountGraphView()` (302) · `setGlobalNodeCap(nodeCap)` (313) · `setMaxNodeSizePx(maxPx)` (330) · `setEdgeVisibility(mode: EdgeVisibilityMode)` (353) · `setNodePreviewPreference(preference: "auto"|"outline"|"image")` (373) · `readGlobalView(): Promise<GlobalViewSnapshot>` (390) · `setTheme(theme: "dark"|"light")` (398) · readonly `page: Page` (115). Everything else is `private static`.

**`setTheme` (397-403)** — toggles body classes only; no real Obsidian theme API, no wait:
```ts
document.body.classList.toggle("theme-dark", mode === "dark");
document.body.classList.toggle("theme-light", mode === "light");
```

**Type-import asymmetry** — line 16 already has the good pattern:
```ts
// Type-only, so it is erased at transpile — the pure engine barrel never loads in the node-side test process.
import type { EdgeVisibilityMode } from "../src/engine";
```
…while `setNodePreviewPreference` (373) hand-repeats `"auto" | "outline" | "image"`. **This is scope item 4.**

**`GlobalViewSnapshot` (49-52)** = `{ nodeCap; sizing: { metrics: Record<string, {enabled, weight}> } }`. ⚠ This does **NOT** overlap the specs' `sizing.{minPx,maxPx,depthDecayK}`, and carries no depths / exclusion / forceLayout / nodePreviewPreference.

---

## 3. `e2e/settingsBaseline.ts` — the model to follow

Pure module (no `obsidian`/`react`/`fs` — documented at 26-30); imports only `../src/view/settingsResetPlan`.
Exports: `SectionResetScope` (33) · `SettingsTabSection` (51-57) · `SETTINGS_TAB_SECTIONS` (60-64) · `SETTINGS_TAB_SECTION_HEADINGS` (67-69) · `SECTION_RESET_NAMES` (72) · `ALL_SETTINGS_RESET_NAME` (75) · `EVERY_SETTINGS_RESET_NAME` (78) · `ALL_SETTINGS_RESET_CONFIRM_TITLE` (81) · `PanelDisclosure` (84-96) · `CONTROLS_PANEL_DISCLOSURES` (116-122) · `CONTROLS_PANEL_DISCLOSURE_SUMMARIES` (125-127) · `PINNED_CENTRALS_SUMMARY` (137). `SECTION_CARD_HEADINGS` (41-48) is internal, not exported.

Consumed by: review (5-9), verify (5), ux-visual (5-13).

---

## 4. `e2e/vaultTarget.test.ts` — HARD constraints on every top-level `e2e/*.ts`

Scans **every** `.ts` directly in `e2e/` except itself (166-168, via `readdirSync`) — **a new module is auto-in-scope**. Three rules:

1. **Mutating `fs.*` destinations must root at a literal safe constant** (170-178):
   `const SAFE_WRITE_ROOTS = /^(VAULT_COPY_DIR|SANDBOX_CONFIG_DIR|OUT_DIR)\b/;`
   `mutatingDestinations` (211-228) regex-scans `fs.(\w+)\(`, skipping `READ_ONLY_FS_MEMBERS` (`existsSync, statSync, lstatSync, realpathSync, readFileSync, readdirSync`); destination arg index per `DESTINATION_ARG_INDICES` (`cpSync`/`copyFileSync`/`linkSync`/`symlinkSync` → 1; `renameSync` → both 0 and 1; default 0), after peeling `path.join(`/`path.dirname(`/`path.resolve(` prefixes.
   ⚠ **Literal source-text scan, not type-aware** — aliasing the constant under another name defeats it and fails the test.
2. **No async fs API** (180-185): no `node:fs/promises`, no `fs.promises`.
3. **Exact import line** (187-202): `const NAMESPACE_FS_IMPORT = /^import \* as fs from "node:fs";$/;` — any line containing `"node:fs` must match exactly.

**Simplest compliance: the new shared module needs no `fs` at all** (it operates on an already-launched `page`, like `settingsBaseline.ts`). Each spec keeps its own `OUT_DIR`.

---

## 5. `e2e/settingsBaseline.test.ts` — guard pattern

Vitest (not Playwright; documented at 19). Two `it`s literal-pin the derived copy as an independent second opinion (22-37): the 6-item `SECTION_RESET_NAMES` array and `ALL_SETTINGS_RESET_NAME === "Restore all Vicinity Graph settings"`. Rationale (4-19): specs read names out of `src/view/settingsResetPlan`, so a rename would be self-fulfilling — pinned "in ONE place instead of five". Deliberately does **not** pin hand-written parts (card headings, disclosure flags) — those are pinned against real DOM by `settingsUxVisual.e2e.ts`.

**Applicability:** the new module is behavior (locators/actions), not data — a literal-pin test mostly does not apply. It should depend on `settingsBaseline.ts` constants rather than duplicate them.

---

## 6. The 14 inline `pluginDataStore` `page.evaluate` sites

**review** (4): 53 (`readGlobals`, 3-slice read) · 62 (`dirtyEverySection`: `saveGlobalDepths` + `saveGlobalView`{nodeCap, outlineMaxDepth, nodePreviewPreference, sizing, forceLayout} + `saveNodeExclusion`) · 217 (`storeHiddenPatterns` → `saveNodeExclusion`) · 252 (`saveNodeExclusion({enabled:true, patterns:[]})`).

**verify** (2): 49 (`readGlobals`) · 79 (`setExclusion` → `saveNodeExclusion`).

**ux-visual** (8): 134 (`nodeExclusion()` read) · 141 (`saveNodeExclusion` + `refreshOpenViews()`) · 177 (`globalView().forceLayout` read) · 214 (`readGlobals`, narrow) · 267 (`saveNodeExclusion({...store.nodeExclusion(), enabled:true})`) · 295 (`saveGlobalView`{nodeCap:42} + `saveGlobalDepths`{4,4}) · 344 (`globalView().nodePreviewPreference` read) · 355 (`seedPreviewPreference` → `saveGlobalView`{nodePreviewPreference} + `app.setting.activeTab?.display()`).

### ⚠ Coverage gap — the ticket's premise is only partly true today
Existing harness covers **only**: `nodeCap` (get via `readGlobalView`, set via `setGlobalNodeCap`), `sizing.maxPx` (set), `edgeVisibility` (set), `nodePreviewPreference` (set). **No harness method exists** for: any `globalDepths()` read or `saveGlobalDepths` write; any `nodeExclusion()` read or `saveNodeExclusion` write; `forceLayout` read; `outlineMaxDepth`; `sizing.minPx`/`depthDecayK`; `nodePreviewPreference` **read**.

Two non-drop-in traps:
- **`readGlobalView()` ≠ the specs' `readGlobals()`** — different, non-overlapping `sizing` shape; no depths/exclusion.
- **`seedPreviewPreference` (355)** needs `app.setting.activeTab?.display()` afterwards; `harness.setNodePreviewPreference` calls `plugin.refreshOpenViews()` instead. **Not interchangeable** — the settings-tab refresh and the graph-view refresh are different side effects.

---

## 7. Engine type exports
`src/engine/index.ts` (33-58) `export type { … EdgeVisibilityMode (42) … NodePreviewPreference (48) … } from "./types";` → both available as `import type { X } from "../src/engine";` from `e2e/`.

---

## 8. Serial-mode / ordering facts (do NOT reorder)
All three declare `test.describe.configure({ mode: "serial" })` (review 20, verify 27, ux-visual 24); one `harness`/`page` per file via `beforeAll`/`afterAll`.

- **review** — most tests self-seed via `dirtyEverySection()`, but being serial they still inherit prior store state.
- **verify** — mostly self-seeding (`openSettingsTab()` + `setExclusion(...)` per test); file comment (7-25) declares it the deliberate complement to review, intentionally not duplicating the isolation matrix / keyboard flow.
- **ux-visual — real cross-test coupling:** `beforeAll` (36-38) opens graph view + a file for all tests. The "every input carries its row name" test (260) has an explicit comment (263-264) that it depends on the exclusion test above (126) having ended with exclusion OFF. The Preview-pill tests at 491 and 507 are ordered: 507 depends on the `"image"` write left by 491 with no re-seed. The final tests (288, 308) chain off cumulative `depths.outgoingDepth` state.

**Constraint:** preserve per-file harness lifecycle; do not add implicit reset/reseed that masks currently-relied-upon leftover state; do not reorder.
