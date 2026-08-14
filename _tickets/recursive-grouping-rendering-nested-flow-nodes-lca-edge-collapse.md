---
closed_iso: 2026-08-14T01:34:43Z
session_ids: [{"a": "claude", "type": "execution", "id": "3750bfb8-774a-471e-847f-fa3cca292528"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_9uh2twn8whoqtplbxk0ywzpx7_e
title: "Recursive grouping rendering: nested flow nodes + LCA edge collapse"
status: closed
deps: [nid_d44vbnq9o6rhuelfwclx2e34n_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T01:34:43Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Depends on the nested-elk-layout ticket.

src/view/flowMapping.ts:
- Emit nested group nodes with multi-level parentId chains. Ordering invariant generalizes to: ancestor groups before descendant groups before member notes (React Flow requires parents precede children in the nodes array).
- withPositions: absolute -> parent-relative conversion must hold across multi-level parent chains.
- buildFlowEdges: replace one-level projection with LCA projection (signed-off D3): for edge X->Y find the lowest common ancestor CONTAINER (a group or the root canvas) via the grouping-tree seam; each endpoint projects to its outermost group strictly inside that container (or itself). Same-container edges stay passthrough; differing projections collapse with count badge exactly as today. Cross links (showCrossLinks / CrossLinkSweep) flow through identically - no extra branch.
- Group label (signed-off A1): src/view/FolderGroupNode.tsx shows folder NAME by default; a collapsed chain can show its full chain path when the Grouping label setting says so (setting wired in a separate ticket - here just render from the group model fields and keep full folder path in the title tooltip). Label is pure text - box size stays computed from packed children + constant paddings, no label measurement.
- Edge routing: src/view/edgeRouting.ts extractEdgeRoutingInput already makes every note and folder-group an obstacle; ensure obstacle coordinates are ABSOLUTE across multi-level parentId chains (today only one level of parent offset exists). Nested boxes become folder-group obstacles automatically.

Tests: flowMapping.test.ts (nesting order, parentId chains, LCA collapse incl. cross-link parity), edgeRouting.test.ts (absolute coords under nesting). Run e2e specs covering the graph surface (npm run test:e2e -- vicinityGraph.e2e.ts at minimum) before calling rendering done.


## Notes

**2026-08-14T01:08:59Z**

REGRESSION WINDOW surfaced by review of nid_unqqausmhnujjixitr6kieflq_e (recursive grouping CORE).

After that ticket, src/view/folderGrouping.ts deriveFolderGroups emits a "pure nesting-parent" group with EMPTY memberPaths: a qualifying folder whose visible notes all live in >=2 qualifying SUBFOLDERS and has no direct notes of its own (not collapsed, because it has >=2 child groups). Repro: notes sql/joins/a.md, sql/joins/b.md, sql/windows/c.md, sql/windows/d.md -> groups = [sql (memberPaths []), sql/joins, sql/windows].

Because the consumers are still FLAT until this ticket lands, this ships a phantom EMPTY group box for such vaults:
- src/view/flowMapping.ts (~L245 vicinityGraphToFlow) emits a GroupFlowNode for `sql` with NO note children referencing it (parentId only set on note nodes) -> empty labeled box rendered as a top-level sibling of the two real group boxes.
- src/view/elkMapping.ts (~L43) emits an elk container with children: [].
Before the core branch, `sql` was never a group, so no such box existed.

The nesting rewrite in THIS ticket resolves it by construction (the parent group contains its child group nodes/containers, so it is no longer empty). ACTION: ensure the nested-flow/elk rewrite covers the zero-direct-member nesting parent and add a flowMapping.test.ts case asserting a pure nesting-parent renders as a non-empty container (its child groups nested), NOT an empty box. If any release is cut before this lands, an interim guard is trivial: skip groups whose memberPaths is empty in the flat consumer.


## Resolution — 2026-08-14

**Key finding:** the substantive rendering work this ticket describes had ALREADY
landed with the dependency commit `86a442d` ("Recursive grouping layout: nested
elk containers + LCA edge attachment"). Because the elk layout tree and the React
Flow parentId tree MUST agree on the same grouping seam, that commit necessarily
rewrote `flowMapping.ts` alongside `elkMapping.ts`. So when this ticket started,
`src/view/flowMapping.ts` already emitted nested group nodes with multi-level
parentId chains, ordered ancestor-first by folder depth, used the LCA projection
seam (`lowestCommonAncestorContainerOf` + `projectOntoContainerChildOf`) in
`buildFlowEdges`, and `withPositions` already converted absolute→parent-relative
correctly for any depth. The empty-nesting-parent regression was likewise resolved
by construction and already covered (flowMapping.test.ts "a nesting parent has no
direct notes THEN its box is NOT empty").

Multi-level correctness holds because coordinates stay ABSOLUTE end to end:
`elkMapping.collectPositions` accumulates parent offsets recursively (arbitrary
depth), `extractEdgeRoutingInput` reads that absolute positions map verbatim (no
per-level offset math of its own), and `withPositions` subtracts only the
IMMEDIATE parent's absolute origin. Nothing was one-level-limited.

**What this ticket added (the genuine deltas):**

1. `src/view/flowMapping.ts` — group label now sources from the group MODEL
   (`group.leafName`) instead of recomputing `VaultPathFacts.folderNameOf(folder)`
   (DRY; behaviour identical since they compute the same string). Comment records
   the signed-off A1 intent: leaf name by default, full folder path in the
   FolderGroupNode tooltip (`data.folder`, already wired), and that the
   collapsed-chain label (`chainPath`, already on the model) is switched on by a
   SEPARATE settings ticket — so `chainPath` is deliberately NOT carried onto
   `FlowGroupData` yet (OCP / no-unused-code: added with its consumer). Removed the
   now-unused `VaultPathFacts` import.

2. `src/view/flowMapping.test.ts` — new "deeply nested folder groups" describe
   (three-deep `A ⊃ A/B ⊃ A/B/C` + sibling top-level `P`): asserts the multi-hop
   parentId chain, ancestor-before-descendant ordering across two hops, innermost
   membership for a 3-deep note, LCA projection onto the OUTERMOST groups when two
   notes share only the canvas pane (edge `A/B/C/c1 → P/p1` collapses to
   `folder-group:A ↔ folder-group:P`, NOT the inner boxes), and a multi-hop
   `withPositions` case proving each node lands relative to its IMMEDIATE parent only.

3. `src/view/edgeRouting.test.ts` — new "extractEdgeRoutingInput under multi-level
   nesting" describe: a two-deep tree confirms an inner group box and a 2-deep note
   become obstacles at their ABSOLUTE coords verbatim (no parent offset re-added),
   locking the contract the ticket flagged.

**Cross-link parity (showCrossLinks / CrossLinkSweep):** confirmed by inspection —
by the time `flowMapping` runs, cross links are ordinary entries in `graph.edges`
with no distinguishing field, so `buildFlowEdges` collapses them through the exact
same LCA path with no extra branch. Nothing to special-case; existing + new
collapse tests cover the shape.

**Verification:** `npm run check` ✓; `npm test` ✓ (2016 tests, +7 new); `npm run
test:e2e -- vicinityGraph.e2e.ts` ✓ (27 passed, incl. group-render and
cross-boundary-collapse specs). No e2e submodule changes (no e2e specs touched).
