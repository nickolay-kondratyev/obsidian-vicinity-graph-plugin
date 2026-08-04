---
id: nid_y8axtvcum3wvljzv3d3p8cwd1_e
title: "view: drop the unread sizePx/sizeScore fields from FlowNodeData"
status: open
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e]
created_iso: 2026-08-04T15:55:16Z
status_updated_iso: 2026-08-04T15:55:16Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui]
---

`FlowNodeData` (src/view/flowMapping.ts) carries `sizePx` and `sizeScore` onto every rendered note node, but NO view module reads either one — the rendered box comes from the node's explicit React Flow `width`/`height` (`nodeDimensionsPx` in src/view/graphIdentity.ts) and content density is decided by CSS container queries in src/view/graph-view.css. `grep -rn "data.sizePx\|sizeScore" src/view` finds only the definition, the assignment in `toFlowNodeData`, and test fixtures.

Found during the adversarial review of the drag-to-resize commit (ticket nid_qjsj5mth2phdqctbm0vfx9elw_e); pre-existing, so it was NOT patched there.

WHY it matters: an unread field on the node payload invites a future reader to size something off `sizePx` and silently disagree with the box actually rendered — which is exactly what a per-node size override makes wrong (an overridden node keeps its old engine `sizePx`).

## Acceptance Criteria

`sizePx` and `sizeScore` are gone from `FlowNodeData` and from every fixture that names them, or a comment on each states WHO reads it.
`npm test` and `npm run check` green.

