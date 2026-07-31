---
closed_iso: 2026-07-30T05:03:39Z
id: nid_xy56b20jbvaedbl0610m3j2ls_e
title: "Settings: guard that every SETTINGS_SPEC leaf has a declared row (the last SILENT hand-maintained step)"
status: closed
deps: []
links: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
created_iso: 2026-07-30T04:45:38Z
status_updated_iso: 2026-07-30T05:03:38Z
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


## Notes

**2026-07-30T05:03:38Z**

DONE. src/view/settingsRowSpecCoverage.test.ts (tests only, no production change) walks the declared settings field leaves and fails naming any leaf that no row in SETTINGS_GROUPS edits. Row -> leaf join is specLeafIdFor(control), a switch closed by unhandledRowControl, so a new control kind is a compile error and a new field in an existing family needs no edit there. Companion tests: no stale mapping (every produced id still exists as a leaf), non-vacuous walk, no two rows per field.

Acceptance criteria:
1. VERIFIED BY ACTUALLY FAILING (twice, independently by implementer and reviewer): removing the 'Embeds out' row makes this suite -- and only this suite in the whole repo (1 failed | 1218 passed) -- fail with 'globalDepths.embedDepthOut: no row in SETTINGS_GROUPS edits it (no user can reach this setting)'.
2. npm test (92 files / 1217 tests) and npm run check green with the row present.
3. No leaf is intentionally row-less today, so the empty allowlist const was deliberately NOT shipped (PARETO/no-unused-code); the sanctioned escape hatch lives in the failure text, which instructs the maintainer to add the row or add an id-keyed allowlist with a reason plus its anti-rot tests, modelled on BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE. CLAUDE.md updated to match.

Commits d06961c, 9edf6a1. change_log nd3h3c3bo3n3zywa8erzdianb. No follow-ups needed.
