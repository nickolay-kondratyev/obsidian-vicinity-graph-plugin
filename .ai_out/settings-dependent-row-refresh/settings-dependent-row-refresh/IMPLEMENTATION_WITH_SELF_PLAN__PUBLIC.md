# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — settings-dependent-row-refresh

Ticket `nid_9k11zke41l6ze3p7n7suuo4v2_e`: the settings tab's two dependent-row
`onChange` handlers no longer call `this.display()`. Branch
`settings-dependent-row-refresh`.

## Approach

Two local fixes, no new abstraction. The two cases only *look* alike: one flips a
sibling component's disabled bit, the other builds and tears down a whole `Setting`
subtree. A shared "dependent row" seam would have been a lowest-common-denominator
wrapper around two one-liners — rejected on 80/20 + KISS. (This was the open question
EXPLORATION deliberately left to implementation.)

Both extend the precedent already documented on `addNodePreviewSegmented`
(`src/view/VicinityGraphSettingTab.ts:536`): *don't throw away the user's focus to
re-render something the browser already handled*. The comments name that precedent and
carry the reasoning one step further — there the fix was to re-render **nothing**, here
it is to re-render **only the row that actually depends on the control that changed**.

## Files changed

### `src/view/VicinityGraphSettingTab.ts` (+67 / −25)

| Where | Change |
|---|---|
| `:2` | `import type { App, TextComponent } from "obsidian";` |
| `renderExclusion()` `:309-338` | Toggle row is built first, then `const patternsSlot = section.createDiv()`, then the toggle is wired. Handler ends with `showExclusionPatterns(patternsSlot, enabled)` instead of `this.display()`. |
| `showExclusionPatterns()` `:344-362` (new) | `slot.empty()`, and if enabled rebuild the patterns row from a fresh store read. Carries the WHY-NOT for `display()` and the WHY-NOT for "render it always, disabled". |
| `renderSizing()` `:434, :444, :458` | `let weightInput!: TextComponent` per metric, assigned in the `addText` builder; the toggle handler calls `weightInput.setDisabled(!enabled)` **before** its `await` and no longer calls `this.display()`. |

`applyReset()`'s `this.display()` (now `:761`) is **untouched** — a whole-tab value
re-seed, and `e2e/settingsTabPage.redisplay()` depends on `display()` still working.
`refreshOpenViews()`, `hide()` and `flushOnBlur()` are untouched. `src/view/`-only; no
layering boundary crossed; no `ap_XXX_E` anchor touched.

### `e2e/settingsDependentRows.e2e.ts` (new)

Three serial tests with their own harness. Screenshots → `.out/settings-dependent-rows/`.

## How each acceptance criterion is met

**"Toggling a dependent row updates only that row."**
- Sizing: the weight input is the SAME DOM node before and after — proved by stamping a
  JS property on it (`IDENTITY_PROBE`) and reading the property back after the flip. A
  property cannot survive `containerEl.empty()` + rebuild, so this is a direct identity
  test, not a proxy.
- Exclusion: the same probe is stamped on an unrelated control in a *different* card
  (`Node cap`, Performance) and survives both directions of the toggle.

**"Scroll position and focus are preserved."**
- The tab is scrolled to 200px and focus is put on `Node cap` before each flip; after the
  flip the spec asserts `document.activeElement`'s `aria-label` is still `Node cap` and
  `scrollTop` is unchanged. The scroll offset is asserted `> 0` first, so the assertion
  cannot pass by matching nothing on a short tab.
- The toggles are clicked programmatically (`el.click()` inside `evaluate`) precisely
  because a real pointer click would move focus to the toggle itself.

**Write-ordering guarantee preserved.** `settlePendingWrites()` is still the first
statement of both handlers, but the reason changed and the comments now say the real one:
- Exclusion: `showExclusionPatterns` re-seeds the rebuilt row by reading the store
  **synchronously**; a debounced textarea write draining afterwards would show patterns
  the store no longer holds.
