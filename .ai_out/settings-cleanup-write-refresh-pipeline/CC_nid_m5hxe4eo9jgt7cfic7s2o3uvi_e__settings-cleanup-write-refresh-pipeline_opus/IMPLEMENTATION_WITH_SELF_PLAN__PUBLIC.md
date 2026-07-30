# PUBLIC — settings write/refresh pipeline (`nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`), iteration 1

Iteration 1 responds to `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict NEEDS ITERATION:
1 BLOCKING + 5 SHOULD-FIX + 3 NICE-TO-HAVE) on top of committed `7588c2b`. Nothing from
`7588c2b` was reverted. Tree left dirty and uncommitted; no `change_log`, no tickets
closed. (Iteration 0's own report — the plan and how goals 1–4 are met — is superseded by
this file; the review confirmed goals 1–4 independently.)

**Gates:** `npm test` → **1120 passed / 85 files, exit 0** (`.tmp/it1_final_test.txt`;
was 1113 — net +7 tests). `npm run check` → **exit 0** (`.tmp/it1_final_check.txt`).
e2e not run (release gate).

**Readiness: READY FOR RE-REVIEW.** Both ratified must-fix items are fixed red→green
using the reviewer's own reproductions. No `#QUESTION_FOR_HUMAN` blocks this iteration:
the reviewer's Q1 was decided for me (option (a) — fix `PendingEdits`), and Q2 is now a
`decide`-tagged ticket rather than a question I answered on my own authority.

---

## Feedback disposition

| # | Item | Disposition | Rationale |
|---|---|---|---|
| **B1** | Optimistic override released on first re-render (Goal 5 dead) | **ACCEPTED — fixed** | Ratified must-fix. `PendingEdits` now remembers the burst's baseline. Reviewer's failing case reproduced first, then made green. |
| **S1** | Reset failure path skips the drain | **ACCEPTED — fixed** | Ratified must-fix. Drain + second flush moved out of the defaults write's failure scope; failure test strengthened so it can actually see it. |
| **S2** | Stale comments describing a queue/snapshot that no longer exist | **ACCEPTED — fixed** | Cheap, and CLAUDE.md requires comments to match behaviour. Both rewritten (not deleted) so the WHY survives. Grepped the whole tab for `queue`/`snapshot`; the two remaining hits are accurate. |
| **S3** | `SettingsWriter` doc overstates re-entrancy safety ("not expressible") | **ACCEPTED — fixed** | A lie by absolutism — and the implementer hit that deadlock. Now states the hazard plainly. Same overclaim fixed in `settingsDebounce.ts`. |
| **S4** | `refreshOpenViews()` private while the e2e harness calls it by name | **ACCEPTED — documented both sides** | Real silent coupling. Took the cheap half (document it, from both ends), not the "explicit test hook" half: a second entry point re-opens the "two fan-out rules" door the `private` was chosen to close. |
| **S5** | Nothing covers debounce-thunk → pipeline-writer → store end to end | **ACCEPTED — 2 tests added** | The strongest replacement for the deleted `sizingRowWrite` merge test, and the only place a re-entrancy deadlock on that path would show up. |
| **N1** | Move `planResetConfirmation()` to a `SettingsGlobalsReader` | **REJECTED** | Churn for a naming quibble. The method exists *because* the confirmation must be judged against the same fresh read the write uses — that authority is the pipeline's; splitting it invites a second reader with different freshness. A new class + wiring + a seam to keep in sync buys nothing testable. |
| **N2** | DIP: introduce `SettingsWritesPort` for `ControlsActions` / `VicinityGraphView` | **REJECTED** | No fake would implement it: `ControlsActions.test.ts` and `settingsWritePipeline.test.ts` deliberately use the **real** pipeline over in-memory persistence fakes, which is stronger than a stub. Pipeline and consumers are the *same* layer (`src/view/`), so no layering rule is at stake. `SerialSettingsWrites` exists only because `DebouncedSettingsWrites` genuinely needs a narrower slice AND is tested against a non-pipeline stand-in — that is the bar, and this does not meet it. Unused abstraction is precisely what KISS names. |
| **N3** | Fan-out ordering test does not observe ordering | **ACCEPTED — rewritten** | Fair; its own comment conceded it. Now a real ordering assertion. |
| — | `engineDefaultsSingleSource.test.ts` header narrates `ForceLayoutSection` | **REJECTED (no change)** | Re-read it: the sentence is past tense — *"That is exactly what `ForceLayoutSection`'s button **was before this guard existed**"* — accurate history explaining why the guard exists, not a claim about current code. Rewriting it would delete the motivation. |

