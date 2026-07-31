---
closed_iso: 2026-07-31T19:59:16Z
id: nid_faeb5geo50afipdbwf1y2dz12_e
title: 'elkNodeSpacingPx default mismatch: spec says 40, doc comment and pinned tests
  say 20'
status: closed
deps: []
links: []
created_iso: '2026-07-31T19:09:34Z'
status_updated_iso: 2026-07-31T19:59:16Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Pre-existing test failures on main (verified on a clean tree via git stash + rerun):

- `src/engine/settingsProductDefaults.test.ts` — pinned literal `"globalView.forceLayout.elkNodeSpacingPx": 20` vs `SETTINGS_SPEC` default `40`.
- `src/view/groupPacking.test.ts` — "member spacing mirrors the shipped default" expects 20, gets 40.

`SETTINGS_SPEC.globalView.forceLayout.elkNodeSpacingPx.default` is 40, while its OWN doc comment and both pinned tests say 20. Likely a bad merge (branch merge-2026-07-31T18-51-41CST era).

HUMAN DECISION NEEDED: which is the shipped default — 20 or 40? Whichever wins, fix spec + doc comment + the two pinned literals to agree (the pinned-defaults suite exists precisely so this is a conscious act).

Not fixed in ticket nid_ts4rx2pfo6o18verzk07z16g8_e (depth for pinned nodes) because it is an unrelated shipped-default product call.

--------------------------------------------------------------------------------
HUMAN DECISION:
THE default is now 40.  
Lets lower the commenting so that we don't duplicate the values stated in the comments to avoid such mismatches, we should be able to adjust the code for default without having to hunt for comments.

## Notes

**2026-07-31T19:59:16Z**

RESOLVED — default is 40 (human decision).

State found: both pinned suites (`settingsProductDefaults.test.ts`, `groupPacking.test.ts`) had already been reconciled to 40 on this branch and passed; only the comments were stale.

Done (commit c6fa6be):
- `SettingsSpec.ts` elkNodeSpacingPx doc: dropped the obsolete "shipped default lowered 40 -> 20" narrative (and the fill 0.51 -> 0.59 / 16px-gutter arithmetic that argued for 20). The WHY now states the density-vs-separation tradeoff and the packing-headroom fact without naming the number; the range paragraph no longer restates `[10, 120]`.
- Same file, per the human note about not duplicating values in comments: removed default restatements on `collidePaddingPx` ("raised 20 -> 50"), `linkStrengthFactor`, `edgeRoutingClearancePx` ("Default 11 ...", "11 sits mid-band"), `nodeCap` ("step doc: default 100") and `NODE_SIZE_PX_BOUNDS` ("2.5x the shipped 160 default").
- Test/fixture headers that narrated the stale retune arrows: `testFixtures/settingsSpecLeaves.ts`, `forceLayoutSettings.test.ts`, `settingsProductDefaults.test.ts` (also its `minPx` inline comment).

Left alone deliberately: `groupPacking.test.ts` measurement tables and fill floors keep their "@40 / @20" labels — those are measurement PROVENANCE (a floor means nothing without the spacing it was measured at), not a duplicate of the default. `graphFixtures.ts` keeps the literal 40 because the mirror test locks it to `EngineDefaults`, so it cannot go stale silently.

Verified: `npm test` 103 files / 1379 tests pass; `npm run check` clean.
