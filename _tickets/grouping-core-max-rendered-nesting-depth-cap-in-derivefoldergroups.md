---
closed_iso: 2026-08-15T05:36:36Z
session_ids: [{"a": "claude", "type": "execution", "id": "c787a3d8-b091-4967-80ff-d8d644d46858"}, {"a": "claude", "type": "review", "id": "0896ef6a-f1fe-413a-9c27-4d803f0f9120"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_5086tzts48n7pnc4q77g7bk9e_e
title: "Grouping core: max rendered-nesting-depth cap in deriveFolderGroups"
status: closed
deps: [nid_yyugpoh3gv8ip24cizvgrs4w4_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e]
created_iso: 2026-08-15T05:28:15Z
status_updated_iso: 2026-08-15T05:36:36Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 1/4 of plan nid_yyugpoh3gv8ip24cizvgrs4w4_e (closed plan ticket - READ IT FIRST; decisions signed off by human).

Add a maxGroupNestingDepth parameter (pure, no setting yet) to deriveFolderGroups in src/view/folderGrouping.ts.

SEMANTICS (signed off): depth counts RENDERED group-nesting levels, i.e. visible boxes - a collapsed single-child chain (one box labeled A/B/C) counts as ONE level. Implementation shape: build the group tree exactly as today (qualify -> assign members -> collapse chains -> effectiveParentOf), then a post-pass merges every surviving group whose rendered depth exceeds N into its depth-N ancestor group: its memberPaths fall up into that ancestor, the deep group disappears, groupFolderByMemberPath / nearestRenderedAncestorGroupOf / lowestCommonAncestorContainerOf / projectOntoContainerChildOf all reflect the merged tree. N=0 means NO groups at all (empty groups list; every note renders flat). Callers pass unlimited for now (thread the real setting in the follow-up ticket).

CRITICAL invariant (human-added in Q1 sign-off): when boxes disappear at lower depths, relationships previously collapsed into group-boundary arrows must resurface as individual note-to-note edges. Edge collapse in elkMapping/flowMapping derives from this grouping result, so this falls out of a correct merged tree - but ASSERT it at this layer: LCA/projection lookups for two notes whose old LCA group was merged away must now return the shallower container (or null at N=0).

Keep the function pure and deterministic (see the CONTRACT comment at deriveFolderGroups: called independently by elkMapping and flowMapping for the same graph). Preserve existing behavior exactly when N >= actual tree depth.

## Acceptance Criteria

- deriveFolderGroups accepts a depth cap; existing callers compile passing the unlimited value.
- BDD unit tests in src/view/folderGrouping.test.ts (colocated, WHEN/THEN, one behavior per test) cover: N=0 -> no groups, flat; N=1 -> only top-level boxes, deep members fall up; collapsed chain counts as one level; N >= tree depth -> byte-identical result to today; LCA/projection lookups reflect the merged tree (collapsed relationships resurface).
- npm test and npm run check green.

## Resolution (2026-08-15, commit 2d98275)

Implemented exactly per the signed-off Q1 shape:

- `deriveFolderGroups(nodes, maxGroupNestingDepth)` in `src/view/folderGrouping.ts`
  now takes a REQUIRED second parameter. New exported constant
  `UNLIMITED_GROUP_NESTING_DEPTH` (= `Number.POSITIVE_INFINITY`) is what all
  three call sites (`elkMapping.ts`, `flowMapping.ts`, `layoutFit.ts`) pass
  until the setting ticket (nid_5vz7mtm2rn6n7nj9cp5mfbslx_e) threads the real
  value.
- Implementation: the full tree is built exactly as before (qualify -> assign ->
  collapse chains -> effectiveParentOf) into `fullTreeGroups`; a post-pass then
  (1) memoizes rendered depth by walking `parentFolder` TREE edges (so a
  collapsed chain box counts as ONE level), (2) maps each too-deep group to its
  depth-cap ancestor via `cappedAncestorFolderOf` (null only at cap 0),
  (3) rebuilds member lists by iterating `nodes` in graph order (merged lists
  stay deterministic and node-ordered; the assignment loop now also records
  `assignedFolderByNotePath` so nothing is re-derived), and (4) filters
  `groups` to depth <= cap. A surviving group's parent always survives
  (parent depth = depth - 1), so `parentFolder`/`chainPath` need no rewrite.
  All lookup seams (`groupFolderByMemberPath`, `nearestRenderedAncestorGroupOf`,
  `lowestCommonAncestorContainerOf`, `projectOntoContainerChildOf`) are built
  from the capped groups, so the merged tree falls through them unchanged.
- The CRITICAL invariant is asserted at this layer in the new test suites:
  at N=1 the LCA of two A/B/C notes moves from A/B/C to A; at N=0 it is null;
  projection inside the survivor returns null (true-note endpoint) — i.e.
  previously collapsed relationships resurface as note-to-note edges.
- Tests: 22 new BDD tests in `src/view/folderGrouping.test.ts` (cap 0 / cap 1 /
  rendered-level counting incl. mid-chain collapse / cap >= depth identity /
  partial-cap member+LCA behavior); existing 33 call sites updated to pass
  UNLIMITED explicitly. N >= depth equality is asserted structurally
  (`toEqual` against the unlimited result).
- Verified: `npm run check` green, `npm test` green (2151 passed), and
  `npm run test:e2e -- vicinityGraph.e2e.ts` green (27 passed) confirming no
  rendered-behavior change with the unlimited value threaded through.


## Notes

**2026-08-15T05:38:45Z**

__READY_AS_IS__: implementation and 22 new BDD tests verified correct; only fix was stale interface docs (memberPaths/groupFolderByMemberPath said 'nearest qualifying ancestor', wrong under a cap); check + npm test green (2151 passed).
