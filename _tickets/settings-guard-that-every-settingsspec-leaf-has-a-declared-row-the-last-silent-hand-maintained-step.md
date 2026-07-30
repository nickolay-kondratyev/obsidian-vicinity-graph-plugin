---
id: nid_xy56b20jbvaedbl0610m3j2ls_e
title: "Settings: guard that every SETTINGS_SPEC leaf has a declared row (the last SILENT hand-maintained step)"
status: open
deps: []
links: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
created_iso: 2026-07-30T04:45:38Z
status_updated_iso: 2026-07-30T04:45:38Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, testing]
---

MEASURED FINDING from ticket nid_fay1hu5sxcoygizopkkg0f0d7_e (adding `embedDepthOut`, the first new settings field under the declarative descriptor model). Adding one field touched 6 production files; 4 of those 6 are COMPILE-FORCED (SETTINGS_SPEC via `_assertEverySettingsFieldSpecced`, `EngineDefaults.depthSettings` return type, `definedFieldsOnly<DepthSettings>` in src/persistence/persistedShapes.ts, SECTION_SETTINGS_FIELDS via `_assertEverySettingsFieldSectioned`) and the two hand-maintained TEST tables are LOUD (both src/engine/settingsProductDefaults.test.ts and src/engine/settingsSpecBounds.test.ts walk EVERY_SETTINGS_SPEC_LEAF and fail naming a missing leaf).

Exactly ONE step is still SILENT: declaring the ROW in `SETTINGS_GROUPS` (src/view/settingsRows.ts). A spec leaf that is specced, parsed, persisted and reset but never given a row COMPILES, ROUND-TRIPS and SHIPS as a setting no user can reach except by hand-editing data.json. Nothing catches it: src/view/settingsRowParity.test.ts walks the ROWS, so a missing row is simply a smaller walk that still passes.

Note the hole is one-directional and only this direction is open: a row naming a BOGUS field is already a compile error, because the row control carries `field: keyof DepthSettings` / `keyof ViewSettings`.

SHAPE OF THE FIX (~10 lines, a test, no production change): a suite that walks EVERY_SETTINGS_SPEC_LEAF (src/engine/testFixtures/settingsSpecLeaves.ts) and asserts each leaf id appears as some row `control.field` in SETTINGS_GROUPS (src/view/settingsRows.ts). Decide deliberately what to do with leaves that are intentionally row-less if any exist today — if so, use an explicit ALLOWLIST WITH A REASON STRING per entry, the same pattern as BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE in src/engine/settingsSpecBounds.test.ts, never a silent skip.

WHY IT MATTERS: this closes the settings model at "8 hand-maintained lists that fail silently -> 0". It is the single recommendation the measurement write-up made.

## Acceptance Criteria

- Deleting the "Embeds out" row from SETTINGS_GROUPS makes `npm test` FAIL with a message naming `globalDepths.embedDepthOut`.
- `npm test` and `npm run check` stay green with the row present.
- Any intentionally row-less leaf is allowlisted with a written reason, not skipped.

