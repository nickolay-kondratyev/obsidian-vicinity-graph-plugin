---
id: nid_14phm98g7w64oparxz5wvfqwh_e
title: "e2e: assert settings-tab sliders show their value (hover tooltip)"
status: open
deps: []
links: []
created_iso: 2026-07-25T17:39:08Z
status_updated_iso: 2026-07-25T17:39:08Z
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

