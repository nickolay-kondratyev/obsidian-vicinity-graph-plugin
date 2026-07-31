---
closed_iso: 2026-07-27T18:26:13Z
id: nid_2yygojiqkdi9hp73pgv0w7qfu_e
title: "linkStrengthFactor JSDoc documents [0.25, 2] but spec ships max: 4"
status: closed
deps: []
links: []
created_iso: 2026-07-25T16:36:34Z
status_updated_iso: 2026-07-27T18:26:12Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [docs, settings]
---

`src/engine/SettingsSpec.ts` (~:196-198) carries a JSDoc comment for `linkStrengthFactor` documenting a range of `[0.25, 2]`, while the spec entry immediately below it ships `max: 4`.

Found while closing nid_abreq4lmpo8vnvf61y9k9yly0_e (making the SettingsSpec baseline tests exhaustive). Confirmed live doc drift by two independent reviewers on branch `settings-spec-baseline-exhaustive`; deliberately left untouched there to keep that diff attributable to the test-quality fix.

The baseline tests now pin `linkStrengthFactor.max: 4`, so the code + tests agree — only the prose is stale.

## Acceptance Criteria

1. The JSDoc range for `linkStrengthFactor` in `src/engine/SettingsSpec.ts` matches the shipped `min`/`max` (currently `max: 4`).
2. A sweep confirms no other SettingsSpec JSDoc range contradicts its spec entry.


## Notes

**2026-07-27T18:26:12Z**

Resolved on branch settingsspec-jsdoc-range-drift (commits 7892edf, 8b6ea39).

AC1: linkStrengthFactor JSDoc now documents [0.25, 4], matching the shipped
{ default: 1, min: 0.25, max: 4, step: 0.05 }. Deliberately not a digit-swap: the stale
prose carried a rationale ('above ~2 the springs overshoot'), so it was rewritten to be
true rather than re-thresholded. git archaeology: 07c4db7 introduced max 2 together with
that prose; dee64c3 raised it to 4 as a one-line hand-edit without touching the comment.
258ec5a's message records 'Human-decided (2026-07-24): the shipped spec value is the
intended one', so max 4 is documented as a maintainer-chosen headroom ceiling, explicitly
NOT a measured stability limit. The one mechanical fact (the factor scales d3's
1/min(degree), so a degree-1 leaf's spring strength IS the factor) is kept and was verified
against src/view/d3ForceRefinement.ts:83-87.

AC2: full sweep of all bounded entries in src/engine/SettingsSpec.ts done twice
independently (exploration + reviewer, from scratch). linkStrengthFactor was the ONLY
prose/spec contradiction. No drift in README.md, docs-internal/, src/view/ UI strings,
types.ts, or constants.ts (FORCE_LAYOUT_RANGES is a mechanical projection of the spec).

Docs-only: src/ diff is provably comment-only, no spec value or test changed.
npm run check exit 0; npm test 1053/1053 across 79 files.

Side fix: docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md
misattributed the max raise to 22bd5cb (which touched only linkGapPx/collidePaddingPx);
corrected to dee64c3 and noted the 258ec5a human trailer. That ticket stays OPEN — whether
the trailer suffices to close it is a human call.
