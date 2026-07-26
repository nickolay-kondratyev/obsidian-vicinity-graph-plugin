# IMPLEMENTATION_REVIEWER__PRIVATE — rehydration memory

Round 1. Verdict: **READY, 0 blocking.** Public review:
`IMPLEMENTATION_REVIEW__PUBLIC.md`.

## What I actually ran

- `npm run check` → exit 0 (`.tmp/rev-check.log`).
- `npm test` → `Test Files 74 passed (74)` / `Tests 990 passed (990)`, exit 0
  (`.tmp/rev-test.log`). Matches the implementer's claim exactly.
- Did NOT re-run `npm run test:e2e` — no concrete cause for doubt emerged.
  Implementer's baseline log is at `e2e-baseline.log` in this dir (79/1 skipped).

## Verification method, per risk

1. **Test order/titles.** `diff` of `grep -nE '^\s*(test|test\.describe)\('` between
   `git show a9c86fd:e2e/<spec>` and the working file, for all three specs. Only
   line numbers differ; titles and order byte-identical. 11 / 8 / 16 tests.
2. **Assertion preservation.** Read the full `git diff` of each spec hunk by hunk.
   Mappings confirmed 1:1:
   - `page.locator(".modal-container")` → `settingsTab.openModals()` (same selector).
   - `.last()` → `confirmDialog()`; `.vicinity-graph-settings-reset-all button`
     → `resetAllButton()`; `confirmDialog().locator("button").filter({hasText})`
     → `dialogButton(text)`.
   - Only intentional selector change: ux-visual "a section restore resets ONLY
     that section" `section.getByRole("button")` → `resetButton("Performance")`
     (`.vicinity-graph-settings-reset button`) — strictly more specific,
     documented by the implementer.
   - `plugin.app.setting.activeTab.display()` → `redisplay()` (adds `?.`; no
     behavior difference while the window is open).
   - No `await` dropped; every migrated multi-statement evaluate became ordered
     awaited calls.
3. **`pluginDataStore` containment.** `grep -rn pluginDataStore e2e/` → only
   `e2e/obsidianHarness.ts` (lines 329,331,339,365,376,387). `app.setting` in
   `e2e/*.e2e.ts` → zero hits. `page.evaluate` remaining: review 4 (geometry /
   `document.activeElement` / `evaluateAll` — none touch the store), verify 0,
   ux-visual 0.
4. **setTheme judgement.** Key evidence: `e2e/vicinityGraph.e2e.ts:199-212` already
   asserts `--text-faint` resolution per theme *through* `harness.setTheme`, so the
   body-class lever demonstrably restyles. And verify's two theme tests assert only
   footer copy + screenshots — no computed-style/CSS-var assertion existed there
   either before or after, so nothing was weakened. Also noted the old local helper
   `customCss.setTheme?.(t) ?? changeTheme(t)` would in practice run BOTH (a void
   call returns `undefined`, so `??` falls through) — extra reason the deletion
   loses nothing anyone asserted. Conclusion: reasoning HOLDS, not a weakening.
5. **`vaultTarget.test.ts`.** `settingsTabPage.ts` has no `fs` import at all;
   `npm test` (which runs the readdir-based scanner over every top-level `e2e/*.ts`)
   is green, so the new file passed the scan. Each spec keeps its literal `OUT_DIR`.
6. **Type-only imports.** All five engine types are in the single
   `import type { … } from "../src/engine"` block that already carries the erasure
   comment. Barrel exports confirmed at `src/engine/index.ts:37,47,48,57` (+
   `ViewSettings`). `ViewSettingsOverride = Partial<ViewSettings>` at
   `src/engine/types.ts:318`.
7. **No speculative surface.** Grepped every new harness/page-object member for
   call sites; all have ≥1. `GlobalViewSnapshot` deletion checked against its
   other consumer `controlsRestart.e2e.ts:146,151,165` — type-checks via `ViewSettings`.
8. **Serial coupling.** Re-read ux-visual :241 (exclusion re-enable, comment intact),
   :448/:464 (Preview pill pair, `"image"` leftover intact), verify's dark leftover
   for `07-exclusion-confirm-dark.png`. No reseed added anywhere.

## Non-blocking items I raised (do not re-litigate as blocking)

- SHOULD-FIX-light: `settingsUxVisual.e2e.ts:265` uses `saveGlobalView({nodeCap:42})`
  where `harness.setGlobalNodeCap(42)` exists — the one residual call-site leak of
  harness-owned knowledge.
- NITs: ux-visual:184 count assertion now subsumed by `open()`'s wait;
  `ViewSettingsOverride` name borrowed for a patch type; body-class theming is
  state Obsidian doesn't know about (pre-existing, now relied on by one more file);
  `openModals()` sitting on the settings page object.

## Explicitly ruled out as issues

- No security surface (test-only code, no secrets, no injection vector; all
  `page.evaluate` args are literals/typed values).
- No vacuous locator assertions introduced — checked every `toHaveCount` /
  `toBeChecked` / `toHaveValue` in the diff against its pre-change counterpart.
- No anchor point (`ap_XXX_E`) touched; none exist in these files.
