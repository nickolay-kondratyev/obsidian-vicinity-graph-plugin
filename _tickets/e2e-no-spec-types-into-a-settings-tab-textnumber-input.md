---
id: nid_ek3wrqoh1rsftk6ulg836mghf_e
tags: [settings, settings-cleanup]
title: "e2e: no spec types into a settings-tab text/number input"
status: open
deps: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
links: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
created_iso: 2026-07-27T17:45:00Z
status_updated_iso: 2026-07-27T17:45:00Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
No Playwright spec under `e2e/` ever calls `.fill()`/`.type()` on a settings-tab input — every existing spec writes through the persistence harness (`harness.saveGlobalView(...)`) and then asserts on the re-rendered DOM. So the settings tab`s TYPED-input behaviour (debounce settle, flush on blur/close, the inline rejection + invalid-regex feedback added in `nid_x6l6x07rd1d1h4cefqmnyrbec_e`) has real-Obsidian coverage of exactly zero.

The logic itself IS unit-tested (`src/view/settingsDebounce.test.ts`, `src/view/settingsValidation.test.ts`); what is unverified in a real Obsidian is the WIRING in `src/view/VicinityGraphSettingTab.ts` — that `hide()` really flushes, that the feedback div really appears under the row, and that `.vicinity-graph-settings-error` is styled as intended.

## Acceptance Criteria

One `e2e/*.e2e.ts` spec types an inverted maximum node size and asserts the inline rejection is visible and the value did NOT persist; one types an invalid regex line and asserts the line is named. Both must account for the `SETTINGS_WRITE_DEBOUNCE_MS` window (no existing e2e spec controls timers — establish the pattern).


## Notes

**2026-07-30T03:35:54Z**

RE-SCOPED (from step 5, nid_x6hgehsu5il1d1shuraz3ufqy_e, now closed): this ticket is now UNBLOCKED — its dep is closed.

Assert the UNIFIED renderer, not the old hand-written tab. Both surfaces now render from ONE row model (src/view/settingsRows.ts, SETTINGS_GROUPS / EVERY_SETTINGS_ROW) via two presenters (src/view/VicinityGraphSettingTab.ts and src/view/SettingsRowView.tsx).

What step 5 did and did NOT cover, so this ticket knows its gap:
- COVERED (pure/structural, no Obsidian): parse, global round-trip, reset-to-declared-default and bounds for every SETTINGS_SPEC leaf; plus a SOURCE-SCAN tab-vs-panel parity guard (src/view/settingsRowParity.test.ts) that reddens on a per-row label skip in either presenter or a deleted control-kind `case`.
- NOT COVERED, and still zero: nobody ever TYPES. No spec calls .fill()/.type() on a settings input in a real Obsidian. So the debounce settle, the flush on blur/close, and the inline rejection + invalid-regex feedback remain unverified as WIRING.

Still wanted here: type an inverted max (min > max) and a bad regex into the unified rows; establish the debounce-window pattern other specs can copy; assert the feedback element appears under the row and .vicinity-graph-settings-error is styled as intended.

NOTE: render-level parity (a jsdom/@testing-library harness) is deliberately NOT this ticket — it is nid_7qot0m6nuxxmd5z0yb9jylsd6_e.