- Sizing: no re-seed, but the handler's command is built from a `globalView().sizing`
  snapshot taken before `applySizing`'s own `await`; a weight still inside the debounce
  window would be clobbered by that snapshot.

(`DebouncedSettingsWrites` thunks read globals fresh at flush time, so the opposite
ordering composes on its own — the settle protects the snapshot direction.)

**e2e DOM contracts intact.** 6 cards, per-card headings, `MIN_NAMED_CONTROLS` (20) /
`ANY_UNNAMED_CONTROL`, `.vicinity-graph-settings-reset` as each card's last row,
`redisplay()`. All verified by running the whole suite, not by inspection. The slot is
a bare `<div>` (no new class), so `e2e/selectorGuard.test.ts` has nothing new to check.

## Test commands run and REAL results

| Command | Result |
|---|---|
| `npm run check` | **PASS** — `tsc -noEmit` for `src/` then `e2e/`. `.tmp/check2.log` |
| `npm test` | **PASS** — 79 files, **1053 tests**, 0 failed. `.tmp/test.log` |
| `npm run test:e2e -- settingsDependentRows.e2e.ts` | **PASS** — 3 passed (1.8s). `.tmp/e2e2.log` |
| `npm run test:e2e` (FULL suite, real Obsidian) | **PASS** — **83 passed** (54.8s), 0 failed. `.tmp/e2e-full.log` |

The e2e suite **did run here**: `OBSIDIAN_PATH` was unset, but `scripts/run-e2e.sh`
auto-downloads a pinned Obsidian build. (A bare `npx playwright test` bypasses that
bootstrap and fails with `OBSIDIAN_PATH is not set` — go through `npm run test:e2e`.)

**The new tests were proved non-vacuous.** With `src/view/VicinityGraphSettingTab.ts`
stashed back to the pre-fix version and the new spec kept:
- exclusion test → `✘ Error: focus must survive a dependent-row update` (`.tmp/e2e-baseline.log`)
- sizing test → `✘ Error: the weight input was rebuilt instead of disabled in place` (`.tmp/e2e-baseline-sizing.log`)

## No new unit test — stated plainly

`npm test` is vitest in a **node** environment with no DOM, and `node_modules/obsidian`
is types-only with no runtime JS, so `Setting` cannot be instantiated. This fix
introduces **zero new pure logic** — it is entirely "which DOM node do I touch". There
was nothing honest to extract and unit-test, and I did not invent jsdom scaffolding or a
shim to manufacture a green check. The behaviour is covered end-to-end instead, by tests
verified to fail without the fix.

## Risks

- **Low.** `weightInput.setDisabled(...)` is the same call the row already made at build
  time, so the mechanism is proven; `let x!: T` is a compile-time assertion only.
- The exclusion slot adds one always-present empty `<div>` inside the Node exclusion
  card. Visually inert (no CSS rule in `settings-tab.css` uses positional child
  selectors), and the card-frame + reset-spacing visual e2e specs pass unchanged.
- Programmatic `.click()` in the new spec is slightly synthetic, but it is the existing
  house pattern (`settingsUxVisual.e2e.ts`) and the only way to measure focus survival.

## Deliberately not done

- **`applyReset()`'s `display()`** — explicitly out of scope; still a full rebuild.
- **Rendering the exclusion-patterns row always, merely disabled.** The
  `obsidian-settings` skill prefers `disabled` over hidden (a hidden row also drops out
  of Obsidian 1.13's settings search), but that is a UX decision, not refresh mechanics,
  and it changes three e2e DOM contracts. Filed as
  **`nid_qp56jugz8en8wkgjirwcb269p_e` `[decide]`** with the trade-off, the affected
  specs, and the migration sketch; the WHY-NOT also lives in the code at
  `showExclusionPatterns`.
- **Ticket left open** for the review round — TOP_LEVEL_AGENT owns closure and the
  change_log.
