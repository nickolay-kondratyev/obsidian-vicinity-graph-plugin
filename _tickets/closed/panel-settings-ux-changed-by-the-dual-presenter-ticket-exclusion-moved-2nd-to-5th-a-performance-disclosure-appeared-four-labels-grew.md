---
closed_iso: 2026-07-31T17:08:28Z
id: nid_0u28xzhz05qewz35jfqkxkvz2_e
title: "Panel settings UX changed by the dual-presenter ticket: exclusion moved 2nd to 5th, a Performance disclosure appeared, four labels grew"
status: closed
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_9wed7bqboqb83aghmt1sctv90_e, nid_73ykoegwri2xdixm8k5mr6oop_e]
created_iso: 2026-07-30T02:28:08Z
status_updated_iso: 2026-07-31T17:08:28Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [ux, settings, settings-cleanup, decide]
---

nid_armoson86j0ii8c33r1odo1rc_e made the in-graph controls panel derive its section
order and membership from SETTINGS_SECTIONS (src/view/settingsRows.ts) instead of a
hand-written order. Three user-visible consequences were NOT in any ticket and need
an owner yes/no:

1. Node exclusion moved from the 2nd disclosure to the 5th. It carries the panel's
   only exclusion on/off switch, and the README used to sell it as a prominent
   in-view control.
2. The panel gained a Performance disclosure with a Node cap row (it had none - this
   closed a parity gap nobody had ticketed). The panel is one disclosure taller.
3. Four panel labels took the settings tab's fuller wording on a ~260px surface:
   Outgoing -> Outgoing depth, Incoming -> Incoming depth, Min px -> Minimum node
   size (px), Max px -> Maximum node size (px), Exclude notes -> Exclude notes from
   the graph. Wrapping is unverified (npm run test:e2e was not run for this).

Implementer's and reviewer's shared recommendation: KEEP all three. One declared
order means a user who learns the tab gets the panel for free, and the two
hand-written orders were the drift generator; #2 is strictly more parity.

[decide] If the old exclusion prominence was intentional, the escape hatch is a
one-line declared panelOrder in src/view/settingsRows.ts (do NOT reintroduce a
second hand-written order in src/view/GraphToolbar.tsx). If the longer labels wrap
badly at 260px, tune .vicinity-graph-number-row / .vicinity-graph-exclusion__toggle-row
in src/view/graph-view.css rather than re-abbreviating - one label per row is the
property this ticket bought.


## Notes

**2026-07-31T17:08:27Z**

DECIDED by owner (2026-07-31): KEEP all three consequences as shipped.
1. Node exclusion stays 5th - panel mirrors the tab; no panelOrder override.
2. Performance disclosure (Node cap row) stays in the panel.
3. Fuller tab labels stay - CSS review confirmed .vicinity-graph-number-row is a flex row without nowrap and a fixed 4.5em input, so long labels wrap to a second line gracefully at ~260px (taller row, no clipping).
