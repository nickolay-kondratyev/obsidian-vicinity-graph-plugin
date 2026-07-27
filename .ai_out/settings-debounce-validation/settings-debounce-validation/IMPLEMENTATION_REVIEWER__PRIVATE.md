# IMPLEMENTATION_REVIEWER — PRIVATE (cumulative: rounds 1–2)

Branch `settings-debounce-validation`. Public outputs: `IMPLEMENTATION_REVIEW__PUBLIC.md` (r1),
`IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md` (r2).

## Round 1 (commits `489b281..8fd9647`) — summary

0 BLOCKING, 5 SHOULD-FIX, 4 CONSIDER, 3 NIT. `npm test` 1038/78, `npm run check` clean.
Must-fixes: SF1 decay-k cross-contamination, SF2 vacuous debounce-timer tests, SF3 no flush-time
re-validation. Considered-and-rejected as findings: keying by visible row name (unique, documented),
`drop()` not cancelling the window (harmless), `Number(raw)` for node cap (`""`→0 caught by the
`>= MIN_NODE_CAP` guard).

## Round 2 (commits `7207d02`, `09c8360`) — VERDICT: READY TO MERGE

10 verified fixed, 2 rejections accepted (C9 shared window — my own r1 note said no action; NIT12
untracked ticket file — implementer was told not to touch it), 0 disputed, 0 new findings.
AC verdicts moved 1:PARTIAL→MET, 2:PARTIAL→MET, 5:PARTIAL→MET; 3 and 4 stayed MET.

### Verification actually performed in r2 (do not re-derive)
- `npm test` → **1053 / 79 files, exit 0** (`.tmp/r2-test.log`); `npm run check` → clean, exit 0
  (`.tmp/r2-check.log`).
- **I ran the sabotage checks MYSELF** rather than trusting the disposition table. Method: `git archive
  HEAD | tar -x -C .tmp/sabotage`, symlink `node_modules`, patch with python, `npx vitest run`.
  `.tmp/sabotage` deleted afterwards; repo `src/` never touched (verified with `git status` mid-run).
  - S1 `CROSS_FIELD_ROWS` += `depthDecayK` → `sizingRowWrite.test.ts` fails (exit 1).
  - S2 `restartWindow()` → early-return no-op → exactly the 2 `elapse()` tests fail, ~1.0 s each
    (the `TIMER_TEST_TIMEOUT_MS` guard works). **SF2 is genuinely non-vacuous.**
  - S3 drop the re-check in `persistIfAccepted` → 2 tests fail incl. "the flushed write persists NOTHING".
- Removals audit `git diff d905a6d..HEAD -- src/ | grep '^-'`: only moved code + the 2 rewritten
  (strengthened, same names) debounce tests. No deletions, no weakening, no anchors.
- Confirmed `settlePendingWrites()` precedes **every** `this.display()` site (`:321/:327`, `:406/:413`,
  `applyReset :713/:719`), and that `flush()` chains on `draining` so overlapping flushes are ordered.
- Confirmed the cap message is computed with the SAME `clampSizingSettings` that
  `settingsWritePlan.ts:107` applies → the warning cannot lie about the stored value.
  `NODE_SIZE_PX_BOUNDS = {min:1, max:400}` shared by `minPx`/`maxPx`.

### Judgement calls made in r2 (rationale, if challenged)
- `sizingRowWrite.ts` is NOT added ceremony: the double-verdict (keystroke + flush) is the real reason
  it exists, and it is the only way SF1/3/5 became unit-testable given the tab has no harness.
- Deliberately did NOT open a nitpick round. One observation left as no-action: `judge()` applies the
  cross-field rule to the RAW typed value before the cap notice, so `minPx=500` vs stored `maxPx=400`
  is refused although clamping (500→400) would make it valid. Conservative + honest message ⇒ fine.
- SF5 was allowed to be a ticket; the implementer fixed it instead. Accepted as better than asked.

## Left for the human (called out publicly, not blocking)
- Untracked `_tickets/nodes-in-groups-folder-to-be-tighther-together.md` (pre-existing; commit or delete).
- `[decide]` tickets: `nid_9jiira82snkh7bgy8zv060c9r_e` (engine-level cross-field guard) and
  `nid_hatwq2jlkhno5t6awcz0q6t9q_e` (`SizingSection.tsx` still clamps silently / snaps mid-keystroke).

## Working tree
Wrote only this file + `IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md` and `.tmp/r2-*.log`. `src/` untouched.
