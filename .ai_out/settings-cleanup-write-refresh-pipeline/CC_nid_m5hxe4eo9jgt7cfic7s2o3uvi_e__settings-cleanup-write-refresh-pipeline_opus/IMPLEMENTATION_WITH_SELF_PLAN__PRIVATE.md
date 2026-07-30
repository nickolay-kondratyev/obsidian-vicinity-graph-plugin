# PRIVATE — write/refresh pipeline (ticket nid_m5hxe4eo9jgt7cfic7s2o3uvi_e)

## Where things stand
Iteration 0 = commit `7588c2b` (goals 1–4 accepted by review, goal 5 dead).
Iteration 1 = uncommitted working tree on top of it. Round-2 review: CONVERGED.
Iteration 2 = closed round-2's two NEW (non-blocking) findings on owner request.
`npm test` 1124/1124, `npm run check` clean. Logs: `.tmp/it1_*.txt` and
`.tmp/it2_{red,green,final_test,final_check}.txt`. Nothing committed, no tickets
closed, no change_log — by design.

## What iteration 2 changed (and WHY)
- **`PendingEdits` requests are now `{ shown, settlesAt }`** (`RequestedEdit<T>`).
  `reconciled` matches on `settlesAt`, latest FIRST. WHY: the release rule only
  watched for the store to MOVE, so a sizing clamp that landed back on the
  baseline (field already at a bound, typed past it) stuck the override forever.
  `requesting(value, storedNow, settlesAt = value)` — identity default keeps every
  non-clamping control byte-identical.
- **`useOptimisticValue` third param `settlesAt: (requested) => T`** (identity
  default). `SizingSection`'s two numeric row kinds pass `clampSizingNumber`.
- **`clampSizingNumber(field, value)` in `src/engine/constants.ts`**, and
  `clampSizingSettings` DELEGATES to it. WHY: the view needed the write path's
  clamp for ONE field; a view-side copy would drift. `SizingRangeField` exported.
- **`SettingsResetSequence`: every step gets its own `tolerating()`** — in `run()`
  (pre-reset flush vs. `writeDefaults`) and in `settled()` (flush vs. drain).
  WHY: a rejecting flush was cancelling the defaults write and skipping the drain.
- Tests +4: 2 optimistic (clamped-to-baseline releases; clamp does not cost the
  optimism), 1 reset (rejecting flush), 1 `clampSizingNumber` == `clampSizingSettings`.
- Docs: `high-level-plan.md:73`, `architecture-map.md:68-72`, `SizingSection.tsx`
  header — the "the write path clamped what was typed" clause was untrue at a bound.

### Iteration-2 WHY-NOT (do not re-litigate)
- **Pre-clamping the REQUEST** (`DepthStepper`'s shape): rewrites the input
  mid-keystroke — typing `5` toward `50` in a min-px field would snap to the bound
  and make `50` unreachable. `shown` vs `settlesAt` fixes the model without
  constraining what may be typed.
- **Releasing when `commit()` resolves**: the write resolves long BEFORE the
  snapshot round-trip, so this would kill the optimism entirely.

## Iteration-0 design (still current, unchanged)
1. `src/shared/SerialPromiseChain.ts` — `run()` + `drain()`; drain returns the
   pre-caught tail so it resolves either way and includes tasks enqueued while a
   task ran. Replaced three hand-rolled tails.
2. `src/view/settingsWritePipeline.ts` — ONE instance (`src/main.ts:58`) owning
   chain + fresh-read merge base + persist switch + fan-out + `drain()`.
   `runSerialised(task => task(writer))` hands an already-serialised writer IN.
3. `SettingsInteraction` fully granular (one field per arm) — the whole-slice arms
   were the sibling-clobbering vector; `planSettingsWrite` is the ONLY merger.
4. `settingsResetSequence.ts` over `SettingsResetTarget` — owns the reset ORDER.
5. `optimisticValue.ts` (pure) + `useOptimisticValue.ts` (thin hook).

## What iteration 1 changed (and WHY, so it is not undone)
- **`PendingEdits` gained a `baseline`.** Without it, "a value nobody requested
  wins immediately" fired against the PRE-EDIT stored value, which is present on
  every first re-render → the override died before being painted. `reconciled` is
  now three-way: caught-up → release; baseline OR earlier-request echo → hold;
  anything else → release. `requesting(value, storedNow)`; the FIRST request of a
  burst keeps the baseline, later ones inherit it (`this.baseline ?? {...}`).
  Invariant: `baseline !== undefined` ⟺ `requested.length > 0`.
- **`SettingsResetSequence.run()` split into `tolerating()` + `settled()`.** The
  drain must NOT sit inside the defaults write's failure scope. Not a `finally`:
  an awaited `finally` that throws would skip the redisplay.
- Tests: +4 optimistic (incl. 3-test stepper-burst simulation), +1 reset failure
  ordering, +2 debounce-over-real-pipeline, 1 fan-out test rewritten to observe
  ordering at fan-out time.
- Docs/comments: honesty pass, listed in PUBLIC.md.

## Rejected in iteration 1 (do not re-litigate without new information)
- **N1** `SettingsGlobalsReader` for `planResetConfirmation` — the fresh read must
  come from the same authority as the write; a second reader is a freshness bug
  waiting to happen.
- **N2** `SettingsWritesPort` interface for the pipeline — no fake would implement
  it (tests use the REAL pipeline over persistence fakes, deliberately), and
  consumers are the same layer. Unused abstraction.
- **`engineDefaultsSingleSource.test.ts` header** — the `ForceLayoutSection`
  sentence is PAST tense and is the guard's motivation. Accurate as written.
- Adding jsdom + a React renderer devDep mid-iteration — real infra decision with
  a `decide` tag; became ticket `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`.
- Writing a blind e2e test for the stepper burst — cannot run e2e here, and an
  unverified test in a release gate is worse than a documented gap.

## Known residual gaps (disclosed in PUBLIC.md)
- Component wiring (`DepthStepper` feeding `shown` back) is pinned by SIMULATION
  of the loop, plus a comment, plus e2e — not by a rendered component. Ticket
  `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`.
- Several write promises are `void`-ed with no user-visible failure signal
  (pre-existing). Needs a `Notice`-on-write-failure policy ticket.
- Tab wiring for the reset (that `redisplay` really is `display()` and
  `drainWrites` really is `pipeline.drain()`) is e2e-only; the tab has no vitest
  harness.

## Environment notes
- vitest runs in the NODE environment; no jsdom/happy-dom/react-test-renderer
  installed. Source-scan guard tests read the filesystem, so any future jsdom
  environment must be scoped to component test files only.
- `Array.prototype.at` is not in this TS lib config — `PendingEdits` uses an index
  read cast to `RequestedEdit<T>` (the record itself now does the boxing that kept
  an `undefined` T distinguishable from "no request").
