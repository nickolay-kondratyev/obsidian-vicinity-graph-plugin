# IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — settings-dependent-row-refresh

Working notes for ticket `nid_9k11zke41l6ze3p7n7suuo4v2_e`. Branch
`settings-dependent-row-refresh`. Written so a clone of me can pick this up cold.

## 1. Plan (as executed)

**Goal**: stop the two dependent-row `onChange` handlers in
`src/view/VicinityGraphSettingTab.ts` from calling `this.display()`.

1. Read EXPLORATION_PUBLIC + CLAUDE.md + invoke the `obsidian-settings` skill. ✅
2. Sizing (`renderSizing`): hold the weight `TextComponent`, flip `setDisabled`. ✅
3. Exclusion (`renderExclusion`): give the patterns row its own slot div; create/destroy
   inside it. ✅
4. Keep `settlePendingWrites()` in both handlers, with a corrected WHY. ✅
5. New e2e spec asserting focus / scrollTop / node identity across a toggle. ✅
6. Verify the new spec FAILS on the pre-fix source (stash + rerun). ✅
7. `npm test`, `npm run check`, full `npm run test:e2e`. ✅

No pure logic was extracted for unit tests — see §5, this is deliberate and honest.

## 2. Exact edits

### `src/view/VicinityGraphSettingTab.ts`

- L2: `import type { App, TextComponent } from "obsidian";`
- `renderExclusion()` (~L308): the toggle `Setting` is now held in `toggleRow`, built
  with `setName`/`setDesc` FIRST; then `const patternsSlot = section.createDiv();`
  then `toggleRow.addToggle(...)`. That ordering is load-bearing twice over:
  - DOM order: the slot must be appended AFTER the toggle row and BEFORE
    `addSectionReset` (the reset must stay the card's last row, per CSS
    `.vicinity-graph-settings-reset` and the `obsidian-settings` skill).
  - Closure order: the toggle handler names `patternsSlot`, so the const must be
    declared before `addToggle` (avoids a TDZ-shaped read even though the handler is
    async).
- New `showExclusionPatterns(slot, enabled)`: `slot.empty()` then, if enabled,
  `addExclusionPatterns(slot, this.store.nodeExclusion().patterns)`.
  Called once at render and once per toggle.
- `renderSizing()` (~L427): `let weightInput!: TextComponent;` per loop iteration,
  assigned as the first statement of the `addText` builder; the toggle handler calls
  `weightInput.setDisabled(!enabled)` **before** its `await`, then settles + persists.

### `e2e/settingsDependentRows.e2e.ts` (new, ~230 lines)

Three tests, serial, own `ObsidianHarness`. Screenshots → `.out/settings-dependent-rows/`.

## 3. Decisions & the alternatives rejected

