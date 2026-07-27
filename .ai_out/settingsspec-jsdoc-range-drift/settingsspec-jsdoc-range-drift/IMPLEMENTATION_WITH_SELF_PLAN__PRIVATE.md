# PRIVATE — rehydration memory (IMPLEMENTATION_WITH_SELF_PLAN)

Ticket: `nid_2yygojiqkdi9hp73pgv0w7qfu_e`
Branch: `settingsspec-jsdoc-range-drift` (base `3e85ecb`).

## State: DONE (uncommitted). Single file touched.

`src/engine/SettingsSpec.ts` — JSDoc block above `linkStrengthFactor` rewritten.
No other file changed. No commit made (TOP_LEVEL_AGENT owns commit + change_log +
ticket closure).

## Plan (all steps complete)

1. [x] Read EXPLORATION_PUBLIC.md + ticket.
2. [x] Re-verify line numbers on branch (`linkStrengthFactor` spec entry was at :231,
       JSDoc :221-230; centerPullStrength cross-ref at :203-207). Matched exploration.
3. [x] Git-archaeology the `max: 2 → 4` change (this was the whole point — see below).
4. [x] Rewrite the JSDoc honestly.
5. [x] Spot-check the sweep (acceptance criterion 2).
6. [x] `npm run check` (exit 0) + `npm test` (79 files / 1053 tests passed).
7. [x] Write PUBLIC + PRIVATE.

## Archaeology result (the load-bearing finding)

`git log -L '/linkStrengthFactor: {/,+1:src/engine/SettingsSpec.ts'` gives exactly two
commits:

- `07c4db7` — introduced the entry as `max: 2` **with** the "above ~2 the stiff springs
  overshoot … stops converging cleanly" prose.
- `dee64c3` (2026-07-24 15:39, author nickolaykondratyev, message literally
  **"Modified file: SettingsSpec.ts"**) — a **one-line bare hand-edit** `max: 2 → 4`.
  Diff is 1 file, 1 insertion, 1 deletion. The JSDoc three lines above was NOT touched.
  That IS the drift's origin.

Cross-check: `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`
attributes the raise to `22bd5cb` — **that attribution is wrong**. Verified
`git merge-base --is-ancestor dee64c3 22bd5cb` → NO, and `22bd5cb` only moved
`linkGapPx.max 150→250` and `collidePaddingPx 20→50 / max 80→100`. Same author, same
day, ~2.5h earlier. (Left uncorrected — not my ticket; noted in PUBLIC for the human.)

That ticket also states, in its own words: "nothing records what `4` was validated
against". So **there is no substantiable WHY for `max: 4`.** Hence the honest doc
rather than a rationale swap.

## Mechanically-true claim I DID keep

`src/view/d3ForceRefinement.ts:83-87` sets
`strength = linkStrengthFactor / min(linkCount(source), linkCount(target))`.
So for a degree-1 leaf the spring strength *is* the factor; above 1 d3 forceLink's
per-tick correction exceeds the distance error (only alpha damps it). Static run is
fixed-tick (`d3ForceRefinement.ts:98`). This is verifiable from the code, so it stayed.

## Invariants preserved

- `centerPullStrength` JSDoc (:203-207) cross-references `linkStrengthFactor` **min 0.25** —
  min untouched, cross-ref still accurate. Also machine-pinned by
  `src/engine/forceLayoutSettings.test.ts:68`.
- No `ap_XXX_E` anchors in or near the edited region.
- Zero spec/test values changed.

## If picked up again

Nothing outstanding except the two items flagged for the human in PUBLIC §5
(unsubstantiated `max: 4`; misattribution in the docs-internal ticket).
