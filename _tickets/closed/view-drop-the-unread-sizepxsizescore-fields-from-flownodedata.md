---
closed_iso: 2026-08-06T22:43:55Z
id: nid_y8axtvcum3wvljzv3d3p8cwd1_e
title: 'view: drop the unread sizePx/sizeScore fields from FlowNodeData'
status: closed
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e]
created_iso: '2026-08-04T15:55:16Z'
status_updated_iso: 2026-08-06T22:43:55Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
`FlowNodeData` (src/view/flowMapping.ts) carries `sizePx` and `sizeScore` onto every rendered note node, but NO view module reads either one — the rendered box comes from the node's explicit React Flow `width`/`height` (`nodeDimensionsPx` in src/view/graphIdentity.ts) and content density is decided by CSS container queries in src/view/graph-view.css. `grep -rn "data.sizePx\|sizeScore" src/view` finds only the definition, the assignment in `toFlowNodeData`, and test fixtures.

Found during the adversarial review of the drag-to-resize commit (ticket nid_qjsj5mth2phdqctbm0vfx9elw_e); pre-existing, so it was NOT patched there.

WHY it matters: an unread field on the node payload invites a future reader to size something off `sizePx` and silently disagree with the box actually rendered — which is exactly what a per-node size override makes wrong (an overridden node keeps its old engine `sizePx`).

## Acceptance Criteria

`sizePx` and `sizeScore` are gone from `FlowNodeData` and from every fixture that names them, or a comment on each states WHO reads it.
`npm test` and `npm run check` green.

## Resolution (2026-08-06)

Already resolved — no new code change needed. The `sizePx` and `sizeScore` fields
were dropped from `FlowNodeData` (the type) AND from `toFlowNodeData` (the
assignment) in commit `0b561e2` ("View: remove sizing-metric presenters, rows,
accessors; fixtures aligned"), landed as part of the same drag-to-resize line of
work referenced by the linked ticket `nid_qjsj5mth2phdqctbm0vfx9elw_e`.

Verification on the current branch:
- `grep -rn "data\.sizePx\|sizeScore" src/ e2e/` → no matches. `sizeScore` is gone
  from the entire repo.
- `src/view/flowMapping.ts` `FlowNodeData` no longer declares either field, and
  `toFlowNodeData` no longer assigns them.
- The remaining `sizePx` occurrences in `src/view/` are all the ENGINE
  `GraphNode.sizePx` field (and `override.sizePx` / `NodeSizeOverridePx`) — a
  legitimately-read field consumed by `nodeDimensionsPx` in
  `src/view/graphIdentity.ts` and by `makeNode` test fixtures — NOT the removed
  `FlowNodeData` payload fields this ticket targeted.
- `npm run check` green (CHECK_EXIT=0); `npm test` green (TEST_EXIT=0).
