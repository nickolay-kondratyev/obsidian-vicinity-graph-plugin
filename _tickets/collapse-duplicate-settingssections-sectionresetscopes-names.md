---
id: nid_llfhrqo1ecg8tuxigo7bcrrrf_e
title: "Collapse duplicate SETTINGS_SECTIONS / SECTION_RESET_SCOPES names"
status: open
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: []
created_iso: 2026-07-29T19:31:01Z
status_updated_iso: 2026-07-29T19:31:01Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings-cleanup]
---

After the descriptor-model ticket (`nid_wimjq4ewgbg21n4zx9d4qq3a0_e`) there are TWO exported names for one tuple and TWO for one union:

- `SETTINGS_SECTIONS` (`src/view/settingsSectionFields.ts`) and `SECTION_RESET_SCOPES` (`src/view/settingsResetPlan.ts`, now just a value alias of it)
- `SettingsSection` (`src/view/settingsSectionFields.ts`) and `SettingsResetScope` (`src/view/settingsResetPlan.ts`, now `SettingsSection | "all"`)

WHY the alias was kept rather than collapsed at the time: `e2e/settingsBaseline.ts` and `src/view/settingsResetPlan.test.ts` import `SECTION_RESET_SCOPES`, and preserving both the NAME and the tuple type is what kept that ticket's zero-test-edit proof intact. Editing the e2e harness and a behaviour-capturing test in the same change that refactors the code they check is exactly the coupling that proof exists to avoid.

Collapse once ticket 4 (dual presenters, `nid_armoson86j0ii8c33r1odo1rc_e`) moves the presenters and those imports are being touched anyway. Keep `SettingsResetScope` (it carries the extra `"all"` member); re-point `SECTION_RESET_SCOPES` consumers at `SETTINGS_SECTIONS`.

## Acceptance Criteria

- One exported tuple for the six sections and one union type for the six sections.
- `SettingsResetScope` still distinct (it adds "all").
- `npm test` and `npm run check` green; e2e imports updated in the same change.

