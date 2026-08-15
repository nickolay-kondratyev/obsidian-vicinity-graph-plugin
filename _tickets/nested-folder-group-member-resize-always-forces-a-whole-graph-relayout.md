---
closed_iso: 2026-08-15T01:56:39Z
session_ids: [{"a": "claude", "type": "execution", "id": "dd918f48-e948-421c-8397-5a65b2302ba6"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_vjezt4ewmn50r0mbwjdfn70i2_e
title: "Nested folder-group member resize always forces a whole-graph relayout"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:42:11Z
status_updated_iso: 2026-08-15T01:56:39Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, layout]
---

ROOT CAUSE: src/view/layoutFit.ts:119-123 — resizedNodesFitRenderedLayout's foreign-group loop treats the resized node's own ANCESTOR groups as foreign boxes (`otherFolder !== folder && overlaps(...)`). Folder groups nest to arbitrary depth (src/view/folderGrouping.ts, plan D2), and a nested group's member always sits inside every ancestor group's box, so the function returns false unconditionally for nested-group members — every such resize triggers the whole-graph relayout that ticket nid_9ep12hkmk4zjv2p28emmrhieq_e existed to remove.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/view/layoutFit.test.ts, describe "resizedNodesFitRenderedLayout with NESTED folder groups", test "WHEN a nested group's member resizes with room to spare THEN it fits".

FIX SHAPE: skip ANCESTOR groups of the node's own group in the foreign-box loop (walk parentFolder chain from FolderGroup, or use nearestRenderedAncestorGroupOf); an ancestor's CONTAINMENT is already what the containsRect check should assert — consider requiring the rect to stay inside its own group only, and treating strict ancestors as containers, not colliders.

## RESOLUTION (2026-08-15, commit 3921383)

Fixed in `src/view/layoutFit.ts`. New private helper `containerGroupFoldersOf(grouping, memberPath)` walks the rendered `parentFolder` chain (via `nearestRenderedAncestorGroupOf`, per folderGrouping's DRY seam) and returns the folders of the node's own group plus every ancestor group; empty for an ungrouped node. `resizedNodesFitRenderedLayout` now:

- requires `containsRect` against EVERY container in that chain (own group first) — strict ancestors became containers, subsuming the old single own-group containment check;
- skips the whole chain in the foreign-group overlap loop, so ancestor boxes no longer answer "no fit" unconditionally.

Note: sibling/child group boxes (e.g. `A/B` for a member of `A`) are NOT in the chain and still collide — intended.

Acceptance test unskipped in `src/view/layoutFit.test.ts` (nested `A` ⊃ `A/B` fixture), plus a new test pinning that a nested member spilling outside its OWN group (while inside the ancestor) still refuses the fit. Verified: `npm run check`, full `npm test` (2094 passing), and e2e `nodeResize.e2e.ts` + `nestedGrouping.e2e.ts` (25 passed) on the pinned build.

