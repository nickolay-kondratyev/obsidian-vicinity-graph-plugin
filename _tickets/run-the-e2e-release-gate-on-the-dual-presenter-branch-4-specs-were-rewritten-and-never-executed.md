---
id: nid_9wed7bqboqb83aghmt1sctv90_e
title: "Run the e2e release gate on the dual-presenter branch: 4 specs were rewritten and never executed"
status: open
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_0u28xzhz05qewz35jfqkxkvz2_e]
created_iso: 2026-07-30T02:28:26Z
status_updated_iso: 2026-07-30T02:28:26Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings-cleanup, e2e, settings]
---

nid_armoson86j0ii8c33r1odo1rc_e rewrote four Playwright specs to match the new
declared row model, but `npm run test:e2e` needs a REAL Obsidian and was not run in
that session. `npm test` (1139 tests) and `npm run check` are green, and the round-2
reviewer confirmed the spec edits are self-consistent with the code by inspection -
but nothing has actually driven the UI.

WHAT TO DO: run `npm run test:e2e` on this branch and fix whatever the real run
surfaces. Specs touched by that ticket (repo-relative):
- e2e/settingsResetVerify.e2e.ts (reset-scope label rename cascade)
- e2e/settingsUxVisual.e2e.ts (MIN_NAMED_CONTROLS baseline + the unnamed-control guard)
- e2e/settingsDependentRows.e2e.ts (exclusion patterns now always rendered, DISABLED,
  instead of hidden)
- the controls-panel disclosure spec (card-heading / disclosure lists are now derived
  from src/view/settingsRows.ts rather than hand-enumerated)

Specific risks to watch: the panel gained a Performance disclosure and Node cap row,
node exclusion moved from the 2nd to the 5th disclosure, and four panel labels got
longer on a ~260px surface (wrapping unverified) - see
nid_0u28xzhz05qewz35jfqkxkvz2_e for the owner decision on those.

