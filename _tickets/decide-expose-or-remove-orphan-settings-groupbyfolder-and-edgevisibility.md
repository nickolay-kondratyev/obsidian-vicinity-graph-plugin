---
id: nid_niz5dz6uqeyv237ckm15ittqa_e
title: "[decide] Expose or remove orphan settings groupByFolder and edgeVisibility"
status: open
deps: []
links: [nid_3k0a4zl6in0mj8lcjibkjq2dx_e, nid_abreq4lmpo8vnvf61y9k9yly0_e, nid_8p0nn2g34d97finokwlz3u1dt_e]
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


## Notes

**2026-07-26T15:30:39Z**

[decide] Product fork the human must resolve: ship real UI controls for groupByFolder + edgeVisibility, or delete the fields and their persistence. Materially different scope. Verified still open: both persist (src/engine/types.ts:307-308) and are read (src/engine/VicinityEngine.ts:92, src/view/flowMapping.ts:166) but have no interaction case in src/view/settingsWritePlan.ts:28-49 and no control anywhere.