---

## B1 — Goal 5 made functional (red → green)

**Root cause (as diagnosed by the reviewer):** `PendingEdits` knew only the values it had
*requested*, so the rule "a value nobody requested wins immediately" fired against the
**pre-edit** stored value — the value present on *every* first re-render, because the
write is serialised behind a traversal + elk round-trip.

**Fix — the model now remembers the baseline it is overriding**
(`src/view/optimisticValue.ts`):

- `:23-31` — second field `baseline: { readonly value: T } | undefined`, defined exactly
  when `requested` is non-empty (boxed so a legitimately `undefined` baseline stays
  distinguishable from "nothing requested").
- `:48-60` — `requesting(value, storedNow)`: the **first** request of a burst keeps
  `storedNow` as the baseline; later requests keep the one already recorded
  (`this.baseline ?? { value: storedNow }`).
- `:62-82` — `reconciled(stored)` is now three-way instead of two-way: released if
  `stored` is the latest request; **held** if `stored` is the baseline (the store simply
  has not moved) *or* echoes an earlier request of the burst; released otherwise (third
  party or clamp — the anti-lie half, kept intact).
- `src/view/useOptimisticValue.ts:34-37` — passes this render's `stored` as the baseline.

**Red → green evidence.** The reviewer's exact case is now
`optimisticValue.test.ts:41-48` — *"WHEN the store has NOT moved yet THEN the requested
value is still shown"*: `requesting(3, 2).reconciled(2).valueOver(2)` must be `3`.
Against the shipped class **before** the fix (`.tmp/it1_red_optimistic.txt`):
**3 failed | 10 passed**, namely

```
AssertionError: expected 2 to be 3   // "the store has NOT moved yet"
AssertionError: expected 2 to be 4   // stepper clicked twice — both clicks dropped
AssertionError: expected 3 to be 4   // stepper snapped back to click #1 mid-burst
```

After the fix (`.tmp/it1_green_optimistic.txt`): **13 passed**.

**The `DepthStepper` regression guard** — `optimisticValue.test.ts:88-133`, describe
*"PendingEdits driving a depth stepper"*, 3 tests. `stepperRender()` is the component's
own per-render derivation expressed over the same pure pieces it uses (`PendingEdits` +
`clampStepperDepth`): reconcile → `valueOver` → next click steps from **shown**. The
three tests pin: two rapid clicks are not dropped (2 → 4 while the store still holds 2);
the first click's echo mid-burst does not snap the readout back; once the store settles
on the last request the stepper follows the store again.

**Stated honestly, because the reviewer asked for the wiring:** this pins the component's
*loop*, not the component. There is no jsdom / React renderer in this repo, so "the real
`DepthStepper` feeds `shown` and not `value` into the next click" is verified by reading
it, by the comment now at `DepthStepper.tsx:14-21` that says so, and by e2e — not by
`npm test`. I did **not** add jsdom + a renderer devDep on my own authority mid-iteration;
that is a test-infra decision. It is now **ticket `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`**
(`decide`, linked to this one), which records exactly what stays unpinned and carries the
reviewer's Q2 to the owner ("does this BLOCK chain step 4 / dual presenters?").

## S1 — reset drains even when the defaults write fails (red → green)

`src/view/settingsResetSequence.ts:41-77`. `run()` is now two tolerated steps plus the
redisplay, instead of one `try` whose tail was skipped on failure:

