---
closed_iso: 2026-07-30T05:43:15Z
id: nid_uppprbbqursr6awuoevoqpah1_e
title: "Settings rows: move each control kind's {value read, range, interaction} into the row model so presenters are pure markup"
status: closed
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: []
created_iso: 2026-07-30T02:28:26Z
status_updated_iso: 2026-07-30T05:43:15Z
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


## Notes

**2026-07-30T05:43:15Z**

Done. Accessors live in a NEW SIBLING module src/view/settingsRowAccessors.ts, not in settingsRows.ts — the design question the ticket asked to settle. Rationale: SRP (settingsRows.ts answers 'what rows exist and how are they worded'; the accessor answers 'where does the value live and what write moves it'), and it keeps the node-side e2e import graph (e2e/settingsBaseline.ts imports settingsRows.ts) clean, even though the accessor's engine imports are pure TS and would have worked either way.

One factory per control kind exposes read(state), bounds, settlesAt, interaction(value), plus accept(raw) where a user types. VicinityGraphSettingTab.ts and SettingsRowView.tsx no longer name an engine range table or a clamp; the tab's three slider builders collapsed into one. NODE_CAP_STEP / OUTLINE_DEPTH_SLIDER_STEP / DEPTH_SLIDER_STEP are single-homed.

Two defects found and fixed during review iteration:
- clampStepperDepth was hard-wired to linkDepthOut while bounds had gone per-field, and the plan stores depth verbatim so that view clamp was the only clamp. Deleted; each depth row now clamps to its own spec leaf. clampStepperDepth.test.ts renamed to settingsRowDepthClamp.test.ts, all six assertions preserved verbatim (reviewer diffed it).
- bounds.max was optional, so a min-only control at a slider gave two divergent silent fallbacks (tab: immovable slider; React: native default 100). SettingsTrackAccessor now demands a closed max — passing nodeCap() to addSlider is a compile error.

No user-visible behavior, default, range, step or accessible name changed; reviewer verified this against planSettingsWrite rather than taking it on faith. Guards: new settingsRowAccessors.test.ts walks every row through a switch closed by unhandledRowControl; settingsRowParity gained an ACCESSOR_OWNED_SYMBOLS scan over every row-rendering module. settingsRowSpecCoverage and settingsProductDefaults untouched.

npm test 93 files / 1230 tests exit 0; npm run check exit 0. e2e not run (needs real Obsidian). Commits ef5f163, 37daba9. change_log oiof5lbgjdn2ufbwxfi5dc45t. Nothing deferred, so no follow-up ticket.
