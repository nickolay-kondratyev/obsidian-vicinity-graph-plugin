---
closed_iso: 2026-07-30T02:51:18Z
id: nid_9wed7bqboqb83aghmt1sctv90_e
title: "Run the e2e release gate on the dual-presenter branch: 4 specs were rewritten and never executed"
status: closed
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_0u28xzhz05qewz35jfqkxkvz2_e, nid_73ykoegwri2xdixm8k5mr6oop_e]
created_iso: 2026-07-30T02:28:26Z
status_updated_iso: 2026-07-30T02:51:18Z
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


## Notes

**2026-07-30T02:51:18Z**

DONE. `npm run test:e2e` ran for real on this branch (pinned Obsidian 1.12.7, headless
Ozone): 95 passed / 1 skipped (pre-existing env-gated externalVault.e2e.ts) / exit 0.

All four at-risk specs passed UNMODIFIED - the dual-presenter rewrites were correct.
No assertion tuned, no spec skipped or re-baselined (diff: 338 insertions, 0 deletions).

Verifying the flagged 260px-panel risk surfaced a real unguarded bug: the panel body's
flex children defaulted to `flex-shrink: 1`, so open disclosures shrank into the 60vh cap
and each `overflow: hidden` section silently clipped its rows - no scrollbar, no error
state, controls unreachable. Root-cause fix `.vicinity-graph-toolbar__body > * {
flex-shrink: 0 }` in src/view/graph-view.css, guarded by a new RED-verified test in
e2e/settingsUxVisual.e2e.ts (1px named tolerance for dPR!=1 hosts, plus a non-vacuity
assertion). Label wrapping measured with real geometry: nothing clipped or ellipsised.

Reviewed twice; final verdict APPROVE, 0 blocking. npm test 1139 passed, npm run check clean.

Follow-up filed: nid_73ykoegwri2xdixm8k5mr6oop_e (decide) - the 60vh cap now works, but
whether 2.3 screens of scroll on a 260px surface is the intended UX is an owner call.
Change log: 9qqsuyy5tfd3ti47i2sa90cw3
Artifacts: .ai_out/e2e-release-gate-dual-presenters/nid_9wed7bqboqb83aghmt1sctv90_e_2026-07-29T19-31-13PDT/