**No shared dependent-row abstraction.** The two cases genuinely differ (flip a
component's disabled bit vs. build/tear-down a whole `Setting` subtree). A common seam
would have been a lowest-common-denominator "refresh(region)" wrapper — pure ceremony.
Two local fixes, both hyper-obvious. (This was the open question EXPLORATION left.)

**`let weightInput!: TextComponent` over `weightInput?.setDisabled(...)`.** The `?.`
form is a silent fallback: if the reference were ever missing the toggle would quietly
stop working. The definite-assignment assertion states the real invariant
(`Setting.addText` invokes its builder synchronously) and is documented at the
declaration.

Alternatives considered and dropped:
- Constructing `new ToggleComponent(row.controlEl)` / `new TextComponent(row.controlEl)`
  directly to get both handles cleanly. Rejected: it bypasses `Setting.addX`'s
  `components` registry, and I could not verify Obsidian's exact `addToggle` internals
  from the types-only package — too much risk for a cosmetic gain.
- Reordering to `addText` first (would flip the on-screen control order — a UX change).
- A generic `addComponent<T>(...)` helper — TS gymnastics for one call site.

**Slot div over `insertBefore` for the exclusion row.** A stable empty `<div>` makes
"this region tracks the toggle" visible in the code; `insertBefore` would require
holding the reset row's element and re-deriving position on every flip. The div is a
bare block element, zero height when empty, and no CSS rule in `settings-tab.css` uses
positional child selectors, so it is visually inert (confirmed by the full e2e run,
including the card-frame and reset-spacing visual specs).

**Kept the hide/show semantics.** The `obsidian-settings` skill prefers rendering an
irrelevant-right-now control as *disabled* rather than hidden (also: hidden rows drop
out of 1.13's settings search). Changing that is a UX decision, not refresh mechanics,
and it would break three e2e DOM contracts. Filed as
`nid_qp56jugz8en8wkgjirwcb269p_e` (`[decide]`), and the WHY-NOT is in the code.

## 4. The write-ordering guarantee (the subtle part)

`settlePendingWrites()` is KEPT as the first statement of both handlers, but for a
*different* reason than before — the old comment ("`display()` re-seeds every control")
no longer applies.

- **Exclusion**: still a re-seed, just a one-row one. `showExclusionPatterns` reads
  `this.store.nodeExclusion().patterns` **synchronously**. A debounced textarea write
  draining after that read would leave the rebuilt row showing patterns the store no
  longer holds. Draining first makes that read the newest one.
- **Sizing**: no re-seed at all, but the handler builds its command from
  `this.store.globalView().sizing` — a snapshot taken before `applySizing`'s own
  `await`. A debounced weight write landing inside that window would be clobbered by
  the snapshot. Draining first removes the window.

Note that `DebouncedSettingsWrites` thunks read globals fresh at flush time, so the
*reverse* order (our write, then theirs) composes fine on its own; the settle protects
the snapshot direction only. Both comments in the source say exactly this.

`applyReset()`'s `this.display()` (~L719) is **untouched**, as instructed — it is a
whole-tab value re-seed and `e2e/settingsTabPage.redisplay()` depends on `display()`
still working. `hide()` / `flushOnBlur` are untouched.

## 5. Why no new unit test

`npm test` is vitest in a **node** environment; there is no DOM and `node_modules/obsidian`
is types-only with no runtime JS, so `Setting` cannot be instantiated. The fix introduces
**zero new pure logic** — it is entirely "which DOM node do I touch". Extracting a
DOM-free shim purely to have something to unit-test would be a test that proves nothing.
Stated openly in the PUBLIC file rather than papered over.

The existing 1053 unit tests still pass, including `e2e/selectorGuard.test.ts` (I added
no new `.vicinity-graph-*` class, so nothing to satisfy there) and
`e2e/vaultTarget.test.ts`'s destructive-fs scan (the new spec's only `fs` call is
`fs.mkdirSync(OUT_DIR, …)` with the `OUT_DIR` name the scan allowlists, via
`import * as fs from "node:fs"`).

## 6. Commands run and REAL results

```
npm run check                → PASS (tsc src + tsc e2e), .tmp/check2.log
npm test                     → PASS, 79 files / 1053 tests, .tmp/test.log
npm run test:e2e -- settingsDependentRows.e2e.ts
                             → 3 passed (1.8s), .tmp/e2e2.log
npm run test:e2e             → see .tmp/e2e-full.log (full suite, post-fix)
```

Baseline (fix stashed, spec kept) — proof the new tests are not vacuous:
```
.tmp/e2e-baseline.log        ✘ exclusion test: "focus must survive a dependent-row update"
.tmp/e2e-baseline-sizing.log ✘ sizing test: "the weight input was rebuilt instead of disabled in place"
```
`OBSIDIAN_PATH` was unset; `scripts/run-e2e.sh` auto-downloads a pinned Obsidian, so
`npm run test:e2e` DOES run in this environment (a bare `npx playwright test` does not —
it skips that bootstrap and throws `OBSIDIAN_PATH is not set`).

## 7. Dead ends / gotchas for the next person

- `npx playwright test -c e2e/playwright.config.ts` bypasses `scripts/run-e2e.sh` and
  fails on `OBSIDIAN_PATH`. Always go through `npm run test:e2e -- <spec>`.
- Playwright `mode: "serial"` aborts the rest of the file after the first failure — to
  prove test #3 fails on the old code you must `-g` filter it.
- `SIZING_METRICS[0]` is optional under `noUncheckedIndexedAccess`; the new spec
  unwraps it with a module-level `throw`, not a `!`.
- Do NOT scroll the tab near its bottom in these tests: removing the patterns row
  shortens the content and the browser would CLAMP `scrollTop`, failing the assertion
  for a reason that is not a rebuild. `SCROLL_OFFSET_PX = 200` is deliberate.
- The toggles are clicked **programmatically** (`el.click()` inside `evaluate`) — a real
  pointer click would move focus to the toggle and destroy what the test measures.

## 8. State

Complete. Both fixes in, tests green, ticket `nid_9k11zke41l6ze3p7n7suuo4v2_e` left
**open** for the review round (TOP_LEVEL_AGENT owns closure and the change_log).
Follow-up ticket `nid_qp56jugz8en8wkgjirwcb269p_e` filed.

---

## 9. Round 1 (review response) — working notes

Commit `b1c13e2`. Read the review's 2 SHOULD-FIX + 2 NIT; verified each myself first.

### Edits

`src/view/VicinityGraphSettingTab.ts`
- `showExclusionPatterns(slot)` — **param dropped entirely** (reviewer suggested passing
  `this.store.nodeExclusion().enabled`; going one step further makes the stale value
  unrepresentable and puts `enabled` + `patterns` in one snapshot). Both call sites
  updated. Doc comment gained the WHY-NOT-a-param paragraph.
- Extracted `addSizingMetricRow(section, id, label, seed)` from the `renderSizing()`
  loop. New imports: `SizeMetricId`, `SizingMetricSetting` from `../engine`.
  `let weightInput!: TextComponent` STAYS — see below.
- Sizing toggle comment now names the contrast with `showExclusionPatterns` (param is the
  freshest truth there because the paint precedes the write).

`e2e/settingsDependentRows.e2e.ts`
- `expectExclusionPersisted` (function decl) + `expectMetricEnabledPersisted`
  (**arrow const** — a hoisted `function` is callable before the module-level throw that
  unwraps `SIZING_METRICS[0]`, so TS loses the narrowing → `TS18048`. Cost me one check
  cycle; the WHY is now in the file).
- Both called before `expectTabUndisturbed` in all three tests.

### Verified the reviewer's race claim before acting
No serialization anywhere on the write path (`applyInteraction` at `:740` is a plain
async method, no queue), so overlapping handlers are real. BUT: fixing the paint does
NOT fix the underlying divergence — the store itself can end up holding the older
click's value, and the checkbox is browser-driven. That residual is pre-existing and
tab-wide → ticket `nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e` (bug/p3) with the
one-promise-chain design sketch. Do not let a future round "fix" it by re-seeding
controls after each write — that reintroduces the focus theft this whole ticket removes.

### Rejected / corrected
- **NIT 1's stated benefit is wrong**: extraction does not turn `weightInput` into an
  ordinary local. `addToggle`'s builder still runs before `addText`'s, so the forward
  declaration is structural. Did the extraction anyway (SRP + house `addX` style), kept
  the definite-assignment assertion.
- **Did NOT make sizing read the store.** It would read a pre-write value → paints the
  OLD state. Documented in both comments so nobody symmetrises them later.
- **NIT 2**: acknowledged in PUBLIC only. No comment added — documenting a re-seed that
  no longer happens is a ghost.

### Non-vacuity proof (sabotage runs, then `git checkout`)
- deleted `applySizing(...)` from the sizing handler → `.tmp/r1-e2e-nowrite-sizing.log`,
  1 failed / 2 passed, message "the metric toggle must persist…". Specificity confirmed.
- deleted `applyInteraction(...)` from the exclusion handler →
  `.tmp/r1-e2e-nowrite-exclusion.log`, exclusion test 1 fails (on `toHaveCount`, because
  the paint now reads the store — the poll would have caught it too).
- restored, re-ran the spec: 3 passed (`.tmp/r1-e2e-spec-restored.log`).
- **No test written for the double-toggle race** — two back-to-back clicks resolve FIFO,
  so it would pass either way. Said so plainly instead.

### Results
`npm run check` exit 0 (`.tmp/r1-check.log`); `npm test` 79 files / 1053 tests
(`.tmp/r1-test.log`); `npm run test:e2e` **83 passed, 1 skipped, 54.8s**
(`.tmp/r1-e2e-full.log`). Matches the reviewer's baselines exactly.

### State
Round 1 complete, committed on the branch. Nothing merged, change_log untouched,
`nid_9k11zke41l6ze3p7n7suuo4v2_e` still open for TOP_LEVEL_AGENT.
