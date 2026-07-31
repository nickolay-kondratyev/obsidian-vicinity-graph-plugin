---
closed_iso: 2026-07-26T04:35:20Z
id: nid_14phm98g7w64oparxz5wvfqwh_e
title: "e2e: assert settings-tab sliders show their value (hover tooltip)"
status: closed
deps: []
links: []
created_iso: 2026-07-25T17:39:08Z
status_updated_iso: 2026-07-26T04:35:20Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, a11y, settings]
---

A production regression shipped green: the `setDynamicTooltip()` call in `addLabeledSlider`
(`src/view/VicinityGraphSettingTab.ts`, ~line 480) was removed on the strength of the `@deprecated`
tag in the `obsidian` typings, and ALL 10 settings-tab sliders lost their only value readout on the
supported runtime. The full suite (`npm test` 938 tests + `e2e/settingsUxVisual.e2e.ts` 14 tests +
`e2e/settingsResetReview.e2e.ts` 11 tests) stayed 100% green, because NOTHING in the repo asserts
that a settings-tab slider is readable — only that it exists, has an `aria-label`, and has a value
attribute.

Background detail: the plugin floor is `manifest.json` `minAppVersion: 1.12.4`; e2e pins
`OBSIDIAN_VERSION="1.12.7"` in `scripts/setup-obsidian-bin.sh`. On 1.12.7 `setDynamicTooltip()`
installs mouseenter/mouseleave listeners that render the value in a `.tooltip` element. The inline
value readout described by the 1.13.1 `@deprecated` note only exists from Obsidian 1.13.0.

Manual probe that reproduced it (ours vs. core Appearance > Font size, same build):
  before revert: ours `.tooltip` allTextContents = []   / core = ["16"]
  after revert:  ours = ["1"]                            / core = ["16"]

Work: add one BDD test to `e2e/settingsUxVisual.e2e.ts` that opens the plugin settings tab, hovers a
slider inside `.vicinity-graph-settings`, and asserts a `.tooltip` element appears carrying the
slider value. Keep it robust to a future `minAppVersion` bump to >= 1.13.0, where the readout moves
inline instead of into a tooltip — assert "the value is visible somewhere in the row" rather than
hard-coding the tooltip mechanism, or gate on the pinned version explicitly.


## Notes

**2026-07-26T04:35:20Z**

RESOLVED. Added one BDD test 'settings tab: WHEN a slider is hovered THEN its current value is readable' in e2e/settingsUxVisual.e2e.ts. Hovers the 'Outline depth' slider (non-advanced; the force-layout ones sit in a collapsed <details>) and asserts its runtime inputValue() is visible as RENDERED TEXT in either the body-level .tooltip (pinned 1.12.7) or the row .setting-item-control (Obsidian >= 1.13, inline readout) — so a minAppVersion bump needs no edit here.

Closed the specific trap the ticket named: text-only match (the <input value=...> attribute cannot satisfy it), scoped to .setting-item-control with exact match (a digit in the row name/desc cannot), page.mouse.move(0,0) before hover (a stale tooltip from an earlier test in this serial file cannot), and the interpolated value is regex-escaped (a fractional step like '0.5' cannot match '015').

Teeth verified empirically, not assumed: with .setDynamicTooltip() deleted from addLabeledSlider the test FAILS ('expect(locator).toBeVisible() failed ... element(s) not found' — neither union arm resolves); restored, it passes. src/view/VicinityGraphSettingTab.ts got a comment-only @see pointer from its WHY doc to the guarding test.

Verification: settingsUxVisual 15/15, npm run check clean, npm test 966/966.

Follow-up filed: the >= 1.13 inline arm has never executed on a real 1.13 build.
