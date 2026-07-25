# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE notes (rehydration)

Branch `edge-routing__07-wasm-abort`. Out dir `.ai_out/edge-routing__07-wasm-abort/edge-routing__07-wasm-abort/`.

## Plan (self-made, followed)

**Goal**: `AvoidArena.dispose()` flushes the pending libavoid transaction before destroying the
Router, stated as the type's teardown protocol, so an in-window throw costs one pass instead of
the whole wasm module.

**Steps**
1. `src/view/edgeRouting.ts` — unconditional `this.router.processTransaction()` at the top of
   `dispose()`, before freeing `owned`; WHY comment states the honest invariant *"flushing is the
   only teardown libavoid offers"* + the measured residual (non-finite geometry) + ticket
   `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`.
2. `src/view/edgeRouting.ts` — `AvoidArena` docstring gains TEARDOWN PROTOCOL next to OWNERSHIP GOTCHA.
3. `src/view/edgeRouting.test.ts` — extract `routePassWithUnregisteredObstacle()` (the raw doomed
   pass) out of the existing `routeEdgeWithUnregisteredObstacle()` helper (premise guard untouched);
   add ONE test asserting the pass rejects with our own diagnostic `Error`. Survival test stays LAST.
4. `src/view/edgeRouting.test.ts` — `freshPinExclusivity` docstring points at the canonical WHY (DRY).
5. `ticket link` the two tickets + close-out honesty note.
6. Gates: `npm run check`, `npm test` (redirect to `.tmp/`), `grep -c "Aborted("` == 0.

## Verification log (literal, in the order run)

1. Baseline before touching anything — `npx vitest run src/view/edgeRouting.test.ts`
   (`.tmp/impl-0-red.txt`): `EXIT=1`, `Tests 1 failed | 25 passed (26)`, `grep -c "Aborted("` = **8212**.
2. Fix applied — same file run (`.tmp/impl-1-green.txt`): `EXIT=0`, `Tests 27 passed (27)`,
   `Aborted(` = **0**.
3. Bite check for the NEW error-identity test: `processTransaction()` in `dispose()` temporarily
   replaced by `void 0`, run with `-t "rejects with our own diagnostic error"`
   (`.tmp/impl-2-identity-red.txt`):
   `AssertionError: expected [Function] to throw error including 'references an obstacle with no
   regist…' but got 'Maximum call stack size exceeded'` → `Tests 1 failed | 26 skipped (27)`.
   Fix restored immediately afterwards (`git diff` shows only the intended change).
4. Gates: `npm run check` → `CHECK_EXIT=0` (`.tmp/impl-check.txt`);
   `npm test` → `Test Files 67 passed (67)` / `Tests 866 passed (866)`, `Aborted(` = **0**
   (`.tmp/impl-test.txt`). 866 = the pre-existing 865 + the one new test.

## Gotchas for a fresh instance

- Never let a RED run's stderr into context: ~16k `Aborted(native code called abort())` lines.
  Always `npm test > .tmp/impl-test.txt 2>&1` then read the file / grep it.
- Test ORDER inside `describe("LibavoidEdgeRouter with real wasm")` is load-bearing while any test
  can abort: an abort kills the shared wasm instance for every LATER test in the file. The two
  unregistered-obstacle tests are the last two on purpose.
- `AvoidArena.owned` must never hold a `ShapeRef` / `ConnRef` / `ShapeConnectionPin` (double-free).
  The fix touches neither `owned` nor any router-owned object.
- Reviewer condition 4 explicitly FORBIDS a regression test for the non-finite-geometry residual
  (it would lock in known-bad behaviour and poison later tests). Do not "helpfully" add one.
- `change_log` is TOP_LEVEL's job — sub-agents must not write changelog entries.
- Ticket left `open` on purpose (an IMPLEMENTATION_REVIEW stage may follow); the close-out honesty
  note is already appended to it via `ticket add-note`.
