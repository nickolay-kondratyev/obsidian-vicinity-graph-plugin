---
id: nid_2qygmn0z59t8fdlb5e9pap49m_e
title: 'Stage 2: render embed edges distinctly from plain-link edges'
status: in_progress
deps: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
links: []
created_iso: '2026-07-30T04:34:24Z'
status_updated_iso: '2026-07-31T17:48:01Z'
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [graph, ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
Owner decision D3 on ticket nid_fay1hu5sxcoygizopkkg0f0d7_e: the visual distinction is wanted, explicitly AFTER the depth budget (which shipped in Stage 3). Now unblocked.

WHAT: an edge walked as an EMBED should read differently from a plain link edge (the research proposed CSS-only: dashed / weighted stroke on `vicinity-graph-edge`, see src/view/graph-view.css).

WHAT IS ALREADY IN PLACE: `LinkKind` is carried end to end on the OUTGOING side (src/shared/LinkKind.ts, `LinkProvider.getOutgoingReferences` in src/engine/LinkProvider.ts), and the traversal walks embeds on their own `outgoing-embed` channel (src/engine/VicinityTraversal.ts).

WHAT IS MISSING, and it is the real work: NOTHING DOWNSTREAM OF THE TRAVERSAL CARRIES THE KIND. `DirectedLink` / `GraphEdge` (src/engine/types.ts) are `{source, target}` + `count`; `EdgeAccumulator` dedupes kind-blind. A pair can be BOTH embedded and plainly linked, so the edge kind is a SUMMARY, not a scalar: "link" | "embed" | "both".

Also decide what `getLinkCount` reports. It is deliberately KIND-BLIND today with a reasoned doc block on it (src/engine/LinkProvider.ts): for markdown the number IS Obsidian's merged `resolvedLinks` count, so a per-kind split would have to re-derive the total from the file cache and could change a rendered badge. If this ticket wants per-kind counts, that is the moment to revisit, and it is a measured behavior change, not a refactor.

OUT OF SCOPE: incoming stays kind-blind (settled scope cut).

## Acceptance Criteria

- An embedded-only edge, a plain-link-only edge and a both-kinds edge are visually distinguishable, and the both-kinds case is decided deliberately rather than by whichever kind won a race.
- The distinction is asserted by a test at whatever layer holds the decision (edge assembly), not only by eye.
- Any change to the edge COUNT badge is stated out loud, with the getLinkCount doc block updated.


## Notes

**2026-07-30T04:45:47Z**

Stage 3 review NIT, folded in here because it is the same kind-blind-downstream question: node SIZING is kind-blind too. src/engine/NodeSizer.ts:140 counts outgoing links via getOutgoingLinks (kind-blind), so with embedDepthOut: 0 a node is still SIZED by targets the graph will never walk. Defensible ("how connected is this note" != "what do I traverse") and consistent with getLinkCount, but undocumented. Decide it explicitly when this ticket decides the count question.
