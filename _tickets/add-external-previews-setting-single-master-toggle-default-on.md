---
closed_iso: 2026-08-07T17:20:17Z
id: nid_21xio7iwxv742ze4qc4p4qbmq_e
title: Add external-previews setting (single master toggle, default ON)
status: closed
deps: []
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_tvtm9gj5zaj4tbfbpti3v6sy2_e, nid_15r71ajjkbel5s704kmj6wszw_e]
created_iso: '2026-08-07T15:49:26Z'
status_updated_iso: 2026-08-07T17:20:17Z
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, settings]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Add ONE global boolean setting that gates ALL external content previews in graph nodes (first use: the leading YouTube hero video; later: external images / other providers). KISS: one switch, not per-type.

DEFAULT: ON — the feature should shine out of the box. User can turn it OFF, which stops ALL external requests.

HONEST DISCLOSURE (required, this is the whole point of the toggle): the plugin description AND the setting help text must state plainly that it loads external content referenced in notes and therefore contacts third-party servers (e.g. YouTube/Google), and that turning it OFF stops all such requests. On-by-default is acceptable in Obsidian ONLY if disclosed; do not hide it.

WIRE THROUGH THE ONE SETTINGS PIPELINE (see CLAUDE.md "Settings" sections):
- Add the spec leaf + literal default in src/engine/settingsProductDefaults.test.ts (the single source of shipped defaults).
- Declare the row in src/view/settingsRows.ts (SETTINGS_GROUPS).
- Add the accessor in src/view/settingsRowAccessors.ts.
- Both presenters (settings tab + in-graph panel) render it via their switch; let the compile errors guide you.
- Structural tests over SETTINGS_SPEC will FAIL until the leaf is wired (parse/round-trip/reset/bounds).

TESTS: e2e coverage for the toggle (settings tab has no npm-test coverage; per CLAUDE.md run npm run test:e2e for settings rows). Settle the write via e2e/settingsWriteWindow.ts, never a sleep.

Context / decisions: see _tickets/add-procesing-for-external-url-in-the-graph.md (D4 resolution).


## Notes

**2026-08-07T16:05:02Z**

ADD (2026-08-07): README disclosure is part of THIS ticket.
Update README.md to state that external previews (starting with YouTube hero
videos) load external content and therefore contact third-party servers (e.g.
YouTube/Google), that this is ON by default, and how to turn it OFF via this
setting. Keep it honest and user-facing — same message as the in-app setting help
text, DRY the wording.

**2026-08-07T17:04:36Z**

ADD (2026-08-07): this toggle now also gates FUTURE actual network fetches (thumbnails/favicons for URL nodes), not just embed/poster URLs — the enforcement mechanism is the single external-content seam ticket (nid_tvtm9gj5zaj4tbfbpti3v6sy2_e), which deps this one. Keep the disclosure wording general enough to cover fetched preview data, not only YouTube.

## Resolution (2026-08-07)

DONE. Added ONE global boolean setting `externalPreviews` (default **ON**), gating all
external-content previews. Wired through the single settings pipeline; no enforcement seam
yet (that is the dep ticket nid_tvtm9gj5zaj4tbfbpti3v6sy2_e) — this is the setting it will
consult.

Data model + pipeline:
- `src/engine/types.ts` — `ViewSettings.externalPreviews: boolean` (privacy gate, doc'd).
- `src/engine/SettingsSpec.ts` — spec leaf `globalView.externalPreviews` `{ default: true }`,
  with the on-by-default rationale.
- `src/engine/constants.ts` — `EngineDefaults.viewSettings()` projects it.
- `src/engine/settingsProductDefaults.test.ts` — literal default pinned `true` (single
  source of shipped defaults).
- `src/persistence/persistedShapes.ts` — `parseViewFields` parses it (non-boolean → spec
  default; additive, NO version bump).
- `src/view/settingsWritePlan.ts` — `global-external-previews` interaction + merge.
- `src/view/settingsRowAccessors.ts` — `SettingsRowAccessors.externalPreviews()`.
- `src/view/settingsRows.ts` — new control kind `external-previews`; its OWN section
  **"External content"** (a privacy/network concern, not a layout knob), with the honest
  disclosure as the row description (`EXTERNAL_PREVIEWS_ROW_DESCRIPTION`, the DRY source).
- `src/view/settingsSectionFields.ts` — `external-content` section + `["externalPreviews"]`.
- `src/view/settingsResetPlan.ts` — `external-content` reset scope; ALL-scope enumeration
  extended to name it.
- Both presenters render it via their switch (`SettingsRowView.tsx` toggle row,
  `VicinityGraphSettingTab.ts` `addToggleRow`).

Disclosure (the whole point — stated in three places, same message):
- Settings row description (in-app help text).
- `README.md` — new "External content → Load external previews" bullet + section list.
- `manifest.json` — plugin description now discloses external content / third-party
  servers / on-by-default / switchable off (kept ≤250 chars for Obsidian guidelines).

Tests: all structural SETTINGS_SPEC suites now cover the leaf (parse/round-trip/reset/
bounds) and pass. New e2e `e2e/externalPreviewsSetting.e2e.ts` (real Obsidian, since the
settings tab has no npm-test coverage): asserts ships-ON, disclosure copy reaches the DOM
(verbatim from the declared row), and off/on flips PERSIST (web-first poll on the live
store — no sleep). `npm run check` + `npm test` (1720) green; ran the touched-surface e2e
specs (externalPreviewsSetting, settingsUxVisual, settingsReset{Verify,Review},
settingsDependentRows) — all green.
