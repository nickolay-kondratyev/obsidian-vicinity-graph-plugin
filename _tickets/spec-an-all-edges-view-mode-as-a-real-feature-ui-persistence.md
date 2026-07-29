---
id: nid_puf4a4q6fgn5lpehh5dowfm1r_e
title: "Spec an 'all-edges' view mode as a real feature (UI + persistence)"
status: open
deps: []
links: []
created_iso: 2026-07-29T18:05:04Z
status_updated_iso: 2026-07-29T18:05:04Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, graph, decide]
---

The orphan `edgeVisibility` setting was DELETED in nid_niz5dz6uqeyv237ckm15ittqa_e (owner decision 2026-07-29): it had no write path anywhere, so the induced-subgraph "all-edges" implementation in src/engine/EdgeVisibility.ts (now src/engine/EdgeCounts.ts, walked-edges only) was removed with it.

The IDEA is not dead: rendering every link between two visible nodes (post-truncation induced subgraph) may still be a good feature. If wanted, it must be specced properly with a UI control, a cascade story (global / MAIN / pinned), persistence and tests — NOT resurrected as dead config.

Prior implementation is recoverable from git history (src/engine/EdgeVisibility.ts before the deletion commit).

[decide] Human must decide whether this feature is wanted at all before any work starts.

## Acceptance Criteria

Either the ticket is closed as "not wanted", or an "all-edges" mode ships with a real settings control, persistence and tests.

## Human question
Aren't we rendering all links between nodes as collapsed together (and the amount of edges that were collpased with XHowMany)? What is this ticket about?

### Answer (2026-07-29)
Two different things.

**The `xN` badge** collapses parallel links between the SAME pair: N links A->B dedupe to one
edge (src/engine/EdgeAccumulator.ts:13) whose count comes from `provider.getLinkCount`
(src/engine/EdgeCounts.ts:28) and renders as `xN` (src/view/badgeText.ts:37). A<->B stays two
curved edges. Folder-group collapse sums counts across the fan (src/view/flowMapping.ts:276).

**This ticket** is about node pairs with ZERO edge drawn. An edge exists only if the BFS actually
traversed the link (src/engine/VicinityTraversal.ts:125 is the only `recordEdge` call), and a node
is expanded only while `currentDepth < depthLimit` (:111). So two nodes sitting at the depth
boundary that link to each other in the vault render with no edge at all -- not an edge with a low
count. The truncator only filters the walked set (src/engine/GraphTruncator.ts:51); it never adds.

The deleted `all-edges` mode swept every visible node's outgoing links post-truncation and drew the
full induced subgraph, surfacing exactly those missing frontier-to-frontier edges. Walked-only was
a deliberate owner decision (step-02 CLARIFICATION Q5, "the cleaner graph"), documented at
src/engine/EdgeCounts.ts:23.

So the decision reduces to: should frontier nodes that link to each other be visibly connected?