1. `tolerating(flushTypedEdits → writeDefaults)`
2. `settled()` = `tolerating(flushTypedEdits → drainWrites)` — **outside** the write's
   failure scope
3. `redisplay()`

Chosen over `finally` deliberately: a `finally` that `await`s can itself throw and skip
the redisplay, and the two-step form makes the order readable top-to-bottom. The
duplicated `console.error` is factored into `tolerating()` (`:71-77`).

**Red → green evidence.** New test `settingsResetSequence.test.ts:87-99` — *"WHEN the
reset write fails THEN a write queued behind it is STILL drained before the redisplay"*:
`writeDefaults` enqueues a mid-reset click write and then rejects. Before the fix
(`.tmp/it1_red_reset.txt`):

```
AssertionError: expected [ 'flush', 'redisplay' ] to deeply equal
                        [ 'flush', 'flush', 'click-write', 'redisplay' ]
```

After (`.tmp/it1_green_reset.txt`): **5 passed**. The pre-existing failure test (*"the tab
is still redisplayed"*) is untouched — the new one is additive.

## S5 + N3 — new / strengthened pipeline tests

`src/view/settingsWritePipeline.test.ts`:

- **S5, new describe** *"DebouncedSettingsWrites over the real pipeline"* (`:114-159`) —
  real `DebouncedSettingsWrites` over the real `SettingsWritePipeline` over the real
  `PluginDataStore`/`FakePluginDataPort`. Test 1: a flushed thunk's write reaches the
  store through the handed-in `SettingsWriter`. Test 2: two fields typed in one window
  both survive the drain, i.e. the second thunk plans over what the first just wrote —
  the substance of the `sizingRowWrite` merge test iteration 0 deleted, now on the path
  that still exists. Both carry a 1s timeout so an in-slot deadlock fails fast instead of
  hanging. Nothing here is timing-dependent: the scheduler never fires, `flush()` drives
  the drain.
- **N3, rewritten** (`:88-99`) — the fan-out port now reads `store.globalView().nodeCap`
  **at fan-out time** and the test asserts the recorded sequence
  `[42, EngineDefaults.viewSettings().nodeCap]`. A fan-out that ran ahead of its own write
  would record the pre-write value; the old version could not tell.

## Comment / doc honesty pass

- `src/view/VicinityGraphSettingTab.ts:376-378` — "Queued as ONE unit … snapshot read
  after an await" → now states what actually protects it (one granular interaction,
  planned from a fresh read inside the pipeline's slot).
- `src/view/VicinityGraphSettingTab.ts:~527-530` — "Done OUTSIDE the queue" → "Flipped
  BEFORE the write is awaited"; the rest of the WHY (paints in click order) is kept.
- `src/view/settingsWritePipeline.ts:30-42` — "not expressible" replaced by an explicit
  **HAZARD** paragraph: `apply`/`restoreDefaults`/`drain` remain reachable through any
  closure a slot captures and deadlock if called from inside one; in-slot code must use
  the handed-in writer.
- `src/view/settingsDebounce.ts:19-22` — the same overclaim ("cannot re-enter") corrected
  to the real consequence.
- `src/main.ts:112-129` + `e2e/obsidianHarness.ts:409-419` — the private-member coupling
  documented from both ends: keep the name, keep it a method, and `check:e2e` cannot catch
  a rename because of the `any` cast.
- `src/view/DepthStepper.tsx:14-21` — records that clicks step from `shown`, where that is
  pinned, and what is not pinned.
- `src/view/settingsDebounce.test.ts:9-17` — `UNUSED_WRITER`'s doc names the test that
  covers the side it deliberately does not.
- `docs-internal/plan/high-level-plan.md:73` — "the store still wins the moment it
  disagrees" was an overclaim *even after* the fix (it does not win while showing the
  baseline or a mid-burst echo). Now states the rule precisely.
- `docs-internal/plan/high-level-plan.md:76` — restore-defaults guarantee now says the
  drain happens even when the write failed.
- `docs-internal/architecture-map.md:66-71` — reset order corrected (the second flush was
  missing) and the optimistic-release condition made precise.
