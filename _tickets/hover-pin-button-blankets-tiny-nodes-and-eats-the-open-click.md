---
id: nid_oa8qzdnnz8lqx1bbwcxsyjnmz_E
title: "Hover pin button blankets tiny nodes and eats the open-click"
status: open
deps: []
links: []
created_iso: 2026-07-21T00:04:22Z
status_updated_iso: 2026-07-21T00:04:22Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, graph]
---

Observed while root-causing an e2e failure (e2e/neighborhoodGraph.e2e.ts interaction tests).

The hover-reveal pin/unpin button (`.neighborhood-graph-pin-button`, src/view/NoteNode.tsx + src/view/graph-view.css:236) is a 20x20px chip pinned `top:4 right:4` with `opacity:0` until node hover. Because `opacity:0` elements STILL receive pointer events, the button always occupies the node top-right AND, on nodes rendered smaller than ~48px (e.g. a dense fit-view where many nodes shrink to ~20px), it covers the ENTIRE node body — including the center.

Effect: a normal click on such a small node lands on the (possibly invisible) pin button, whose onClick calls stopPropagation(), so React Flow onNodeClick never fires and the note does NOT open (it may instead get pinned). Reproduced in headless e2e: clicking a node in note1's 11-node neighborhood (each ~20px) hit the pin button instead of opening the note.

Suggested fixes (pick one, KISS):
- Gate the pin button with `pointer-events:none` while hidden (consistent with the read-only handle pattern at graph-view.css:224), AND hide it entirely below a size threshold via the existing container-query density pattern (graph-view.css:210-221) so tiny nodes have no pin affordance (right-click menu still offers pin/unpin).

Severity: minor/edge-case for real users (they rarely click ~20px nodes; they zoom first), but it is a real correctness gap in the primary click-to-open gesture at high zoom-out.

Workaround already in place: the e2e interaction tests now click on the ALPHA graph (3 large nodes) instead of note1's dense graph.

