---
id: nid_o5hz7ilcauwe2acqdfh6pcuam_e
title: "decide: node sizing rethink Q1-Q5"
status: open
deps: []
links: [nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e]
created_iso: 2026-08-03T23:48:12Z
status_updated_iso: 2026-08-03T23:48:12Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [decide, sizing]
---

Human decisions needed before implementing the node-sizing rethink (origin ticket nid_kyowb4v8v51nslbicl4szgcd5_e).

Read docs-internal/plan/node-sizing-rethink.md (sections 4-5) and .ai_out/_current_decision/current_decision.md for the five questions:
- Q1: default size driver — (a) keep/extend metric dials vs (b) size-to-fit rendered content clamped by dials (recommended).
- Q2: centrals/pinned stop bypassing metrics; prominence FLOOR (~0.35 score) instead of forced maxPx.
- Q3: may a manual per-node resize exceed global maxPx / undercut minPx? (recommended: yes)
- Q4: manual resize moves pixels only, never the truncation-ranking score. (confirm)
- Q5: silent frontmatter id assignment on first override save (pin parity) vs confirmation prompt.

Record answers in this ticket body and update docs-internal/plan/node-sizing-rethink.md accordingly, then close. The four implementation tickets depend on this one.

