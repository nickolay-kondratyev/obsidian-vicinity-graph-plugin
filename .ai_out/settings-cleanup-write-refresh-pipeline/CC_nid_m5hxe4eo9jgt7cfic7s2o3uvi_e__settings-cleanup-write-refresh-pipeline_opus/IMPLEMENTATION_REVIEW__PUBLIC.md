# Implementation review — settings write/refresh pipeline (`nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`) — ROUND 2

Reviewed: `git diff 7588c2b..HEAD` (iteration commit `be9ac20`), against round 1's
1 BLOCKING + 5 SHOULD-FIX + 3 NICE-TO-HAVE. Gates re-run by me, not taken on trust.

## Verdict: **CONVERGED — good to land**

- `npm test` → **1120 passed / 85 files, exit 0** (`.tmp/r2-test.log`), was 1113 (+7).
- `npm run check` → **exit 0** (`src/` + `e2e/` tsc) (`.tmp/r2-check.log`).
- `./sanity_check.sh` → not present in this repo. e2e not run (release gate).

Both ratified must-fixes are genuinely fixed — I re-derived the failure cases myself
rather than reading the tests. Nothing in the iteration diff regresses behaviour. Two
residual issues I found are narrow, self-healing and non-blocking; they are written up
below as **follow-up tickets**, not as gates on this ticket.

---

## Round-1 findings — disposition

| # | Finding | Status |
|---|---|---|
| **B1** | Optimistic override released on first re-render (Goal 5 dead) | **RESOLVED** |
| **S1** | Failed defaults write skipped the drain | **RESOLVED** |
| **S2** | Stale comments describing a queue/snapshot | **RESOLVED** |
| **S3** | `SettingsWriter` doc overstated re-entrancy safety | **RESOLVED** |
| **S4** | `refreshOpenViews()` private while e2e calls it by name | **RESOLVED** (documented both ends — the right 80/20) |
| **S5** | No end-to-end debounce-thunk → pipeline → store coverage | **RESOLVED** (2 real tests, deadlock-fail-fast timeouts) |
| **N1** | `SettingsGlobalsReader` split | **ACCEPTED-REJECTION** |
| **N2** | `SettingsWritesPort` for DIP | **ACCEPTED-REJECTION** |
| **N3** | Fan-out ordering test did not observe ordering | **RESOLVED** (reads `store.globalView().nodeCap` at fan-out time; a fan-out ahead of its write now fails it) |
| — | `engineDefaultsSingleSource.test.ts` header prose | **ACCEPTED-REJECTION** — I re-read `:13-14`; it *is* past tense ("was before this guard existed"). My round-1 note was a misread. |

### B1 — verified functional, by reasoning through the real loop

`src/view/optimisticValue.ts` now carries a boxed `baseline` recorded by
`requesting(value, storedNow)`, and `src/view/useOptimisticValue.ts:37` passes this
render's `stored`. `reconciled` is three-way: release on latest-request; hold on
baseline **or** on an echo of an earlier request; release on anything else.

My own case now yields 3 — pinned at `optimisticValue.test.ts:41-48`
(`requesting(3, 2).reconciled(2).valueOver(2) === 3`), and the anti-lie test
(`:68-74`) survives, which is the property that mattered.

Loop cases I worked through by hand (not just via the tests):

- **Rapid stepper clicks.** `DepthStepper` steps from `shown`; baseline stays the first
  render's `stored` for the whole burst, so 2 → click → 3 → click → 4 with the store
  still on 2. Echo of click #1 (store → 3) holds, store → 4 releases. Correct.
- **Failed write.** `commit` rejection → `abandoned()` → `none()`; the control falls back
  to `stored`. (Minor: with two requests in flight, a failure of the *first* releases the
  whole burst, so the control flashes back to the baseline before the second write lands.
  Cosmetic, on an error path, with a `console.error` — not worth code.)
- **External change mid-burst.** A third-party value that is neither baseline nor an echo
  releases immediately. Correct.
- **Burst spanning a refresh / remount.** State is per-component; a remount resets to
  `none()` and the store wins. No stuck state.
- **Re-render idempotence.** `reconciled` returns `this` when nothing changes, and
  `none().reconciled(x) === this`, so the during-render `setPending` cannot loop.

Only one stuck-forever path exists — see NEW-1. It is not the one B1 was about.

### S1 — verified: a failed defaults write still flushes and drains

`settingsResetSequence.ts:41-50`: `run()` = `tolerating(flush → writeDefaults)` →
`settled()` → `redisplay()`. The drain is outside the write's failure scope, and the new
test (`settingsResetSequence.test.ts:87-98`) asserts the full order
`["flush","flush","click-write","redisplay"]`, not just `toContain("redisplay")`. I
prefer this to the `finally` I suggested — reads top-to-bottom and cannot swallow the
redisplay. No deadlock: `run()` is only reached from a click handler (never inside a
slot), and `SerialPromiseChain.drain()` never rejects.

### Rejections — both reasonable, neither escalated

