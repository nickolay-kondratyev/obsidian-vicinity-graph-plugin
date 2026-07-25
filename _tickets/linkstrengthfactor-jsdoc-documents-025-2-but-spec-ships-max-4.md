---
id: nid_2yygojiqkdi9hp73pgv0w7qfu_e
title: "linkStrengthFactor JSDoc documents [0.25, 2] but spec ships max: 4"
status: open
deps: []
links: []
created_iso: 2026-07-25T16:36:34Z
status_updated_iso: 2026-07-25T16:36:34Z
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

