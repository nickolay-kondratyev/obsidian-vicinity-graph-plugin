# PRIVATE — rehydration memory (IMPLEMENTATION_WITH_SELF_PLAN)

Ticket: `nid_2yygojiqkdi9hp73pgv0w7qfu_e`
Branch: `settingsspec-jsdoc-range-drift` (base `3e85ecb`).

## State: round 1 (post-review) DONE, uncommitted. Two files touched.

1. `src/engine/SettingsSpec.ts` — JSDoc above `linkStrengthFactor`. Comment-only.
   Now 7 insertions / 3 deletions vs base (was 10/3 in round 0 commit `7892edf`).
2. `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` —
   attribution fix + one dated note. Status left OPEN, no restructuring.

No commit. TOP_LEVEL_AGENT owns commit + change_log + ticket closure.

## Round 0 archaeology (still valid, now kept OUT of source)

- `07c4db7` introduced `max: 2` with the "above ~2 … stops converging cleanly" prose.
- `dee64c3` (2026-07-24 15:39, msg literally "Modified file: SettingsSpec.ts") = the bare
  one-line `max: 2 → 4` hand-edit. The JSDoc above was NOT updated → the drift.
- `22bd5cb` touched ONLY `linkGapPx.max 150→250` + `collidePaddingPx 20→50 / max 80→100`.
  It PRECEDES `dee64c3` (`git merge-base --is-ancestor dee64c3 22bd5cb` → NO).

## Round 1 — the fact I had missed

`git log -1 --format=%B 258ec5a` ends:
`Human-decided (2026-07-24): the shipped spec value is the intended one.`
→ `max: 4` is INTENDED, not accidental. Round-0 wording insinuated accident; removed.

## Round 1 dispositions (all 3 SHOULD-FIX incorporated, none rejected)

1. Stale/wrong-attribution ticket pointer → removed the `docs-internal/` path from source
   entirely (root fix), AND corrected the ticket's own `22bd5cb` → `dee64c3` line.
2. Proportionality → dropped hash + ticket path from the JSDoc (CLAUDE.md: SUCCINCT, stable
   knowledge not volatile details; `git log -L` reproduces it for free).
3. "past 1 the spring over-corrects every tick" → deleted. It was the same class of
   unsubstantiated dynamics claim I removed from the old comment. Replaced with the
   code-readable statement: fixed-tick static run (`d3ForceRefinement.ts:96-98`) relies on
   alpha decay.

Reviewer's proposed wording adopted with 2 small edits (see PUBLIC). Deliberately did NOT
cite `258ec5a` in-source — "maintainer-chosen" already asserts intent, and the citation would
re-add the volatile archaeology item #2 asks to remove.

## Invariants preserved (re-checked this round)

- `centerPullStrength` JSDoc (:203-207) cross-refs `linkStrengthFactor` min 0.25 — accurate;
  the new text still explains the 0.25-vs-0.15 relation. Machine-pinned by
  `forceLayoutSettings.test.ts:64-68`.
- No `ap_XXX_E` anchors in/near the region. Zero spec/test/behavior changes.

## Verification (round 1)

`npm run check` exit 0. `npm test` exit 0 — 79 files / 1053 tests passed.
`git diff 3e85ecb -- src/` filtered for non-comment changed lines → EMPTY.

## If picked up again

Nothing outstanding. Signalled readiness to converge in
`IMPLEMENTATION_ITERATION__PUBLIC.md`. Open items belong to TOP_LEVEL/human:
commit/change_log/closure; optional follow-up ticket for `outlineMaxDepth`'s "≤160px" prose
vs user-settable `maxPx` 400; and whether `258ec5a`'s trailer discharges step 1 of the
baseline-stale ticket.