- `docs-internal/notes/settings.md` — new "Ordering undecided (`decide`)" bullet for
  `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`, stating why the review raised it.
- `README.md:76-80` — **left as written**, and it is now true: with B1 fixed, a stepper,
  slider, toggle or typed field does move as you use it. It was the sentence the reviewer
  refused to merge; the wording never needed changing, only the code underneath it.
- `CLAUDE.md` — no change needed; its write-path rule was already accurate.

## Files changed in this iteration

| File | Change |
|---|---|
| `src/view/optimisticValue.ts` | B1: baseline field, `requesting(value, storedNow)`, three-way `reconciled`; class doc rewritten |
| `src/view/useOptimisticValue.ts` | passes this render's `stored` as the baseline |
| `src/view/optimisticValue.test.ts` | +4 tests (the "store has not moved" case + 3 stepper-burst); the existing 9 retargeted to the 2-arg `requesting`, none removed |
| `src/view/settingsResetSequence.ts` | S1: `tolerating()` + `settled()`; drain no longer inside the write's failure scope |
| `src/view/settingsResetSequence.test.ts` | +1 failure-path ordering test |
| `src/view/settingsWritePipeline.ts` | S3: honest re-entrancy HAZARD doc |
| `src/view/settingsWritePipeline.test.ts` | S5: +2 debounce-over-pipeline tests; N3: fan-out ordering test rewritten to observe ordering |
| `src/view/settingsDebounce.ts` | S3: same overclaim corrected |
| `src/view/settingsDebounce.test.ts` | doc pointer to the new end-to-end coverage |
| `src/view/VicinityGraphSettingTab.ts` | S2: two stale comments rewritten |
| `src/view/DepthStepper.tsx` | doc: steps from `shown`; where it is pinned; what is not |
| `src/main.ts`, `e2e/obsidianHarness.ts` | S4: private-member coupling documented both ways |
| `docs-internal/plan/high-level-plan.md`, `docs-internal/architecture-map.md`, `docs-internal/notes/settings.md` | accuracy pass (above) |
| `_tickets/test-infra-react-component-tests-…md` | new ticket `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`, linked to this one |

No production behaviour changed beyond B1 and S1. No persisted shape changed, so there is
still nothing to announce as a clean break.

## Follow-ups (not done here, on purpose)

1. `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` (new, `decide`) — React component-test infra; carries
   the reviewer's Q2 about whether it blocks chain step 4.
2. Still open from iteration 0: a `Notice`-on-write-failure policy for the several `void`-ed
   write promises (the `debounced` window drain, `void this.writes.apply(...)`,
   `void actions.restoreDefaults(...)`). Pre-existing, unchanged by this work, worth a
   ticket — the reviewer agreed.

---

# Iteration 2 — closing round-2's two NEW findings

Round 2's verdict was CONVERGED; both items below were filed as non-blocking. The owner
asked for them NOW. Both were cheap, both are fixed, both started from a failing test.
Nothing else was touched — no opportunistic refactors.

## A. NEW-1 — the override could stick FOREVER when a clamp landed back on the baseline

**The defect.** `PendingEdits` released the override only when the STORE moved. A sizing
row sitting exactly on a range bound, typed past that bound, clamps back to the bound —
so the store never moves, `storeHasNotMovedYet` held, and the field displayed an unstored
number until the next in-range edit or a remount.

**The fix — reconcile against what the write will STORE, not against what was typed.**
A request now records two values instead of one:

- `src/view/optimisticValue.ts:32-46` — new `RequestedEdit<T> { shown, settlesAt }`; the
  request list is `readonly RequestedEdit<T>[]` (this record also absorbs the old boxing
  trick, so an `undefined` `T` is still distinguishable from "no request").
- `src/view/optimisticValue.ts:82` — `requesting(value, storedNow, settlesAt = value)`.
  Default = identity, so every non-clamping control is unchanged.
- `src/view/optimisticValue.ts:99-108` — `reconciled` matches on `settlesAt`, latest
  request FIRST, so clamped-to-baseline releases instead of waiting forever.
