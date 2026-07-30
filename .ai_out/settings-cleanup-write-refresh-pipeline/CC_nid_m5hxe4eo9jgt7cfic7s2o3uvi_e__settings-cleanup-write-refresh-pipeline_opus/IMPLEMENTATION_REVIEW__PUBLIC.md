# Implementation review — settings write/refresh pipeline (`nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`)

Reviewed commit: `7588c2b` (diff `25e9fd4..HEAD`). Reviewer ran the gates itself.

## Verdict: **NEEDS ITERATION** — 1 BLOCKING, 5 SHOULD-FIX, 3 NICE-TO-HAVE

Gates (run by me, not taken on trust):

- `npm test` → **1113 passed / 85 files, exit 0** (`.tmp/review_test.log`)
- `npm run check` → **exit 0** (`src/` + `e2e/` tsc) (`.tmp/review_check.log`)
- `./sanity_check.sh` → not present in this repo.
- e2e not run (release gate).

Goals 1–4 are met and are genuinely good work: the DRY collapse is real, the
granular-interaction change is the right fix for the clobbering bug (and it makes
the old defect *type-inexpressible*, which is stronger than a test), and the reset
ordering is now a testable object. **Goal 5 does not work at all** — see BLOCKING-1,
which I reproduced with a failing test against the shipped class.

---

## Summary of what changed

