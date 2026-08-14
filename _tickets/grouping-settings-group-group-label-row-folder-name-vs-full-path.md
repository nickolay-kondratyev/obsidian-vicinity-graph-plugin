---
closed_iso: 2026-08-14T01:46:54Z
session_ids: [{"a": "claude", "type": "execution", "id": "311ed0cc-419b-4c30-af2c-462145bac30f"}, {"a": "claude", "type": "review", "id": "64026cf1-79a8-4715-843e-7c0f152f7678"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_0nmhmv03071derz5ok30cisaa_e
title: "Grouping settings group: group-label row (folder name vs full path)"
status: closed
deps: [nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T01:46:54Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Signed-off decision A1: DEFAULT is Folder name.

New settings group "Grouping" with ONE row choosing the group label style for collapsed chains: Folder name (leaf only, DEFAULT) vs Full path (collapsed chain like A/B/C). Non-collapsed groups show their folder name under either option. Model as a BOOLEAN spec leaf (e.g. groupLabelFullPath, DefaultSpec<boolean> like showCrossLinks, default false). NOTE (corrected 2026-08-14): there is NO reusable generic toggle control kind - control kinds in src/view/settingsRows.ts are 1:1 with SettingsInteraction arms, so this row gets its OWN new kind (e.g. "group-label-full-path"); copy the boolean-pill presenter pattern of "show-cross-links" / "exclusion-enabled" and let the compile-error-closed switches guide both presenters. Do not shoehorn the field into an existing kind and do not invent an enum control kind for this.

Wiring per repo conventions (all enforced by tripwires): spec leaf in src/engine/SettingsSpec.ts; declared row in src/view/settingsRows.ts (SETTINGS_GROUPS - new "Grouping" group; never hand-type labels in presenters); value accessor in src/view/settingsRowAccessors.ts; default recorded in src/engine/settingsProductDefaults.test.ts (the ONE defaults file); tab + panel presenters via their control-kind switches (compile errors guide); parity + spec-coverage scans must pass. Label rendering itself lands in the flow-rendering ticket - this ticket threads the setting through ViewSettings to FolderGroupNode.

The settings TAB has no npm-test coverage - run the e2e specs touching settings before calling done.

---

## Resolution (2026-08-14)

Done. New global boolean `groupLabelFullPath` (DefaultSpec<boolean>, default
`false`) threaded end-to-end through the settings family, modelled on
`showCrossLinks` / `exclusion-enabled`. Its own new control kind
`group-label-full-path` (1:1 with the interaction arm, per the corrected note) —
NOT shoehorned into an existing kind, no enum kind invented. Rendered as a
boolean `ToggleRow` (the same shape show-cross-links uses) on both surfaces.

New settings section **"Grouping"** (section id `grouping`), placed after
`node-contents`. One row today: label **"Full folder path"**.

Files touched (all tripwire-enforced wiring):
- `src/engine/SettingsSpec.ts` — `ViewSpec.groupLabelFullPath` + spec leaf (default false).
- `src/engine/types.ts` — `ViewSettings.groupLabelFullPath`.
- `src/engine/constants.ts` — `EngineDefaults.viewSettings()` reads the spec default.
- `src/persistence/persistedShapes.ts` — boolean-or-undefined parse (no version bump, matches showCrossLinks).
- `src/view/settingsWritePlan.ts` — `global-group-label-full-path` interaction + merge case.
- `src/view/settingsRowAccessors.ts` — `SettingsRowAccessors.groupLabelFullPath()`.
- `src/view/settingsRows.ts` — new control kind in the array + union arm + new `grouping` group in `SETTINGS_GROUPS`.
- `src/view/settingsSectionFields.ts` — `grouping` in `SETTINGS_SECTIONS` + `SECTION_SETTINGS_FIELDS` (view: `["groupLabelFullPath"]`).
- `src/view/settingsResetPlan.ts` — `grouping` reset scope + updated all-scope enumeration.
- `src/view/SettingsRowView.tsx` (panel) + `src/view/VicinityGraphSettingTab.ts` (tab) — presenter switch arms.
- `src/view/settingsWriteFailureNotice.ts` — both switches (interaction→control, control→key).
- Tests: `settingsProductDefaults.test.ts` (default), `settingsRowSpecCoverage.test.ts`,
  `settingsRowAccessors.test.ts`, `settingsWriteFailureNotice.test.ts`,
  `settingsSectionFields.test.ts`, `persistedShapes.test.ts`, `graphFixtures.ts`.
- `e2e/*` submodule (committed first): `settingsBaseline.ts` (ancestor flag),
  `settingsBaseline.test.ts` (section reset names list).
- `README.md` — Grouping section entry.

**Scope boundary honoured:** this ticket only THREADS the setting. The label
rendering that consumes it is a separate flow-rendering ticket. The field
reaches `flowMapping.ts` via `graph.viewSettings`; `flowMapping` already carries
a comment saying the collapsed-chain label (`group.chainPath`) presenter wiring
is that separate ticket, so nothing new consumes `groupLabelFullPath` yet and no
unused prop was added to `FolderGroupNode`.

Verification: `npm run check` clean (0 errors), `npm test` 2016 passed, and the
settings e2e specs (`settingsUxVisual`, `settingsResetVerify`,
`settingsResetReview`) all green — 37 passed, including the "every section card"
/ "scoped restore row" / "panel top-level disclosures" assertions that now cover
the Grouping section.

