---
id: nid_5086tzts48n7pnc4q77g7bk9e_e
title: "Grouping core: max rendered-nesting-depth cap in deriveFolderGroups"
status: open
deps: [nid_yyugpoh3gv8ip24cizvgrs4w4_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e]
created_iso: 2026-08-15T05:28:15Z
status_updated_iso: 2026-08-15T05:28:15Z
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

