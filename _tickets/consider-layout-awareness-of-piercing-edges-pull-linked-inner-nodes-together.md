---
session_ids: [{"a": "claude", "type": "decision", "id": "c1d4e7bf-953b-43e5-991d-b47f862b9a45"}]
id: nid_my99vi73iouq1y9hkomoedqgd_e
title: "Consider layout awareness of piercing edges (pull linked inner nodes together)"
status: open
deps: [nid_dwoixmdm1h59cw3bc2f6noejv_e]
links: []
created_iso: 2026-08-14T23:39:17Z
status_updated_iso: 2026-08-14T23:39:17Z
type: task
priority: 4
assignee: nickolaykondratyev
tags: [decide]
---

Future consideration recorded per human decision D2 on plan ticket nid_6fkhyw97hjs84xb62z6tommhi_e ("Edge depth into groups" / piercing edges): the feature is RENDER-ONLY - elk/d3 layout keeps consuming the depth-0 collapsed edge projection (src/view/elkMapping.ts attachEdgesToContainers), so two cross-group linked INNER notes are not pulled closer together by their piercing edge.

DECIDE (human): is the layout pull-in worth the complexity? Doing it likely means elk hierarchical edge handling (INCLUDE_CHILDREN) or a d3 force term fed by deep edges - both materially more complex than the render-only path, which is why it was deferred (80/20).

Prereq context: plan ticket nid_6fkhyw97hjs84xb62z6tommhi_e and the two implementation tickets it names must be done first.

