---
id: nid_x6l6x07rd1d1h4cefqmnyrbec_e
title: "Settings tab: debounce numeric/text writes and validate bounds"
status: open
deps: []
links: []
created_iso: 2026-07-24T21:44:09Z
status_updated_iso: 2026-07-24T21:44:09Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, ux]
---

Deferred from the settings restore-defaults round (branch `settings`, see .ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md).

Every number/text/textarea field in src/view/VicinityGraphSettingTab.ts (exclusion patterns, sizing weight/min/max/decay-k, node cap) writes settings and rebuilds the graph on EVERY keystroke. No debounce.

Also: sizing min/max px and depth-decay-k have only a lower bound - no upper bound and no cross-validation, so `maxPx < minPx` silently persists. And invalid regex patterns are silently ignored with no per-line feedback (overlaps the existing exclusion-debounce ticket).

## Acceptance Criteria

- Numeric/text settings debounce before persisting + rebuilding.
- maxPx < minPx is rejected with visible feedback rather than silently persisted.
- Upper bounds defined in SETTINGS_SPEC for sizing px and decay-k.
- Invalid regex lines surfaced to the user.
- BDD tests cover each.

