# IMPLEMENTATION_REVIEWER — private notes (rehydration)

## State

Review **done**. Verdict written to `IMPLEMENTATION_REVIEW__PUBLIC.md`:
**APPROVED-WITH-CONDITIONS**, 0 BLOCKING, 2 SHOULD-FIX (S1 test-order rule not in the test file;
S2 the word "today" in the residual comment), 2 NIT, 2 follow-up suggestions.

## What I actually verified myself (do not re-trust the IMPLEMENTATION file)

- `npm run check` exit 0. `npm test` exit 0 → `Test Files 67 passed (67)` / `Tests 866 passed (866)`,
  `grep -c "Aborted("` = **0**.
- `npx vitest run src/view/edgeRouting.test.ts --reporter=verbose` → 27 passed, and the two new
  tests appear as `✓` (i.e. `requireWasm(ctx)` does NOT skip in this container — real wasm runs).
- **Bite check (done, and restored).** Python edit swapped
  `this.router.processTransaction();` at `src/view/edgeRouting.ts:382` for `void 0;`, ran the file:
  `Tests 2 failed | 25 passed (27)` — exactly the two new tests — with 8212 `Aborted(` lines.
  Restored with `git checkout -- src/view/edgeRouting.ts`; `git status --porcelain` empty.
  **Always redirect wasm runs to `.tmp/` and grep — never let 8k abort lines into context.**
- Condition 5 check: `git diff b8beef2..HEAD -- src/view/edgeRouting.test.ts` shows the survival
  `it(...)` body unchanged; only the helper split into `doomedPass()` + wrapper. Judged fine (DRY).
- Removed-anchor / removed-test check: grep of the `^-` side of the src diff for
  `ap_[0-9A-Za-z]+_E|it\(|describe\(|expect\(` → no matches.

## Facts worth keeping

- The tickets live in `docs-internal/tickets/`; `_tickets/` is the same content (the startup prompt's
  path). Main ticket `nid_oy3vas85xhr34n2dby1mvows4_e`, residual `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`;
  both `links:` frontmatters are symmetric — condition 3 genuinely done.
- Reasoning I re-derived and did NOT flag: ordering (flush → free `owned` → `destroy(router)`) is
  correct; `dispose()` is idempotent (`owned.length = 0`, `router = null`), so the `finally` in
  `route()` cannot double-free; the leak-on-flush-throw is moot because an abort kills the module.
- Success path now calls `processTransaction()` twice (`:450` then `:382`); the second finds an
  empty action list. Accepted.
- The fix is a narrow, doubly-gated **regression** for non-finite geometry with <2 pending pins.
  That was knowingly accepted by ROOT_CAUSE_REVIEW condition 2 (document, don't fix). Do not
  re-litigate it; S2 only asks for unambiguous wording.

## If asked to re-review after S1/S2 land

Both are comment-only. Re-run `npm run check` + `npm test`, confirm `Aborted(` count 0, confirm the
two new tests are still the LAST two `it`s in `describe("LibavoidEdgeRouter with real wasm")`, and
confirm the residual sentence no longer says the current code tears down cleanly. No need to redo
the bite check.
