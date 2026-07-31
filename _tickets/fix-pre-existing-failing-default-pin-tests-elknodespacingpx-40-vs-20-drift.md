---
id: nid_37vxpzbgh1yq6kxa0mw6n4iye_e
title: "Fix pre-existing failing default-pin tests: elkNodeSpacingPx 40 vs 20 drift"
status: open
deps: []
links: []
created_iso: 2026-07-31T18:59:32Z
status_updated_iso: 2026-07-31T18:59:32Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [tests]
---

On a CLEAN tree (verified via git stash on branch CC_nid_1drobt9qaq3e89gt76fzghlik_e..., 2026-07-31), `npm test` fails 2 tests unrelated to any local change:

- src/engine/settingsProductDefaults.test.ts: "WHEN every spec leaf's default is read THEN it is exactly the value pinned here" — pinned literal expects elkNodeSpacingPx 40, spec now yields 20 (or vice versa).
- src/view/groupPacking.test.ts: "WHEN measuring packing THEN the fixture's member spacing mirrors the shipped default" — expected 20 to be 40.

settingsProductDefaults.test.ts is the ONE sanctioned place for literal defaults; decide the intended shipped value for elkNodeSpacingPx (20 or 40), align the spec leaf and the pinned literal, and the groupPacking fixture follows. Likely fallout of a recent force-layout defaults change that updated one side only.

