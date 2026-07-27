# PRIVATE — rehydration memory (IMPLEMENTATION_REVIEWER)

Round 1 review of `7892edf` vs `3e85ecb`. Status: **DONE**, verdict written to
`IMPLEMENTATION_REVIEW__PUBLIC.md`. No code edited (review-only mandate respected).

## What I independently verified (all commands re-run, not trusted from prior agents)

- `npm run check` exit 0; `npm test` exit 0, 79 files / 1053 tests. Logs in
  `.tmp/rev-check.log`, `.tmp/rev-test.log`. No `sanity_check.sh` in repo.
- `git diff 3e85ecb 7892edf -- src/ | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -v "^\s*[+-]\s*\*"`
  → **empty** ⇒ comment-only, proven not assumed.
- `dee64c3`: message `Modified file: SettingsSpec.ts`, 1/1/1, `max: 2 → 4`, JSDoc untouched. TRUE.
- `22bd5cb`: only `linkGapPx.max 150→250` + `collidePaddingPx 20→50 / max 80→100`.
  `merge-base --is-ancestor dee64c3 22bd5cb` = NO; reverse = YES. Implementer's
  misattribution finding is correct.
- `d3ForceRefinement.ts:84-88` strength = factor / min(linkCount(src), linkCount(tgt)) → the
  degree-1 claim is TRUE. `:96-98` fixed tick count → "fixed-tick static run" TRUE.
- Redid the criterion-2 sweep myself via a numeric-claim grep over all of SettingsSpec.ts.
  All 12 bounded entries match. Only `linkStrengthFactor` had drifted.
- `centerPullStrength` cross-ref (min 0.25) still accurate.

## The finding prior agents missed (my main value-add)

`258ec5a` commit message ends: **"Human-decided (2026-07-24): the shipped spec value is the
intended one."** So a human *did* confirm intent for `max: 4`. The new comment's wording is
still literally true (no *rationale*, not a *measured* limit), but the referenced ticket is
stale AND carries the false `22bd5cb` attribution → pointing source at it is the SHOULD-FIX.

## Findings issued

0 BLOCKING. 3 SHOULD-FIX: (1) ticket pointer targets a doc with known-false attribution;
(2) 80/20 — hash + docs-internal path in source is volatile, violates CLAUDE.md
"stable knowledge / SUCCINCT"; proposed a 6-line replacement in PUBLIC §SHOULD-FIX 2;
(3) "What IS mechanical" overclaims — the "past 1 the spring over-corrects" half is a
dynamics claim, same class as the prose just deleted for being unsubstantiated.
NITs: `outlineMaxDepth` ≤160px prose vs settable `maxPx` 400 (out of scope, ticket-worthy);
no-new-test decision endorsed.

## Convergence stance

NOT ready to converge on #1. Adopting the §2 wording collapses #1/#2/#3 into one edit.
If the human insists on keeping the archaeology in-source, only #1 (fix the ticket's
attribution) blocks, then I sign off.

---

## Round 2 (fresh instance, 2026-07-27) — CONVERGED, work is DONE

Reviewed cumulative `3e85ecb..HEAD` (`7892edf` + fix `8b6ea39`). Verdict: 0 BLOCKING,
0 SHOULD-FIX. Round-2 section appended to `IMPLEMENTATION_REVIEW__PUBLIC.md`.

Re-verified independently this round (not trusted from round 1 or the implementer):
- `npm run check` exit 0; `npm test` exit 0, 79 files / 1053 tests. Logs `.tmp/rev2-*.log`.
- Non-comment `src/` diff filter → empty. Spec entry `{1, 0.25, 4, 0.05}` untouched.
- `d3ForceRefinement.ts:83-87` strength = factor / min(degree); `:65` linkCountOf floors at 1;
  `:96-98` precomputed tick count on a `.stop()`ed sim. All three comment claims TRUE.
- `centerPullStrength.max 0.15` (`:209`) < `0.25` ⇒ the "dominant over strongest center pull"
  clause is true and now mutually consistent with the `centerPullStrength` JSDoc (`:203-207`).
- `22bd5cb` spec diff = linkGapPx.max + collidePaddingPx only; `dee64c3` = the 2→4 raise.
  Ticket's corrected sentence matches both. `258ec5a` trailer quoted verbatim. Status still
  OPEN, Origin header intact, no restructure, no closure.

Judgment call I made (record it, don't re-litigate): the surviving "well above 1 … relies on
alpha decay rather than on the spring settling by itself" is DEFENSIBLE, not an overclaim —
it is round 1's own proposed softening, asserts no threshold/instability/measurement, and
follows from d3's strength∈[0,1] relaxation semantics. Noted in PUBLIC as an explicit
NON-finding that the fixed tick count is factor-independent, so the "well above 1" qualifier
discriminates weakly; still true as written, not worth a round.

Nothing left for the reviewer role on this branch.
