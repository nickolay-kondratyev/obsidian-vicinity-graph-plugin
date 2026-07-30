---
closed_iso: 2026-07-30T02:28:50Z
id: nid_uer0a6uxv9ff3sxo9a4je40gp_e
title: "Dead CSS: .vicinity-graph-layout (layout-mode selector) is rendered nowhere"
status: closed
deps: []
links: []
created_iso: 2026-07-30T02:01:32Z
status_updated_iso: 2026-07-30T02:28:50Z
type: chore
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [view, cleanup]
---

`src/view/graph-view.css` still ships a `.vicinity-graph-layout` / `.vicinity-graph-layout select` rule pair (a `<select>` row in the controls panel), but the layout-mode selector was removed by the force-layout-only ticket — `grep -rn "vicinity-graph-layout" src/` finds no `className`/`cls` that renders it.

Spotted while rewriting both settings presenters onto the shared row model (`nid_armoson86j0ii8c33r1odo1rc_e`); deliberately left alone there to keep that diff about the row contract.

Note `e2e/selectorGuard.test.ts` cannot catch this: it guards the OTHER direction (an e2e selector for a class src/view no longer renders), not CSS with no renderer.

## Acceptance Criteria

The two dead rules are gone from `src/view/graph-view.css`; `npm run build` regenerates `styles.css`; `npm test` and `npm run check` stay green.


## Notes

**2026-07-30T02:28:50Z**

ALREADY DONE - filed one commit too early. nid_armoson86j0ii8c33r1odo1rc_e deleted the
.vicinity-graph-layout / .vicinity-graph-layout select rules from
src/view/graph-view.css in the same diff that filed this (the hunk that replaced the
layout-mode block with .vicinity-graph-slider-row*). `grep -rn "vicinity-graph-layout"
src/` now finds nothing. Nothing left to do; the claim that the rules "still ship" was
wrong the moment it was written.
