---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_5hnmpwtzakhd3le95jzigsvs0_e
title: "Recursive grouping: e2e scenarios + docs update"
status: in_progress
deps: [nid_3wnxsfexabjnx1uj9js2o1c43_e, nid_0nmhmv03071derz5ok30cisaa_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T02:00:59Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Final gate ticket.

E2E (Playwright, e2e/ submodule - COMMIT there before committing here): add nested-group scenarios: (1) nested box renders inside parent box (multi-level vault fixture), (2) lone note in SQL/sub falls into SQL group, (3) boundary-crossing edge collapses onto boxes while same-container edge stays member-to-member, (4) +N badge on ancestor group for hidden descendant-folder notes, (5) group-label setting flips collapsed-chain label (settle writes via e2e/settingsWriteWindow.ts SettingsWriteWindow, never sleep). Keep the existing pattern of pointer-interaction fixtures staying ROOT-level (no groups intercepting pointer events).

Docs: update docs-internal/plan/high-level-plan.md (documents FLAT grouping as a core differentiator, ~lines 8 and 151) to describe recursive grouping + signed-off rules; update README.md grouping description if it mentions flat/immediate-parent grouping.

Gate: npm run test:all green.

