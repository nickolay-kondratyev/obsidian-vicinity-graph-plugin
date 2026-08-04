---
closed_iso: 2026-08-04T00:02:47Z
id: nid_o5hz7ilcauwe2acqdfh6pcuam_e
title: "decide: node sizing rethink Q1-Q5"
status: closed
deps: []
links: [nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e, nid_jcxzhexfaksge2arjzca3w7ff_e]
created_iso: 2026-08-03T23:48:12Z
status_updated_iso: 2026-08-04T00:02:47Z
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


## Notes

**2026-08-04T00:02:47Z**

Owner answers (2026-08-03):
- Q1: (b) size-to-fit rendered content, clamped by minPx/maxPx. FURTHER: remove the metric dials entirely (own-file-size, total-linker-size, backlink-count, outlink-count, depth-decay) — size reflects the usefulness of the content shown; a title-only node sizes to fit just its title.
- Q2: yes — modest prominence floor for centrals/pinned instead of forced maxPx.
- Q3: yes — manual per-node resize may exceed global maxPx / undercut minPx (hard sanity bounds only).
- Q4: confirmed — resize moves pixels only; truncation (whether to show the node at all) is unaffected.
- Q5: silent frontmatter id assignment when an id is needed to save; no confirmation prompt.
- NEW: add a "Title only" node content option (enum value like title-only) showing just the title — as a GLOBAL nodePreviewPreference option AND as a per-node override choice. Tracked in ticket nid (see links): settings ticket created for the global option; the per-node override ticket updated to include it.
