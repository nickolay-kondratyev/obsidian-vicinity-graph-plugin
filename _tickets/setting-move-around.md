---
closed_iso: 2026-08-15T16:00:35Z
session_ids: [{"a": "claude", "type": "execution", "id": "b20e2a83-d78c-442d-8eb9-f8abb37dc4f7"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_rndi5sulwrsx1aq0x4xqcskrb_e
title: "setting move around"
status: closed
deps: []
links: []
created_iso: 2026-08-15T15:33:20Z
status_updated_iso: 2026-08-15T16:00:35Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---


Move 'Edge depth into groups' from 'Grouping' to be under 'Edges'

Swap 'Edges' and 'Grouping' places so that 'Grouping' comes right after 'Depth' in graph controls and settings.

Decrease the grouping max slider to 0-10, INFINITY so last value in the slider would be the infinity sign and we start with infinity sign as default. - Store it in full experession of this no hacks. 

---

## Done (commit 8539dac)

All three parts landed, both settings surfaces (tab + in-graph panel) in lockstep.

**Part 1 — 'Edge depth into groups' moved to Edges.** Row relocated from the
Grouping group to the Edges group in the ONE declared model
(`src/view/settingsRows.ts`) and its field list in
`src/view/settingsSectionFields.ts`. It keeps its `disabledWhen:
"folder-grouping-on"` dependency, so it still greys out when grouping is off.

**Part 2 — Grouping now follows Depth, before Edges.** Order swapped in
`SETTINGS_SECTIONS` (`settingsSectionFields.ts`), the single source both
presenters and the derived e2e disclosure-order check read.

**Part 3 — ∞-terminated grouping slider, default ∞, stored in full.**
- Spec (`src/engine/SettingsSpec.ts`): `folderGroupingDepth` default =
  `Number.POSITIVE_INFINITY`, finite bounds `0..10`.
- `FolderGroupingDepthSlider` (`src/view/settingsRowAccessors.ts`) owns the
  depth↔track-position mapping: track `0..11`, top stop renders `∞`. Rendered
  identically by tab (`VicinityGraphSettingTab.addGroupingDepthSlider`) and
  panel (`SettingsRowView` via a `SliderScale`).
- Stored genuinely as `Number.POSITIVE_INFINITY` — NO sentinel number. Because
  JSON cannot represent Infinity, it is encoded at the persistence boundary as
  the explicit `"Infinity"` string token (`encode/decodeFolderGroupingDepth` in
  `persistedShapes.ts`, applied in `PluginDataStore.persist`). Symmetric decode
  on load; garbage/omitted → default ∞.
- `clampFolderGroupingDepth` passes ∞ through untouched; large FINITE values
  still clamp to the finite max (10). `deriveFolderGroups` already treated ∞ as
  unlimited nesting.

**Verification.** `npm test` (2200 passed / 1 skipped) and `npm run check`
green. Targeted e2e green: `folderGroupingDepth.e2e.ts` (9),
`settingsDependentRows.e2e.ts` + `settingsUxVisual.e2e.ts` (24) — the
view-layer/settings-row gate CLAUDE.md requires.