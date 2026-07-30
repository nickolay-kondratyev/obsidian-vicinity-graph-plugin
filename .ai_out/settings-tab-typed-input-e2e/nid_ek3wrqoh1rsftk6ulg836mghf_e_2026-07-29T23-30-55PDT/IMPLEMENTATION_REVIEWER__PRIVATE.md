# IMPLEMENTATION_REVIEWER — PRIVATE notes

Status: review COMPLETE. `IMPLEMENTATION_REVIEW__PUBLIC.md` written in this dir.
Verdict: APPROVED_WITH_MINOR — 0 BLOCKING, 1 MAJOR (#1), 3 MINOR, 2 NIT.

## Commands I actually ran (all exit 0)
- `npm run check` → `.tmp/review-check.log`
- `npm test` → `.tmp/review-test.log` — 94 files / 1245 tests passed
- `npm run test:e2e -- settingsTypedInput.e2e.ts` → `.tmp/review-e2e.log` — 11 passed, 4.3 s
- `git show 7170c24 --stat -- '*test*'` → EMPTY (no guard/test file touched)
- Did NOT run the full e2e suite (~10 min); implementer's 106/106 taken on trust, low risk.

## Premise checks I did rather than trust
- `src/view/settingsDebounce.ts`: insertion-ordered `pending` Map, ONE shared window,
  `drain()` snapshots + runs in edit order in ONE `runSerialised` slot, each awaited.
  ⇒ sentinel-ordering barrier in `e2e/settingsWriteWindow.ts` is SOUND.
- `src/engine/constants.ts` `clampSizingNumber` → `clampIntoRange` (no step snap / no round for
  sizing; rounding is the DEPTH accessor). `depthDecayK` spec `{default 1, min 0, max 10, step .5}`
  ⇒ sentinel values `0` / `0.5` stored verbatim, poll cannot hang.
- `e2e/obsidianHarness.ts:353` `readGlobals()` reads IN-MEMORY `pluginDataStore`, NOT the file
  ⇒ the "reached data.json" wording is an overclaim (finding #2).
- `VicinityGraphSettingTab.hide()` does not cancel the timer and the tab instance survives
  open/close ⇒ test 11 is insensitive to the flush (finding #1). Corroborated by my own timings:
  test 11 = 37 ms vs ~900 ms for the window-waiting tests.

## Key reasoning for finding #1 (the one to defend if pushed back on)
The test name is honest and the WHY-NOT comment discloses it; the commit message and the spec header
are NOT. `flushOnBlur` has zero coverage too. Fix is either a wording/ticket-note correction or a
bounded-latency assertion (37 ms observed vs a 400 ms window = >10x headroom, so 250 ms is not a
coin flip). Do not accept "it's covered" — it is not.

## Deliberately NOT raised (avoiding nitpicks)
- `fill()` vs `pressSequentially()` — documented WHY, per-keystroke path is unit territory.
- `toHaveText` whitespace normalisation — the multi-line case is covered by the `pre-line` probe.
- Comment density is high but this repo's style is explicitly WHY-heavy; consistent.

---

## Round 2 (commit 79ca22a) — verdict APPROVED, readiness signalled

All 6 round-1 findings RESOLVED. Round-2 section appended to the PUBLIC review.

### What I actually ran (logs in `.tmp/`)
- `npm run check` → exit 0 (`r2-check.log`)
- `npm test` → exit 0, 94 files / 1245 tests (`r2-test.log`)
- `npm run test:e2e -- settingsTypedInput.e2e.ts` → 15 passed, 17.9 s (`r2-e2e.log`)
- same `--repeat-each=5` → 75/75, per-test 918–939 ms (`r2-e2e-repeat.log`)
- 2 flush tests `--repeat-each=6` under 64 busy procs / 32 cores → 12/12 (`r2-e2e-load.log`)
- MUTATION (mine): emptied `flushOnBlur`'s listener → blur test FAILS at **468 ms**
  (`r2-mutation-blur.log`); `git checkout` reverted, tree clean, spec re-run 15 passed
  (`r2-e2e-postrevert.log`).

### Why I accepted the latency bound
`startedAt` captured before `editAndLeave()`; timer armed at the keystroke (strictly later);
`setTimeout` never fires early ⇒ observation < 400 ms cannot be the timer, and budget is 300 ms.
Budget derives from `SETTINGS_WRITE_DEBOUNCE_MS` (imported), so it tracks the product constant.
Load probe answered the CI-flake worry: ~30 % overall slowdown, flush nowhere near the budget;
would need ~20× degradation to flake.

### Trust boundary
Full e2e suite (110 passed) and the other two mutation rows taken on trust; my own blur mutation
corroborates the direction. Flush `elapsedMs` itself inferred from test-duration deltas (~20 ms over
a no-flush baseline test) because I am read-only and could not instrument.

### Deliberately not raised at round 2 (churn)
- Failure message asserts "it was the debounce timer" even if extreme load were the cause — fine,
  it fails red with the number in it.
- Per-GIVEN `drain()` adds ~900 ms/test (spec 4.3 s → 18 s). Correct trade, stated in the review.
