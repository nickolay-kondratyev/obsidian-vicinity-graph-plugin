---
id: nid_zylnmqz76ftecuqpavnnu1byt_e
title: "e2e: verify the slider value-readout test on an Obsidian >= 1.13 build"
status: open
deps: []
links: []
created_iso: 2026-07-26T04:35:35Z
status_updated_iso: 2026-07-26T04:35:35Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, settings, obsidian-version]
---

The test `settings tab: WHEN a slider is hovered THEN its current value is readable` in `e2e/settingsUxVisual.e2e.ts` (~line 380) asserts a union of TWO readout mechanisms:

- `.tooltip` at document level — how Obsidian <= 1.12.x renders a `setDynamicTooltip()` slider value;
- exact text inside the row `.setting-item-control` — how Obsidian >= 1.13 is documented to render it inline (per the `@deprecated` note on `setDynamicTooltip()` in the 1.13.1 typings).

Only the FIRST arm has ever executed: e2e pins `OBSIDIAN_VERSION="1.12.7"` in `scripts/setup-obsidian-bin.sh`. The inline arm is written from the typings note, never observed on a real build.

Risk: when `manifest.json` `minAppVersion` (currently 1.12.4) and the pinned e2e version move to >= 1.13.0, the inline arm may not match — e.g. if 1.13 renders the value OUTSIDE `.setting-item-control`, or formats it differently from `input.value` (trailing zeros, units, thousands separator). That surfaces as a confusing RED that looks like a product regression but is a test-locator problem.

Work: bump `OBSIDIAN_VERSION` in `scripts/setup-obsidian-bin.sh` to a 1.13.x build, run `npm run test:e2e -- settingsUxVisual.e2e.ts`, and confirm the inline arm actually matches; fix the locator if not. Do this BEFORE (or as part of) any `minAppVersion` bump to 1.13.

While there, re-check whether `setDynamicTooltip()` in `src/view/VicinityGraphSettingTab.ts` (`addLabeledSlider`, ~line 487) can finally be dropped — its WHY doc says "only when `minAppVersion` reaches 1.13.0".

Context: closed ticket nid_14phm98g7w64oparxz5wvfqwh_e (the regression that motivated the test).

## Acceptance Criteria

The slider value-readout test passes on a pinned Obsidian >= 1.13.x build with the INLINE arm doing the matching (verified by temporarily removing the .tooltip arm), or the locator is corrected so it does.

