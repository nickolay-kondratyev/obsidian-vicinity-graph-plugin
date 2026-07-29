---
id: nid_armoson86j0ii8c33r1odo1rc_e
title: "Settings cleanup — dual presenters: settings tab and in-graph panel become two presenters of one descriptor model"
status: open
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
links: [nid_1rslube8at5xj60ji4jeve0b0_e, nid_qp56jugz8en8wkgjirwcb269p_e, nid_klkdpmx6axf90y4xj8khwrlf2_e, nid_que9qloigra7ku2boh83qizz0_e]
created_iso: 2026-07-29T17:29:52Z
status_updated_iso: 2026-07-29T17:29:52Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, ui, ux, a11y]
---

Overarching context, ordering rationale and standing owner decisions: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 4 of the chain).

Part of the settings cleanup approved by the owner on 2026-07-29. Depends on the descriptor model (nid_wimjq4ewgbg21n4zx9d4qq3a0_e) for rows-as-data, and on the write pipeline (nid_m5hxe4eo9jgt7cfic7s2o3uvi_e) so both presenters wire to the final write path once instead of being rewired after.

PROBLEM: VicinityGraphSettingTab.ts and the in-graph React sections are two INDEPENDENTLY hand-written renderers of the same settings model, so they drift. Every drift shows up as its own ticket:
- nid_klkdpmx6axf90y4xj8khwrlf2_e -- outlineMaxDepth has a tab row but NO panel control
- nid_1rslube8at5xj60ji4jeve0b0_e -- depth controls need regrouping/renaming under one "Depth" group, in BOTH surfaces
- nid_que9qloigra7ku2boh83qizz0_e -- panel a11y drift (SizingNumber aria-label, ForceLayout restore button) needs ONE stated labeling convention across both
- nid_qp56jugz8en8wkgjirwcb269p_e -- exclusion-patterns row hide-vs-disable (DECIDED: always render, disabled) becomes a declarative disabledWhen flag rather than hand-written branching

GOAL: one row-rendering CONTRACT driven by the E1 field descriptors, with the Obsidian tab and the React panel as two presenters over it. Grouping, labels, a11y naming, and disabledWhen become DATA, so parity is structural rather than remembered.

CONSTRAINT (do not fight this): Obsidian's Setting API cannot mount inside React, so there WILL be two renderer implementations. The win is that they render the same declared model, not that there is one renderer. A parity TEST over the descriptor list is the guard.

Carries the owner UX decision that exclusion patterns render always-but-disabled -- see that ticket for the full rationale and the three e2e specs that must be updated.


## Notes

**2026-07-29T19:31:12Z**

From the descriptor-model ticket (nid_wimjq4ewgbg21n4zx9d4qq3a0_e), a pointer for this ticket's row-copy table: NODE_PREVIEW_ROW_LABEL and NODE_PREVIEW_ROW_DESCRIPTION in src/view/nodePreviewPreferenceMeta.ts are row copy for a keyof ViewSettings field (nodePreviewPreference), so they belong in this ticket's row table — unlike NODE_PREVIEW_OPTION_META, which stays keyed by NodePreviewPreference and should NOT move. Recorded so this ticket finds them instead of re-authoring the strings. Also: the section->field map now lives at src/view/settingsSectionFields.ts (SECTION_SETTINGS_FIELDS); extend that shape (per-family key COLUMNS) rather than inventing a {family, key} row union.

**2026-07-29T22:11:13Z**

SCOPE CHANGE (owner, 2026-07-29): settings are GLOBAL-only before this ticket lands (nid_ez38gf1mrdgh5kxedzrdicwzl_e removes per-doc state, incl. per-pinned-central depth steppers in CentralDepthControls.tsx). The descriptor row model and both presenters therefore render GLOBAL rows only — no persistable/per-doc arms, no NOT_PERSISTABLE_NOTICE, no owned-layer pinned indicator on depth rows. Pins remain global and the Pinned centrals disclosure stays, but without per-central depth dials. Adjust any relevant specs/docs (README pinning section, high-level-plan) if this ticket touches them.
