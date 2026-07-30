# IMPLEMENTATION_REVIEWER — private memory

## Round 2 (current) — commit `be9ac20` on `7588c2b`. Verdict: **CONVERGED**.
Report overwritten at `IMPLEMENTATION_REVIEW__PUBLIC.md` in this OUT_DIR.

Gates I ran: `npm test` → 1120 pass / 85 files, exit 0 (`.tmp/r2-test.log`);
`npm run check` → exit 0 (`.tmp/r2-check.log`). No `sanity_check.sh`. e2e not run.

### Round-1 items
B1, S1, S2, S3, S4, S5, N3 → RESOLVED. N1, N2, prose-nit → ACCEPTED-REJECTION
(all three rejections are reasonable; I withdrew all three, none escalated).
The prose nit was MY misread — the sentence in
`engineDefaultsSingleSource.test.ts:13-14` is past tense and accurate.

### B1 verification (did the reasoning, not just read tests)
`optimisticValue.ts` boxed `baseline` + three-way `reconciled`; hook passes this
render's `stored`. Checked by hand: rapid stepper burst, failed write
(`abandoned`), external mid-burst change, remount, and render idempotence
(`none().reconciled(x) === this`, so no setState loop). My case
`requesting(3,2).reconciled(2).valueOver(2)` → 3, pinned at test `:41-48`.

### S1 verification
`run()` = tolerating(flush→writeDefaults) → `settled()` → `redisplay()`. Drain out
of the write's failure scope; failure test asserts the FULL order. No deadlock
(`run()` only from click handlers; `chain.drain()` never rejects). Two-step form
is better than the `finally` I originally suggested.

### NEW findings this round (both NON-BLOCKING → tickets, stated in PUBLIC)
- **NEW-1 stuck-forever:** `SizingSection.SizingNumber` can request a value the
  clamp maps BACK to the baseline (field already at a range bound, user types past
  it) → `storeHasNotMovedYet` holds forever, field shows an unstored number. Also
  makes the "…or the write path clamped what was typed" clause in
  high-level-plan.md / architecture-map.md untrue in that case. Fix is a UX call
  (pre-clamp vs. debounce+cap-notice like the tab), hence a ticket.
- **NEW-2:** `settingsResetSequence.settled()` still couples flush+drain in ONE
  `tolerating`; `flushTypedEdits` CAN reject (`debounced.flush` → `runSerialised`),
  which skips the drain — S1's shape one level down. 3-line fix: tolerate each step
  separately (also in step 1, so a failed flush doesn't cancel the reset).

### Judged acceptable, do not re-open
- Stepper burst pinned as a SIMULATION of the component loop: disclosed in 3 places,
  residual surface is type-checked prop plumbing, and it is a `decide` ticket
  (`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`). Correct handling, not a landing blocker.
- No regression from the iteration diff (only 2 call sites of `requesting`, success
  path order unchanged, comment-only S2/S3/S4, no test removed, +4 tests).

## Round 1 (superseded, for context)
Commit `7588c2b`. NEEDS ITERATION: 1 BLOCKING (optimistic layer dead — no baseline),
5 SHOULD-FIX, 3 NICE-TO-HAVE. Verified-clean list from then still holds:
`SerialPromiseChain` correctness, no residual hand-rolled chain, no deadlock
reachable, removed tests re-covered, no completeness guard weakened.
