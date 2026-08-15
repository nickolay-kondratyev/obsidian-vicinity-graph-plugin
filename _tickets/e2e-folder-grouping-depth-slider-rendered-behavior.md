---
session_ids: [{"a": "claude", "type": "execution", "id": "06afc08b-96ac-48b5-a289-8d693defe76e"}, {"a": "claude", "type": "review", "id": "ade619ba-0990-41c8-89b1-3305b7f79d4d"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ovayqcmi0vlmzyju40tdxw3sd_e
title: "e2e: folder grouping depth slider rendered behavior"
status: in_progress
deps: [nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5086tzts48n7pnc4q77g7bk9e_e, nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e]
created_iso: 2026-08-15T05:28:55Z
status_updated_iso: 2026-08-15T07:01:39Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 4/4 of plan nid_yyugpoh3gv8ip24cizvgrs4w4_e (closed plan ticket - READ IT FIRST). Depends on slider ticket nid_5vz7mtm2rn6n7nj9cp5mfbslx_e and dependent-rows ticket nid_dqu2jc1kln9ltwzy3lxxocdw7_e (deps ordering also avoids e2e-spec merge conflicts).

Add real-Obsidian Playwright e2e coverage (e2e/ submodule - commit there FIRST, see CLAUDE.md Extra Notes) for the rendered behavior of the "Folder grouping depth" slider, against a vault fixture with >= 3 levels of nested folders:
- default 20: nested group boxes render as today;
- an intermediate depth (e.g. 1): only that many rendered levels; deeper notes fall up into the level-1 box;
- depth 0: NO group boxes, flat canvas, AND the relationships previously collapsed into group-boundary arrows are visible again as individual note-to-note edges (human-added Q1 requirement - assert edge count/endpoints, not just box absence);
- the description copy is present (tab row description / panel title tooltip).

Use existing e2e patterns: settle any settings write through e2e/settingsWriteWindow.ts (SettingsWriteWindow) - never a sleep. npm run test:e2e is self-provisioning on Linux.

## Acceptance Criteria

- New/extended spec in e2e/ covering the four behaviors above, green under npm run test:e2e.
- No sleeps; writes settled via SettingsWriteWindow.
- e2e submodule committed before this repo.


## Notes

**2026-08-15T07:16:09Z**

__READY_AS_IS__: review found no defects; check, npm test, and the new folderGroupingDepth e2e spec (9/9) all pass; no changes made
