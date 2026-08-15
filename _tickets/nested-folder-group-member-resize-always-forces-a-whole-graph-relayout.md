---
id: nid_vjezt4ewmn50r0mbwjdfn70i2_e
title: "Nested folder-group member resize always forces a whole-graph relayout"
status: open
deps: []
links: []
created_iso: 2026-08-15T00:42:11Z
status_updated_iso: 2026-08-15T00:42:11Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, layout]
---

ROOT CAUSE: src/view/layoutFit.ts:119-123 — resizedNodesFitRenderedLayout's foreign-group loop treats the resized node's own ANCESTOR groups as foreign boxes (`otherFolder !== folder && overlaps(...)`). Folder groups nest to arbitrary depth (src/view/folderGrouping.ts, plan D2), and a nested group's member always sits inside every ancestor group's box, so the function returns false unconditionally for nested-group members — every such resize triggers the whole-graph relayout that ticket nid_9ep12hkmk4zjv2p28emmrhieq_e existed to remove.

FAILING TEST (committed, it.fails — flip to it as acceptance): src/view/layoutFit.test.ts, describe "resizedNodesFitRenderedLayout with NESTED folder groups", test "WHEN a nested group's member resizes with room to spare THEN it fits".

FIX SHAPE: skip ANCESTOR groups of the node's own group in the foreign-box loop (walk parentFolder chain from FolderGroup, or use nearestRenderedAncestorGroupOf); an ancestor's CONTAINMENT is already what the containsRect check should assert — consider requiring the rect to stay inside its own group only, and treating strict ancestors as containers, not colliders.