- `src/view/useOptimisticValue.ts:32` — optional third param `settlesAt: (requested) => T`.
- `src/view/SizingSection.tsx:65,114` — both numeric row kinds (metric weight, and
  min/max/`k`) pass the real clamp in. The toggles and `NodePreviewPreference` /
  force-layout sliders pass nothing, i.e. identity, as before.
- `src/engine/constants.ts:189-196` (used at `:213-220`) — new `clampSizingNumber(field, value)`;
  `clampSizingSettings` now *delegates* to it for all four fields, so there is ONE clamp,
  not a view-side copy that could drift. `SizingRangeField` is now exported, and both are
  re-exported from `src/engine/index.ts`.

**Red → green.**

| Test | Red (before) | Green (after) |
|---|---|---|
| `optimisticValue.test.ts:76-85` "WHEN the write path will store what the store ALREADY holds THEN the override is released" | `expected 9999 to be 400` | pass |
| `optimisticValue.test.ts:87-92` "…THEN the typed value is still shown until it lands" | already passed — it is the guard that the fix does not cost the optimism | pass |
| `sizingSettings.test.ts` "WHEN one field is clamped alone THEN it lands where the whole-object clamp lands it" | n/a (new API) | pass — pins the single-clamp claim the rows rely on |

Red log: `.tmp/it2_red.txt`. Green: `.tmp/it2_green.txt`.

**What the user now sees**, and why this is not a UX regression: typing an out-of-range
value ALREADY snapped back whenever the clamp differed from the baseline (type `5` into a
min-px field showing `50` → store lands on `10` → override released). The bound case was
the one inconsistent hole. It now behaves like the others.

**WHY-NOT pre-clamping the request** (the `DepthStepper` shape the reviewer floated):
it rewrites the field mid-keystroke — typing `5` toward `50` would snap the input to the
bound and make `50` unreachable. Separating "what is shown" from "what will be stored"
fixes the model without touching what the user is allowed to type.

## B. NEW-2 — `settled()` coupled flush + drain in one `tolerating()`

`src/view/settingsResetSequence.ts` — every step is now tolerated on its own:

- `:41-49` `run()`: the pre-reset flush and `writeDefaults` are separate `tolerating(...)`
  calls, so a rejecting flush (the user's own earlier debounced edit failing) no longer
  cancels the reset they just asked for.
- `:58-67` `settled()`: `flushTypedEdits()` and `drainWrites()` split the same way, so a
  rejecting flush no longer skips the drain — the S1 bug one level down. Doc updated.

**Red → green.** New test `settingsResetSequence.test.ts:100-109` "WHEN flushing a typed
edit fails THEN the defaults are still written and a queued write still drained":
red `expected [ 'redisplay' ] to deeply equal [ 'write-defaults:all', 'click-write',
'redisplay' ]` → green. The four existing ordering tests are untouched and still pass.

## Documentation corrected

- `docs-internal/plan/high-level-plan.md:73` — the clause "the write path clamped what was
  typed" was listed as a case where the store wins; it now states the actual rule (the
  store wins when it holds what the latest request will STORE) and names the
  already-at-the-bound case explicitly.
- `docs-internal/architecture-map.md:68-72` — same correction, one line.
- `src/view/SizingSection.tsx:22-26` — the section doc now says the rows hand the hook the
  same clamp the write path applies, and why.

## Gates (re-run at the end of this iteration)

- `npm test` → **1124 passed / 85 files, exit 0** (`.tmp/it2_final_test.txt`); was 1120,
  **+4** (2 optimistic, 1 reset, 1 clamp-agreement). No test weakened or removed.
- `npm run check` → **exit 0**, `src/` + `e2e/` (`.tmp/it2_final_check.txt`).
- e2e is the release gate and was not run here (unchanged from previous iterations).

Nothing committed, no ticket closed, no `change_log` entry — as instructed.

## Deferred: nothing

Both items are closed. The follow-ups listed for iteration 1 (the `decide` ticket
`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`, and the `Notice`-on-write-failure policy) stand
unchanged.
