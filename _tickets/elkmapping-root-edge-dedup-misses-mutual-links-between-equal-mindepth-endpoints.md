---
closed_iso: 2026-08-15T02:15:15Z
session_ids: [{"a": "claude", "type": "execution", "id": "b69bf4a5-1d35-49e7-b02e-849570144190"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_4i09w45k625h4ltdscishx6x3_e
title: "elkMapping root-edge dedup misses mutual links between equal-minDepth endpoints"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T02:15:15Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, layout]
---

ROOT CAUSE: src/view/elkMapping.ts:121-128 — root edges are documented as "deduped by projected pair", but the centre-outward flip uses STRICT less-than on minDepth (`outward = minDepth(target) < minDepth(source)`); a TIE keeps each edge's own order, so mutual links A→B and B→A between equal-depth nodes produce ids "A->B" AND "B->A" — two root edges for one unordered pair. Downstream refineForceRootLayout builds two RectLinks, inflating both endpoints' degree and applying two spring impulses (modest deterministic layout bias; mutual links between same-depth neighbors are common).

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/view/elkMapping.test.ts, "WHEN two equal-depth nodes link BOTH ways THEN the root keeps ONE edge for the pair".

FIX SHAPE: on tie, order the pair canonically (e.g. lexicographic by id) before minting the dedup key.

## RESOLUTION (2026-08-14, commit 22c3f1a)

Fixed as specified: in `attachEdgesToContainers` (src/view/elkMapping.ts) the centre-outward flip now breaks a minDepth TIE lexicographically by projected id (`targetDepth === sourceDepth && targetId < sourceId`), so mutual links between equal-depth endpoints mint ONE canonical dedup key. The function docstring now states the tie-break.

Acceptance test unskipped and passing: `src/view/elkMapping.test.ts` "WHEN two equal-depth nodes link BOTH ways THEN the root keeps ONE edge for the pair"; its KNOWN-BUG comment updated to describe the fixed behavior.

INTENDED SIDE EFFECT worth knowing: the step-05 fixture (all nodes at the default minDepth) had an assertion `root.md->folder-group:notes` whose orientation was a TIE previously kept in insertion order — now canonical, it flips to `folder-group:notes->root.md`. Root-edge orientation is only a force-seed hint (React Flow draws its own edges from `graph.edges`), so nothing user-visible changes direction; the test expectation was updated with a comment explaining why.

Verified: `npm test` (2108 passed), `npm run check`, and `npm run test:e2e -- vicinityGraph.e2e.ts` (27 passed) all green.

