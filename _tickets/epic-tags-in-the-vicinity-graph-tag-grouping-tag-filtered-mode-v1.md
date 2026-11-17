---
closed_iso: 2026-11-17T22:14:29Z
id: nid_xhed75cwiy0ui4fokv6l02cxf_e
title: "Epic: tags in the vicinity graph (tag grouping + tag-filtered mode) V1"
status: closed
deps: [nid_44yk50pp4xl9yexnoufqsiytj_e, nid_mr42m1k8cmyeusemmvmxuuaxb_e, nid_86c83wvlt5tbfs6s9ttr8r7mq_e, nid_aimlia0wjp0ms0uzd4fvhbomo_e, nid_lmftfz11vvfwj382i4xmmoqgf_e, nid_6qj8n7uc7zz126l3ix8czfymq_e, nid_w3rln1820v65xtdu2tvxs12ky_e, nid_mf28gwba8b6aihah05jtjj34z_e]
links: []
created_iso: 2026-11-17T20:32:44Z
status_updated_iso: 2026-11-17T22:14:29Z
type: epic
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
---

## Goal
Tags become first-class in the vicinity graph (owner request 2026-11-17):
1. **Group by tags** instead of folders — a top-right Folders | Tags toggle, a reasoned grouping algorithm, colour-coded tag boxes (preset colours for common tags like `todo`/`follow-up` orange, `critical` red), leftover tags as chips on notes.
2. **Tag-filtered mode** — show every note with a tag (not link neighbours), reached by right-clicking a tag / a command / clicking a tag in the graph, with a bottom-right status pill naming the current mode.
Plus README highlight and long-term e2e coverage.

V1 product decisions (agent-made, for owner review): `_agent_decisions/needs_review/tags-v1-product-decisions.md`.

## Plan (tasks, in dependency order)
- `nid_44yk50pp4xl9yexnoufqsiytj_e` refactor: mode-agnostic grouping model (no behavior change)
- `nid_mr42m1k8cmyeusemmvmxuuaxb_e` tag facts reach the engine (parallel with the refactor)
- `nid_86c83wvlt5tbfs6s9ttr8r7mq_e` tag grouping algorithm + colours (pure)
- `nid_aimlia0wjp0ms0uzd4fvhbomo_e` tag-filtered mode + status pill (parallel with the grouping work)
- `nid_lmftfz11vvfwj382i4xmmoqgf_e` grouping-mode setting, top-right toggle, tag boxes/chips
- `nid_6qj8n7uc7zz126l3ix8czfymq_e` entry points (right-click, command, in-graph click) + filter-tag exclusion
- `nid_w3rln1820v65xtdu2tvxs12ky_e` README + docs + full gate

## Done criteria
- All tasks closed; `npm run test:all` green on the integration branch; README highlights both features.

## Non-goals (V1)
- User-assignable tag colours, folder colours, multi-tag/boolean filters, per-view settings, hijacking left-click on tags.
