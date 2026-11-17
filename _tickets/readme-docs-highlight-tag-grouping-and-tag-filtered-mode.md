---
id: nid_w3rln1820v65xtdu2tvxs12ky_e
title: "README + docs: highlight tag grouping and tag-filtered mode"
status: in_progress
deps: [nid_6qj8n7uc7zz126l3ix8czfymq_e]
links: []
created_iso: 2026-11-17T20:32:45Z
status_updated_iso: 2026-11-17T21:50:48Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/.worktree/t-w3rln182
---

## Goal
The README highlights the two new tag features so users discover them (owner request), and the internal docs are consistent after the whole epic lands.

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`.

## Done criteria
- `README.md` gains a prominent "Tags" section (and a line in any feature summary near the top): group by tags vs folders (the top-right toggle, how boxes are chosen in one plain sentence, chips, colour presets), and the tag-filtered mode (right-click a tag / command / click a tag in the graph; the bottom-right status pill; how to exit).
- `docs-internal/plan/high-level-plan.md`, `docs-internal/architecture-map.md` and `CLAUDE.md` (only if a stable rule changed) agree with the shipped behavior; no stale "always-on folder grouping, no toggle" claims remain.
- Full gate on the epic tip: `npm run test:all` green (check → unit → full e2e); exact counts reported.
- Move `_agent_decisions/needs_review/tags-v1-product-decisions.md` content that is now stable into the plan doc; leave the needs_review file for the owner.

## Non-goals
- Screenshots in git (they go in `.out/` only), store listing changes, release cut.
