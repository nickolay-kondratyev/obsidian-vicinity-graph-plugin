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

---

# Iteration round 1 — review response

Commit `b1c13e2` on `settings-dependent-row-refresh` (initial impl was `d749265`).

## SHOULD-FIX 1 — stale `enabled` param at `:333` — **ACCEPTED (fixed differently, and better)**

**The reviewer's diagnosis is correct.** I re-traced it rather than taking it: nothing
serializes the tab's write path (`applyInteraction` → `persist` → `refreshOpenViews`, no
queue), so two toggle handlers really can be in flight at once and finish out of click
order. The last one to finish painted its own captured `enabled`.

Fixed one level up from the suggested line: `showExclusionPatterns` now takes **no
`enabled` parameter at all** and reads the store itself —

```ts
private showExclusionPatterns(slot: HTMLElement): void {
    const exclusion = this.store.nodeExclusion();
    slot.empty();
    if (exclusion.enabled) { this.addExclusionPatterns(slot, exclusion.patterns); }
}
```

Both call sites (initial render + the toggle handler) pass the slot only. Reasons this
beats threading `this.store.nodeExclusion().enabled` in at the call site:
- The stale-param class of bug becomes **unrepresentable** rather than avoided by
  discipline at each caller.
- `enabled` and `patterns` now come from **one** snapshot, so the row cannot be built
  from two different reads of the store.
- The method's name becomes literally true: it shows what the store says.

**Honest limit, stated plainly.** This makes the *patterns row* agree with the store; it
does not make the *checkbox* agree. Under the same interleaving the store can end up
holding the older click's value while the DOM checkbox (browser-driven) shows the newer
one. That divergence is pre-existing and tab-wide — it is the missing write
serialization, not the paint — and pre-fix `display()` only masked it for this one
control by re-seeding the checkbox. Fixing it properly means serializing the tab's
writes, which is out of this ticket's scope. Filed as
**`nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e`** (bug, p3) with the mechanism, the 80/20 design
sketch (one promise chain in the tab), and a warning not to write a double-click test
that cannot fail.

### Does the sizing path have the same hazard? **No — and copying the fix there would be wrong.**

Checked explicitly, as asked. `weightInput.setDisabled(!enabled)` runs **synchronously,
before any await**, so paints happen in click order and the last click always wins the
pixel. More importantly the two cases are not the same shape and should not be made to
look the same:

| | paints | freshest truth at paint time |
|---|---|---|
| exclusion | **after** its own write | the **store** |
| sizing | **before** its own write | the **param** |

Reading the store in the sizing handler would read a value the store has not been told
about yet — it would paint the *old* state. So the consistent rule applied wholesale is
not "always read the store", it is **"paint from the freshest available truth at paint
time"**, and that resolves to different sources here. That rule is now written into both
comments, and the sizing comment names the contrast with `showExclusionPatterns`
explicitly so a future reader does not "fix" the asymmetry.

### Test coverage for this item — stated honestly

**No deterministic test exists for the double-toggle race, and I did not write a fake
one.** Reproducing it requires handler A to finish after handler B; both handlers have
identically shaped await chains, so two back-to-back programmatic clicks resolve FIFO in
practice and such a test would pass with **and** without the fix — vacuous. Forcing the
interleaving needs a delay seam inside `persist()`, i.e. production code changed to be
testable, which is exactly the write-serialization work I ticketed. The change is
justified on contract grounds (an API that cannot be called with a stale value), it is
provably not worse, and the three existing e2e tests confirm no regression.

## SHOULD-FIX 2 — the spec never proved the toggles still persist — **ACCEPTED**

