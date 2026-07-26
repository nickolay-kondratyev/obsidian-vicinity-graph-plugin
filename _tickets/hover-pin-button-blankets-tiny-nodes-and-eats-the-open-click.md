---
closed_iso: 2026-07-26T15:30:54Z
id: nid_oa8qzdnnz8lqx1bbwcxsyjnmz_E
title: "Hover pin button blankets tiny nodes and eats the open-click"
status: closed
deps: []
links: []
created_iso: 2026-07-21T00:04:22Z
status_updated_iso: 2026-07-26T15:30:54Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, graph]
---

## Resolution (2026-07-21) — FIXED in step-07 Phase B (B1)

CSS-only fix in the SOURCE `src/view/graph-view.css` (the exact "FIX NOW" spec from
step-07 CLARIFICATION Q4):

1. Pin button gets `pointer-events: none` while hidden and `pointer-events: auto`
   only when revealed on hover/focus — so the transparent (`opacity:0`) button no
   longer eats the click-to-open gesture at ANY node size.
2. `display: none` below the `@container (min-height: 72px)` density threshold
   (same threshold as the attachment strip) — tiny nodes carry no pin affordance
   at all. Right-click pin/unpin (`NoteNode.onContextMenu`) is untouched and still
   reachable; keyboard focus still reveals the button.

Verified: `npm run build` regenerates `styles.css` with the change; independently
reviewed (PHASE_B_REVIEW verdict APPROVE, resolves this ticket without breaking
right-click pin/unpin). See
`.ai_out/step-07-hardening/step-07-hardening/PHASE_B_IMPLEMENTATION__PUBLIC.md`
(item B1) and `PHASE_B_REVIEW__PUBLIC.md`.

Follow-up: the e2e ALPHA-graph workaround (below) can likely be reverted now — see
`docs-internal/tickets/ticket-viewport-culling-visual-smoke.md`.

---

Observed while root-causing an e2e failure (e2e/vicinityGraph.e2e.ts interaction tests).

The hover-reveal pin/unpin button (`.vicinity-graph-pin-button`, src/view/NoteNode.tsx + src/view/graph-view.css:236) is a 20x20px chip pinned `top:4 right:4` with `opacity:0` until node hover. Because `opacity:0` elements STILL receive pointer events, the button always occupies the node top-right AND, on nodes rendered smaller than ~48px (e.g. a dense fit-view where many nodes shrink to ~20px), it covers the ENTIRE node body — including the center.

Effect: a normal click on such a small node lands on the (possibly invisible) pin button, whose onClick calls stopPropagation(), so React Flow onNodeClick never fires and the note does NOT open (it may instead get pinned). Reproduced in headless e2e: clicking a node in note1's 11-node vicinity (each ~20px) hit the pin button instead of opening the note.

Suggested fixes (pick one, KISS):
- Gate the pin button with `pointer-events:none` while hidden (consistent with the read-only handle pattern at graph-view.css:224), AND hide it entirely below a size threshold via the existing container-query density pattern (graph-view.css:210-221) so tiny nodes have no pin affordance (right-click menu still offers pin/unpin).

Severity: minor/edge-case for real users (they rarely click ~20px nodes; they zoom first), but it is a real correctness gap in the primary click-to-open gesture at high zoom-out.

Workaround already in place: the e2e interaction tests now click on the ALPHA graph (3 large nodes) instead of note1's dense graph.


## Notes

**2026-07-26T15:30:54Z**

Closing: fix is in the tree — .vicinity-graph-pin-button is display:none + pointer-events:none by default, revealed only under @container (min-height: 72px), and pointer-events:auto only on node hover / :focus-visible (src/view/graph-view.css:274-313). Ticket had been left at status 'resolved'; normalizing to closed.
