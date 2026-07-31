---
closed_iso: 2026-07-30T07:21:47Z
id: nid_ek3wrqoh1rsftk6ulg836mghf_e
tags: [settings, settings-cleanup]
title: "e2e: no spec types into a settings-tab text/number input"
status: closed
deps: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
links: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
created_iso: 2026-07-27T17:45:00Z
status_updated_iso: 2026-07-30T07:21:46Z
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

**2026-07-30T07:21:46Z**

DONE — acceptance criteria met in full.

`e2e/settingsTypedInput.e2e.ts` types into the unified settings rows:
- inverted maximum node size -> inline rejection visible under the row, `aria-invalid` set, and the value never persisted (verified against a real `reloadPlugin()` file round trip, not the input text)
- invalid regex line -> the offending line is named; the text is still stored
- `.vicinity-graph-settings-error` styling plus the alert/status roles
- both flush-on-leaving paths (blur and close)

`e2e/settingsWriteWindow.ts` is the new reusable debounce pattern the ticket asked for — NO sleeps. A sentinel-edit ordering barrier proves the negative ("no write landed") off the debounce queue insertion order; `expectFlushedAheadOfWindow` starts its clock before the keystroke so a real flush is distinguishable from the `SETTINGS_WRITE_DEBOUNCE_MS` deadline. Budget derives from that constant.

Falsifiability proven by MUTATION, not asserted: emptying `flushOnBlur`'s listener fails the blur test at ~468 ms ("it was the 400ms debounce timer ... not the flush"); removing both flush paths fails the close test. Non-flaky: 75/75 at `--repeat-each=5`, and 12/12 for the flush tests under 64 busy processes on 32 cores (flush latency 12-16 ms vs a 300 ms budget).

Documented caveat, in the spec: closing the settings window also blurs the field, so the close test gates the OUTCOME rather than `hide()` in isolation.

No product code changed; no guard or existing test weakened. `npm run check` exit 0, `npm test` 1245 passed, full `npm run test:e2e` 110 passed against a real Obsidian. Architecture map + CLAUDE.md point at the helper. change_log: 4pnofaknjaafirssuoh4hokyo.

No follow-up needed. (Render-level jsdom parity remains nid_7qot0m6nuxxmd5z0yb9jylsd6_e, deliberately out of scope here.)