`e2e/settingsDependentRows.e2e.ts` gains two `expect.poll` helpers,
`expectExclusionPersisted(enabled)` / `expectMetricEnabledPersisted(enabled)`, called in
all three tests **before** `expectTabUndisturbed(offset)` — which also settles the
handler so the "nothing else moved" claim is no longer measuring a half-run handler
(the reviewer's secondary point; the WHY is in the test).

**Proved non-vacuous by deleting the write, not by inspection:**

| Sabotage | Result |
|---|---|
| `await this.applySizing({...})` removed from the sizing toggle handler | ✘ sizing test — `Error: the metric toggle must persist, not just disable its weight input` (`.tmp/r1-e2e-nowrite-sizing.log`). Tests 1–2 still passed, confirming the guard is specific. |
| `await this.applyInteraction({...})` removed from the exclusion toggle handler | ✘ exclusion test 1 (`.tmp/r1-e2e-nowrite-exclusion.log`) |

Note the second row is now caught *twice over*: because `showExclusionPatterns` reads the
store, deleting that write also breaks the row-visibility assertion. Paint and
persistence are coupled there by construction, which is the point of SHOULD-FIX 1.

## NIT 1 — extract `addSizingMetricRow` — **ACCEPTED (with the premise corrected)**

`renderSizing()` is back to a list of rows; the ~55-line metric body moved to a private
`addSizingMetricRow(section, id, label, seed)`, matching the file's existing `addX` row
builders (`addSizingNumber`, `addDepthSlider`, `addExclusionPatterns`) — consistency, not
taste. `seed` is the row's initial displayed state, taken from the card's single
`globalView().sizing` read.

**One premise of the NIT does not hold, so I did not act on it:** extraction does *not*
let the weight component be an ordinary local. The toggle builder still runs before the
text builder, so a forward declaration is unavoidable; `let weightInput!: TextComponent`
stays, with its existing justification. The alternative (`TextComponent | undefined` +
`?.`) is a silent fallback and worse.

## NIT 2 — weight value no longer re-seeded on flip — **ACKNOWLEDGED, no change**

Confirmed and agreed it is an improvement: an in-progress weight edit now survives the
toggle instead of being silently reverted by the old full rebuild. Recorded here because
it is a real behaviour difference from pre-fix. No code change (adding a comment about a
re-seed that no longer happens would document a ghost).

## Verification — REAL results, this round

| Command | Result | Log |
|---|---|---|
| `npm run check` | **PASS** (exit 0) — `tsc -noEmit` src then e2e | `.tmp/r1-check.log` |
| `npm test` | **PASS** — 79 files, **1053 tests**, 0 failed | `.tmp/r1-test.log` |
| `npm run test:e2e` (FULL, real Obsidian) | **PASS — 83 passed, 1 skipped (54.8s)**, 0 failed | `.tmp/r1-e2e-full.log` |

Same 1053 / 83 baselines the reviewer measured — no test added, removed or skipped in
the unit suite; the e2e count is unchanged because the new assertions strengthen the
three existing tests rather than adding new ones.

One `tsc` wrinkle worth knowing: `expectMetricEnabledPersisted` is an **arrow const**,
not a `function` declaration. A hoisted declaration is callable before the module-level
`throw` that unwraps `SIZING_METRICS[0]`, so TS would not see `METRIC_UNDER_TEST` as
narrowed (`TS18048`). The WHY is in the file.

## Readiness

**Ready for merge.** 0 BLOCKING and both SHOULD-FIX items are addressed with the fix
proved (SHOULD-FIX 2 by a sabotage run; SHOULD-FIX 1 on contract grounds, with the
absence of a deterministic test stated openly rather than papered over). Both NITs are
handled — one applied, one acknowledged. Scope was not expanded: `applyReset()`'s
`display()` is still a full rebuild, `src/view/`-only, no layering boundary crossed, no
`ap_XXX_E` anchor and no behavior-capturing test touched. The one genuine defect found
beyond this ticket's scope (unserialized writes) is ticketed, not silently patched.

Open follow-ups: `nid_qp56jugz8en8wkgjirwcb269p_e` (`[decide]` hide vs. render-disabled),
`nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e` (write serialization). Ticket
`nid_9k11zke41l6ze3p7n7suuo4v2_e` left open for TOP_LEVEL_AGENT to close; change_log not
touched.
