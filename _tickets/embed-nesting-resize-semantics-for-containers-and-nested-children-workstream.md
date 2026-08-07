---
id: nid_1av3d7fx1072oyp5lxyhjd451_e
title: "Embed nesting: resize semantics for containers and nested children (workstream)"
status: open
deps: []
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1ht2a3rm0ng8wnlis259u5egg_e]
created_iso: 2026-08-07T02:12:49Z
status_updated_iso: 2026-08-07T02:12:49Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Follow-up workstream from embed-nesting decision Q8 (ticket nid_e79vxubva52s9gq24idypb77x_e). V1 (ticket nid_qy5rc7sq261z23bp79bk8wsem_e) ships containers that auto-grow to fit children, with drag-resize DISABLED on containers and nested children and size overrides ignored while nested. This ticket designs+implements real resize semantics. Owner flagged this will likely be its own workstream — start with a PLAN pass.

DESIRED BEHAVIOR (owner vision, 2026-08-07):
- Resizing a CONTAINER gives the extra space primarily to the container's DIRECT content (its own title/outline/representative image), not to the nested children. Example: n1 embeds n2, n2 embeds n3 and n4; n1 renders its image plus the nested [n2[n3 n4]] stack — scaling n1 up grows the image region.
- Resizing a CHILD that gets pushed past the container's edge auto-UPSIZES the container (and the container chain above it).
- Scaling a container DOWN so it pushes on internal nodes scales the internal nodes down too.

TOUCHPOINTS (as of planning): src/view/nodeResize.ts (NODE_RESIZE_BOUNDS, resizeEndToOverride), src/view/NoteNode.tsx (NodeResizeControl wiring), src/view/graphIdentity.ts nodeDimensionsPx (override wins verbatim — will need container-aware sizing), per-node overrides in data.json via NodeOverrideChange + PluginDataStore, layout fit checks in src/view/layoutFit.ts + GraphStructureDiff.

OPEN QUESTIONS for the plan: what does a persisted size override MEAN for a node that is sometimes nested and sometimes standalone; how override interacts with auto-grow minimums; whether child scaling on container-downsize is persisted or purely visual.

## Acceptance Criteria

Plan produced and approved; then containers and nested children are resizable per the owner vision with persisted-override semantics defined and tested.

