---
id: nid_9k11zke41l6ze3p7n7suuo4v2_e
title: "Settings tab: avoid full display() rebuild for dependent rows"
status: open
deps: []
links: []
created_iso: 2026-07-24T21:44:19Z
status_updated_iso: 2026-07-24T21:44:19Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, ux]
---

Deferred from the settings restore-defaults round (branch `settings`). Toggling exclusion-enabled or any sizing metric in src/view/VicinityGraphSettingTab.ts calls this.display(), tearing down and rebuilding all settings cards just to show/hide one dependent row. Causes scroll-position loss and focus loss.

Context: .ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md

## Acceptance Criteria

- Toggling a dependent row updates only that row.
- Scroll position and focus are preserved across the toggle.