1. `src/shared/SerialPromiseChain.ts` — one `run()`/`drain()` ordering primitive.
   The three hand-rolled "pre-caught tail" idioms are gone: `PluginDataStore` uses
   it, `DebouncedSettingsWrites` no longer has a chain at all (it drains through the
   pipeline's), `settingsWriteQueue.ts` is deleted. I verified no residual ad-hoc
   serialisation: `grep -rn "\.catch(() => undefined)" src/` → only
   `SerialPromiseChain`; no other `tail`/`writeChain`/`draining` field survives.
2. `src/view/settingsWritePipeline.ts` — ONE instance (`src/main.ts:58`), shared by
   the settings tab and every controls panel. Owns chain + fresh-read merge base +
   persist switch + fan-out + `drain()`.
3. `SettingsInteraction` is now one-field-per-arm; the whole-slice arms
   (`global-sizing`, `global-force-layout`, `global-node-exclusion`) are gone, and
   `SettingsWriteContext` no longer reaches React at all (verified by grep — only
   `settingsWritePlan`, `settingsResetPlan`, the pipeline and their tests use it).
4. `src/view/settingsResetSequence.ts` — flush → write defaults → flush → drain →
   redisplay, port-backed so it is unit-testable.
5. `optimisticValue.ts` + `useOptimisticValue.ts` — panel controls' optimistic layer.

---

## 🚨 BLOCKING

### B1. Goal 5 is non-functional: the optimistic override is released on the very first re-render

`src/view/optimisticValue.ts:47-54`, consumed by `src/view/useOptimisticValue.ts:30-33`.

`PendingEdits` has no memory of the stored value the burst started from, so the rule
"a value that was never requested wins immediately" fires against the *pre-edit*
stored value — which is, by definition, never requested. Sequence in production:

1. `stored = 2`. User clicks `+` → `request(3)` → `setPending(requesting(3))`.
2. React re-renders. `stored` is **still 2** (the snapshot only moves after a whole
   traversal + elk round-trip).
3. `pending.reconciled(2)`: `caughtUp = Object.is(3, 2) = false`;
   `echoOfAnEarlierRequest = [3].some(v => v === 2) = false`; therefore
   `caughtUp || !echoOfAnEarlierRequest` is **true** → `PendingEdits.none()`.
4. The control renders `2`. The optimistic value is never shown.

Proven, not reasoned: I ran this against the shipped class (throwaway test, since
deleted):

```
AssertionError: expected 2 to be 3
  const pending = PendingEdits.none<number>().requesting(3);
  expect(pending.reconciled(2).valueOver(2)).toBe(3);   // ← fails
```

Consequences:

- The whole feature is dead code paying full complexity cost (pure class + hook +
  9 tests + rewired props on six components).
- `src/view/DepthStepper.tsx:40,52` computes the next value from `shown`, which has
  already snapped back — so **rapid stepper clicks are still dropped**, i.e. the
  original bug in `ticket-controls-optimistic-input-latency.md` is *not fixed*.
- `README.md:76-80` ("Controls answer immediately: a stepper, slider, toggle or
  typed field moves as you use it") and
  `docs-internal/plan/high-level-plan.md` ("Nothing a control shows lags the input")
  are currently **false claims about shipped behaviour**.

Why the tests missed it — this is the direct answer to the "red-by-absence" question
for Goal 5: `src/view/optimisticValue.test.ts:57-62` is the only unrequested-value
case, and it uses `reconciled(400)` where `400 ≠` the seeded stored value. The one
case that always happens in production — *stored has not moved yet* — is untested.

Recommended fix: give `PendingEdits` the baseline it is missing, e.g.
`requesting(value, storedAtRequestTime)` records a `baseline`, and `reconciled(stored)`
becomes: released if `stored` is the latest request; held if `Object.is(stored, baseline)`
(the store simply has not moved) or if `stored` echoes an earlier request; released
otherwise (a genuinely third-party or clamped value). Add the failing test above as
`"WHEN the store has NOT moved yet THEN the requested value is still shown"`, plus
`"WHEN the store moves to a value nobody requested THEN it wins immediately"` to keep
the anti-lie property. Do not ship the README/plan sentences until this is green.

---

## ⚠️ SHOULD-FIX

### S1. Reset failure path skips the drain — the bug reappears exactly where it is least tested
`src/view/settingsResetSequence.ts:41-57`. `drainWrites()` and the second
`flushTypedEdits()` are *inside* the `try`. If `writeDefaults()` rejects (a failed
`data.json` write — the realistic case), control jumps to the `catch` and
`redisplay()` runs **without draining the chain** — i.e. `display()` reads the
globals synchronously while a control the user clicked mid-reset is still queued.
That is precisely `nid_8b97fdqznqsncc5kgya1p871w_e`.
The existing failure test (`settingsResetSequence.test.ts:80-85`) only asserts
`steps).toContain("redisplay")`, so it passes either way.
**Fix:** put `await this.target.drainWrites()` in a `finally` (and assert the ordering
in the failure test: `steps` must contain the drained click write before `redisplay`).

### S2. Stale comments now describe machinery that no longer exists
- `src/view/VicinityGraphSettingTab.ts:378-380`: *"Queued as ONE unit: the snapshot
  below is read after an await, so two fast clicks would otherwise both plan from the
  same pre-write state."* Nothing is queued here any more and there is no snapshot —
  the handler is a bare `async` and the merge happens in the pipeline.
- `src/view/VicinityGraphSettingTab.ts:~534-538`: *"Done OUTSIDE the queue …"* — there
  is no queue.
CLAUDE.md's rule is that comments carry the WHY and must match behaviour; these now
mislead the next reader about serialisation guarantees. Delete/reword both.

### S3. `settingsWritePipeline.ts:31-34` overstates the re-entrancy safety
The doc says re-entering the chain "is not expressible". It is: `apply()`,
`restoreDefaults()` and `drain()` are all public and all reachable from inside a slot
(closures in the tab hold `this.writes`), and `drain()` called from inside a slot
never resolves. Handing the `SettingsWriter` in makes the *right* thing easy, not the
wrong thing impossible. Given the implementer hit this exact deadlock once mid-work,
an absolute claim here is a trap. **Fix:** state the hazard honestly ("code inside a
slot MUST use the handed-in writer; calling `apply`/`drain` from inside a slot
deadlocks"), or split the public surface from the in-slot surface for real.

### S4. `refreshOpenViews()` made `private` while the e2e harness still calls it
`src/main.ts:122` is now `private`, but `e2e/obsidianHarness.ts:415-417` invokes
`app.plugins.plugins[pluginId].refreshOpenViews()` through an `any` cast (used by
`e2e/settingsUxVisual.e2e.ts:139`). It still works at runtime and `check:e2e` passes
*because* of the cast — so the "compile-time lock" claim in the self-report holds only
for `src/`. That is a silent coupling on a private member. **Fix:** either document at
`main.ts:122` that the e2e harness reaches this by name (so nobody renames it or makes
it a `#private` field), or give the harness an explicit test hook.

### S5. Nothing covers the debounce-thunk → pipeline-writer wiring end to end
`settingsDebounce.test.ts` now uses `UNUSED_WRITER` that *rejects* on `apply`, so the
one property that matters for the deadlock the implementer hit — a thunk writes
through the writer it was handed, and the write actually reaches the store — is
untested. `settingsWritePipeline.test.ts:114-126` tests `runSerialised` with a
hand-written task, not a debounced thunk. **Fix:** one test where
`DebouncedSettingsWrites` over the real `SettingsWritePipeline` drains a thunk and the
value lands in `PluginDataStore`. This is also the strongest replacement for the one
deleted `sizingRowWrite` test (see below).

---

## 💡 NICE-TO-HAVE

- **N1.** `SettingsWritePipeline.planResetConfirmation()` (`:88`) is a pure *read* on
  a write pipeline. It is there for the fresh-read benefit, which is fine, but it is
  the one method that does not fit the class name; consider a small
  `SettingsGlobalsReader` the pipeline and the modal both use.
- **N2.** DIP: `ControlsActions` (`:40`) and `VicinityGraphView` (`:39`) depend on the
  concrete `SettingsWritePipeline` class while everything else in `viewPorts.ts` is an
  interface. `SerialSettingsWrites` already exists; a matching
  `SettingsWritesPort { apply; restoreDefaults; runSerialised }` would keep the pattern.
- **N3.** `settingsWritePipeline.test.ts:88-96` ("defaults reached the store before the
  fan-out") does not observe ordering — its own comment concedes this. A
  `FakeViewsRefresh` that records `store.globalView()` at fan-out time would make it
  a real ordering assertion.

---

## Explicit answer: the removed tests

**No use-case coverage is lost. Not blocking.**

- `src/view/settingsWriteQueue.test.ts` (deleted, 3 tests). All three behaviours are
  re-covered, in substance verbatim, in `src/shared/SerialPromiseChain.test.ts`:
  ordering-not-overtaken (`:56` and additionally `:68`), rejection reaches ITS caller
  (`:80`), rejection does not wedge the chain (`:85`). The gated-task harness that
  makes those tests non-vacuous was carried over too. The class it tested no longer
  exists, so keeping the file was not an option.
- `src/view/sizingRowWrite.test.ts` lost *"WHEN the globals moved after the keystroke
  THEN the flushed write composes with them"*. `SizingRowWrite` no longer merges, so
  there was nothing left for it to assert. The behaviour is re-covered *structurally*
  (a row can only emit one field; the merge is the pipeline's, tested at
  `settingsWritePipeline.test.ts:33-72`) — but the specific *debounced* path is now
  only covered by construction, which is S5.
- I diffed the remaining test files: `ControlsActions.test.ts`,
  `settingsDebounce.test.ts`, `ControlsModel.test.ts`, `settingsWritePlan.test.ts`
  were **rewired, not weakened** (assertions retargeted to the granular arms, one new
  panel-restore test added). No completeness guard was touched: `SETTINGS_SPEC`'s two
  assertions, `ParsedViewFields`, `SECTION_SETTINGS_FIELDS`'s guard and
  `engineDefaultsSingleSource.test.ts` are all untouched, and `settingsWritePlan.ts`
  adds one more compile-forced declaration (`SizingNumberField =
  Exclude<keyof SizingSettings, "metrics">`). The ratified acceptance bar holds.

The deletion was disclosed up front in the implementer's PUBLIC report, which is the
right handling under CLAUDE.md.

## Explicit answer: the "red-by-absence" claims

- **Goal 2 (stale merge base) — genuinely pinned.** `settingsWritePipeline.test.ts:33-72`
  would fail if the context read moved back outside the slot (the implementer
  demonstrated this, and the tests read the real `PluginDataStore`, not a spy). On top
  of that the old defect is no longer *type-expressible*: with the whole-slice arms
  removed, a caller cannot supply a merge base. Strongest part of the change.
- **Goal 3 (reset races display) — partially pinned, acceptable.**
  `settingsResetSequence.test.ts` pins the ORDER at a new seam and
  `SerialPromiseChain.test.ts:98` independently pins the `drain()` mechanism it rests
  on. What is *not* pinned is the tab wiring (that `redisplay` really is `display()`
  and `drainWrites` really is `pipeline.drain()`) — e2e-only, and I accept that given
  the tab has no vitest harness. S1 is a concrete failure the current tests miss.
- **Goal 5 (optimistic controls) — NOT pinned, and the gap is live.** The tests
  exercise the helper in isolation and omit the only reconciliation case that always
  occurs in production. They would not catch a regression of the original bug because
  the original bug is still present (B1). This is the case where "red-by-absence" cost
  real correctness.

## `SerialPromiseChain` correctness (audited on its own)

- **Ordering:** `run()` appends to the pre-caught tail; enqueue order = run order. ✔
- **Rejection:** the `catch` lands on the *stored* tail and never on the returned
  promise, so a failure reaches its own caller and does not wedge later tasks. ✔
- **`drain()`:** loops until the tail stops moving, so tasks enqueued *by* a running
  task are included; never rejects (tail is pre-caught). ✔
- **Unhandled rejections:** `run()`'s returned promise is `void`ed in several places
  (`this.debounced` window drain, `void this.writes.apply(...)` in the tab,
  `void actions.restoreDefaults(...)` in `ForceLayoutSection`). Each of those was
  equally unguarded before this change, so no regression — but it is the same gap the
  implementer already flagged as follow-up #2 (a `Notice`-on-write-failure policy).
  Worth the ticket.
- **Deadlock audit:** I traced every in-slot code path. `pinNode`/`unpinNode` and
  `writer.apply` reach only `PluginDataStore`'s *separate* chain; every debounced
  thunk in the tab uses the handed-in `writer` (verified at each `debounced.schedule`
  call site), and `SettingsResetSequence.run` is invoked from click handlers, never
  from inside a slot. **No deadlock reachable today.** The residual hazard is S3.

## Behaviour regressions checked and cleared

- Debounce semantics (per-field latest-wins, one shared window, edit-order drain,
  `drop()` on half-typed input, flush on blur/`hide()`): unchanged.
- Sizing validation (`maxPx >= minPx` re-taken at drain time, clamp at the single
  `planSettingsWrite` choke point): unchanged; `SizingRowWrite` now *decides* instead
  of persisting, which is the cleaner split.
- Reset scope, confirmation modal, pins, `data.json` shape: unchanged. No persisted-shape
  change, so nothing to announce as a clean break.
- Exclusion toggle / metric-enable toggle lost their whole-handler `enqueueWrite`
  wrapper. I worked through the interleavings: because each now emits a single-field
  interaction merged from a fresh read, and `settlePendingWrites()` resolves in slot
  order, two fast clicks cannot clobber a sibling field or paint out of order. **Not a
  regression** — but this is what S2's stale comments used to explain, which is why
  they need rewriting rather than deleting silently.
- Panel force-layout "Restore defaults": N fan-outs → 1. Genuine improvement, pinned.

## Documentation accuracy

Accurate: `CLAUDE.md:41` write-path rule, `docs-internal/architecture-map.md` seam
entry, `docs-internal/notes/settings.md` (correctly renumbers the add-a-field cost
list to 6 and names `settingsWritePlan.ts` as guarded).

**Inaccurate until B1 is fixed** — do not merge these sentences as-is:
- `README.md:76-80` "Controls answer immediately … moves as you use it".
- `docs-internal/plan/high-level-plan.md` "Nothing a control shows lags the input."

Also noted by the implementer and worth a ticket, not a fix here:
`src/view/engineDefaultsSingleSource.test.ts`'s header prose still narrates
`ForceLayoutSection` as the offender; the guard itself is correct and green.

## `#QUESTION_FOR_HUMAN:`

1. `#QUESTION_FOR_HUMAN:` B1 means the panel's optimistic layer never worked. Two
   options: (a) fix `PendingEdits` as described (small, ~10 lines + 2 tests) and keep
   the feature; (b) revert the optimistic layer entirely (5 files, restores pre-change
   behaviour) and let goal 5 ride on a follow-up ticket with React component-test
   infra. Goals 1–4 stand either way. Which do you want? My recommendation is (a) —
   the rule is right, only the baseline is missing.
2. `#QUESTION_FOR_HUMAN:` The implementer's follow-up #1 (jsdom + a light React
   renderer) is what would have caught B1. Given that this is the second settings
   ticket to route real behaviour around "no React test infra", is it worth promoting
   to a blocking dependency for chain ticket 4 (dual presenters)?