- **N1 (`SettingsGlobalsReader`).** Rationale is stronger than my suggestion: the
  confirmation must be judged against *the same freshness* as the write, and that
  authority belongs to the pipeline. A second reader is exactly how the two would drift.
  I withdraw it.
- **N2 (`SettingsWritesPort`).** The bar stated ("an interface earns its keep when a fake
  implements it") is the right bar; `ControlsActions.test.ts` and
  `settingsWritePipeline.test.ts` use the **real** pipeline over in-memory persistence
  fakes, which is strictly stronger evidence than a stub. Same layer, so no layering rule
  is at stake. I withdraw it.

Nothing here rises to a reviewer/maker disagreement worth stopping the owner for.

### The disclosed gap (stepper burst = simulation, not a rendered component)

**Acceptable for this ticket.** The reasons: the disclosure is explicit and in three
places (the test file's own doc, `DepthStepper.tsx:14-21`, the PUBLIC report); the
component's residual untested surface is one line of prop plumbing that `npm run check`
types; adding jsdom + a renderer devDep mid-iteration is a repo-wide test-infra decision
the implementer correctly refused to take unilaterally; and it is now a `decide` ticket
(`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`) that names precisely what stays unpinned. That is the
CLAUDE.md-correct handling of a gap, not a coverage hole that blocks landing.

---

## NEW (found this round) — both NON-BLOCKING, file as tickets

### NEW-1. The override CAN stick forever when a clamp lands back on the baseline

`src/view/SizingSection.tsx:107` (`SizingNumber`) is the one optimistic control that can
request a value the write path will not store: `planSettingsWrite` runs
`clampSizingSettings`. Normally the clamped value differs from the baseline, so
`reconciled` releases (that is the anti-lie half, and it works). But when the field is
**already sitting at a range bound** and the user types past it, the clamp result equals
the baseline, the store never moves, `storeHasNotMovedYet` holds — and the field displays
an unstored number indefinitely (until the next in-range edit or a remount).

This also makes two doc sentences slightly untrue as written:
`docs-internal/plan/high-level-plan.md` and `docs-internal/architecture-map.md` both say
the store wins when "the write path clamped what was typed" — it does, *except* in this
case.

Why not blocking: narrow trigger, self-healing, no persisted-data or geometry impact (the
clamp still protects the engine), and the honest fix is a UX choice, not a bug fix —
pre-clamping on request (à la `DepthStepper`'s `clampStepperDepth`) fixes the model but
fights the user mid-typing, while the settings tab solves the same problem with a debounce
plus a cap notice that the panel field does not have. That decision belongs in its own
ticket, with the doc sentences corrected alongside whichever way it goes.

### NEW-2. `settled()` still couples two steps into one tolerated block

`settingsResetSequence.ts:58-67`: `flushTypedEdits()` and `drainWrites()` share one
`tolerating(...)`. `flushTypedEdits` → `debounced.flush()` → `runSerialised(...)`, which
**can** reject (a failing thunk), and then `drainWrites()` is skipped — the same shape as
S1, one level down. The same coupling in step 1 means a rejected pre-reset flush cancels
the defaults write entirely, which is not what the user asked for.

Cheap, strictly-better shape (3 lines, plus one test where `flushTypedEdits` rejects and
the queued write must still be drained):

```ts
private async settled(): Promise<void> {
    await this.tolerating(() => this.target.flushTypedEdits());
    await this.tolerating(() => this.target.drainWrites());
}
// and likewise split step 1 in run()
```

Doubly-unlikely trigger (a typed edit's write fails *and* a control was used mid-reset),
so a ticket is proportionate. Note `drainWrites` itself never rejects, so the exposure is
the flush only.

---

## Regressions introduced by the iteration diff: none found

- `requesting()`'s new second parameter has exactly two call sites (the hook and the
  tests); `npm run check` is green, so no caller was missed.
- `settingsResetSequence` behaviour on the success path is byte-identical in observable
  order (`["flush","write-defaults","flush","redisplay"]`, pinned at `:72-78`).
- The S2/S3/S4 changes are comment-only; I read each against the code it describes and
  all four now match.
- No test was removed. `optimisticValue.test.ts`'s nine original tests were retargeted to
  the two-arg `requesting`, not weakened; +4 added. No completeness/source-scan guard was
  touched.

## Documentation

Accurate after this iteration, with the one exception in NEW-1 (the "clamped" clause in
`high-level-plan.md` and `architecture-map.md`). `README.md:76-80` is now a true claim —
it was the code, not the wording, that needed fixing. `docs-internal/notes/settings.md`'s
new `decide` bullet correctly points at the test-infra ticket.

## `#QUESTION_FOR_HUMAN:`

1. `#QUESTION_FOR_HUMAN:` Both round-1 questions are now carried by
   `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` (`decide`): does React component-test infra BLOCK
   chain step 4 (dual presenters), or land alongside it? No other owner decision is
   outstanding — NEW-1 and NEW-2 are ordinary follow-up tickets.
