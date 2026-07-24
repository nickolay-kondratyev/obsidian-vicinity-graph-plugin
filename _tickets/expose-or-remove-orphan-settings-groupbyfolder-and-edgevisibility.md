---
id: nid_niz5dz6uqeyv237ckm15ittqa_e
title: "Expose or remove orphan settings groupByFolder and edgeVisibility"
status: open
deps: []
links: []
created_iso: 2026-07-24T21:44:19Z
status_updated_iso: 2026-07-24T21:44:19Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings]
---

`groupByFolder` and `edgeVisibility` are persisted ViewSettings fields with defaults in src/engine/SettingsSpec.ts:69-70 but have ZERO write UI: no settings-tab control, no in-graph control, and no SettingsInteraction case in src/view/settingsWritePlan.ts. They can never be changed by a user.

Decide: give them real controls, or delete the fields. Do not leave dead persisted state.

Context: .ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md

## Acceptance Criteria

- Either both settings are user-changeable through the UI and covered by tests, or the fields (and their persistence) are removed.

