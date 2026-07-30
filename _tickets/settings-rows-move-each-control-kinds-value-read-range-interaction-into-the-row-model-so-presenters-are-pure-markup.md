---
id: nid_uppprbbqursr6awuoevoqpah1_e
title: "Settings rows: move each control kind's {value read, range, interaction} into the row model so presenters are pure markup"
status: open
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: []
created_iso: 2026-07-30T02:28:26Z
status_updated_iso: 2026-07-30T02:28:26Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, refactor, ui]
---

After nid_armoson86j0ii8c33r1odo1rc_e the two presenters share all COPY, order,
grouping and a11y naming, but each still re-derives, per control kind: the value read
(state.globalView.sizing[field]), the range-table lookup, the clamp, and the
SettingsInteraction to emit. None of that is presentation, and it is written twice -
src/view/VicinityGraphSettingTab.ts and src/view/SettingsRowView.tsx. Two step
constants are literally declared in both files (NODE_CAP_STEP,
OUTLINE_DEPTH_SLIDER_STEP).

Proposal: a per-kind accessor in the row model - {read(state), range, interaction(value)}
- leaving each presenter as markup plus one call. Design question to settle first:
src/view/settingsRows.ts is currently PURE DATA and is imported by the node-side e2e
process, so adding behaviour there needs a deliberate call about where the accessor
lives (same module vs. a sibling).

Reviewer of the dual-presenter ticket raised this as a follow-up, not a blocker.

