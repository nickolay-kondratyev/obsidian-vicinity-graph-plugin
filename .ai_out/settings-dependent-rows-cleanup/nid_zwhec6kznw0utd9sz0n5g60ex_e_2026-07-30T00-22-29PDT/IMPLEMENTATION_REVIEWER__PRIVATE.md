# PRIVATE — IMPLEMENTATION_REVIEWER — `nid_zwhec6kznw0utd9sz0n5g60ex_e`

## Status: REVIEW COMPLETE. VERDICT = CONVERGED. Nothing left to do.

No prior REVIEWER PRIVATE file existed — cold start, single review pass, no iteration needed.

## What I actually ran (not inferred)

- `npm run check` → exit 0. Log `.tmp/rev-check.log`.
- `npm test` → exit 0, 94 files / 1245 tests. Log `.tmp/rev-test.log`.
- No `sanity_check.sh` in this repo (confirmed by `ls`).
- `npm run test:e2e` NOT run — release gate, needs real Obsidian. Same honest position the maker
  took; acceptable for a comment + dead-branch deletion that `check:e2e` covers.

## The judgement call, settled

`SIZING_METRICS` = `as const satisfies readonly SizingMetricLabel[]`, 5 literal entries
(`src/view/sizingMetrics.ts:20-26`). Const tuple ⇒ literal in-range index is NOT widened by
`noUncheckedIndexedAccess` (that rule hits index signatures / array types, not tuple in-range
literals). Guard dead. Maker's reasoning correct.

Key extra argument I added that the maker did not make: emptying the tuple later yields a
**compile error** at `SIZING_METRICS[0]`, so the deleted throw's stated protection is not lost —
it moved earlier. That is why removal is strictly better, not merely safe.

## Comment audit (the ticket's real point)

Read all comments in `e2e/settingsDependentRows.e2e.ts` post-change. Only two depended on the
throw, both deleted. Verified none of the rest reference the throw or optionality:
header 8-32, 45-49, 52-58, 61-68, 85-87, 172-180, 202, 205-208, 230-231, 252-253, 264-265, 273-275.

Second deletion (arrow-const justification) judged CORRECT — it was true only while the throw
existed; keeping it reproduces the exact defect the ticket fixes.

## Only thing a reader might push back on

`expectExclusionPersisted` = `async function`, `expectMetricEnabledPersisted` = arrow const, and
the asymmetry now has no written reason. Logged as a LOW suggestion with an explicit
"leave it / don't do it under this ticket" recommendation — converting it is churn on a ticket
whose whole requirement was "nothing else".

## Scope check

Diff = `e2e/settingsDependentRows.e2e.ts` (-8/+1) + maker's `.ai_out/` notes. No prod code, no
baselines, no anchor points, no tests removed. All three spec tests intact.

## Files written

`IMPLEMENTATION_REVIEWER__PUBLIC.md` (verdict + numbered findings), this file.
Did not read any other role's PRIVATE file. Did not modify code (read-only role, respected).
