---
id: nid_faeb5geo50afipdbwf1y2dz12_e
title: "elkNodeSpacingPx default mismatch: spec says 40, doc comment and pinned tests say 20"
status: open
deps: []
links: []
created_iso: 2026-07-31T19:09:34Z
status_updated_iso: 2026-07-31T19:09:34Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [decide]
---

Pre-existing test failures on main (verified on a clean tree via git stash + rerun):

- `src/engine/settingsProductDefaults.test.ts` — pinned literal `"globalView.forceLayout.elkNodeSpacingPx": 20` vs `SETTINGS_SPEC` default `40`.
- `src/view/groupPacking.test.ts` — "member spacing mirrors the shipped default" expects 20, gets 40.

`SETTINGS_SPEC.globalView.forceLayout.elkNodeSpacingPx.default` is 40, while its OWN doc comment and both pinned tests say 20. Likely a bad merge (branch merge-2026-07-31T18-51-41CST era).

HUMAN DECISION NEEDED: which is the shipped default — 20 or 40? Whichever wins, fix spec + doc comment + the two pinned literals to agree (the pinned-defaults suite exists precisely so this is a conscious act).

Not fixed in ticket nid_ts4rx2pfo6o18verzk07z16g8_e (depth for pinned nodes) because it is an unrelated shipped-default product call.

