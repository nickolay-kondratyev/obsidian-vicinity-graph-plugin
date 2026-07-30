# IMPLEMENTATION_REVIEWER — private memory

Commit reviewed: `7588c2b` (`25e9fd4..HEAD`). Verdict: NEEDS ITERATION.
1 BLOCKING, 5 SHOULD-FIX, 3 NICE-TO-HAVE. Report:
`IMPLEMENTATION_REVIEW__PUBLIC.md` in this OUT_DIR.

## Gates I ran myself
- `npm test` → 1113 pass / 85 files, exit 0 (`.tmp/review_test.log`)
- `npm run check` → exit 0 (`.tmp/review_check.log`)
- no `sanity_check.sh` in repo
- e2e not run (release gate)

## The find (B1) — how I got it
Reasoned through `useOptimisticValue` render flow, then PROVED it by running a
throwaway vitest file with a custom config (repo `include` is `src/**/*.test.ts`
only, so a `.tmp` test needs `--config .tmp/.../vitest.config.mts` with
`test.include`). Since deleted (`.tmp/rev-opt` removed).

```
PendingEdits.none<number>().requesting(3).reconciled(2).valueOver(2)  // → 2, want 3
```
Root cause: `optimisticValue.ts:47-54` has no baseline. The pre-edit stored value
is "never requested", so the "unrequested wins immediately" branch fires on the
FIRST re-render after the request. Feature is dead; DepthStepper still drops
rapid clicks (it recomputes from `shown`). README + high-level-plan now assert
behaviour that does not exist.

Fix shape I recommended: record `baseline` in `requesting(value, stored)`; hold
when `Object.is(stored, baseline)`.

## Verified clean (do not re-litigate)
- No residual hand-rolled chain: `grep "\.catch(() => undefined)" src/` → only
  `SerialPromiseChain`. No `tail`/`writeChain`/`draining` fields left.
- `SettingsWriteContext` no longer reaches React (grep confirms).
- `SerialPromiseChain` itself is correct (ordering, rejection-to-own-caller,
  no-wedge, `drain()` loop covers task-enqueued-during-task, never rejects).
- Deadlock audit: traced every in-slot path. Store has its OWN chain, so
  `writer.apply`/pins don't re-enter. All four `debounced.schedule` call sites use
  the handed-in `writer`. `SettingsResetSequence.run` is called from click
  handlers only. No deadlock reachable today.
- Removed tests: `settingsWriteQueue.test.ts`'s 3 tests are re-covered in
  `SerialPromiseChain.test.ts:56/68/80/85`. `sizingRowWrite` deletion defensible.
  No completeness guard weakened; `SizingNumberField` adds one.

## Open items if asked again
- S1 (drain not in `finally`) is the one other real correctness bug.
- S4: `e2e/obsidianHarness.ts:415` calls the now-`private` `refreshOpenViews()`
  via `any` — works, but the "compile-time lock" claim only holds for `src/`.
- Two `#QUESTION_FOR_HUMAN:` raised: fix-vs-revert the optimistic layer, and
  whether React test infra becomes a blocking dep for chain ticket 4.
