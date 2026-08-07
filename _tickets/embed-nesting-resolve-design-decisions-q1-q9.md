---
id: nid_e79vxubva52s9gq24idypb77x_e
title: "Embed nesting: resolve design decisions Q1-Q9"
status: open
deps: []
links: [nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_qy5rc7sq261z23bp79bk8wsem_e, nid_jbsbfqqxyy1brm26ul7873v5h_e, nid_14potmihi2tc0x421abf0awz6_e]
created_iso: 2026-08-07T01:52:59Z
status_updated_iso: 2026-08-07T01:52:59Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [decide, embed-nesting]
---

DECISION GATE for the embed-nesting feature (parent plan ticket nid_14potmihi2tc0x421abf0awz6_e, closed).

Human must review and resolve the 9 questions in .ai_out/_current_decision/current_decision.md (Q1-Q9: central==isMain; container tie-breaks; embed-cycle handling; folder-group interplay; container-child edges; losing-embedder edges; nesting computed post-truncation; v1 sizing/resize scope; global toggle). Each question carries a recommended default; the implementation tickets are written AGAINST those defaults.

RESOLUTION: record the accepted/changed answers in this ticket body (the .ai_out file is volatile), then update the dependent implementation tickets if any recommendation was overridden, then close.

## Acceptance Criteria

All 9 questions have a recorded answer in this ticket body; dependent tickets updated if any default was overridden.

