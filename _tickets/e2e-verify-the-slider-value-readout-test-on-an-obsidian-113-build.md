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


## Notes

**2026-07-26T17:36:55Z**

BLOCKED on an external dependency — ticket stays OPEN. Investigated 2026-07-26 on branch `e2e-slider-obsidian-113-verify`.

## The core work cannot be done: there is no obtainable Obsidian 1.13.x build

| Probe | Result |
|---|---|
| GitHub API, `obsidianmd/obsidian-releases` releases | newest tag `v1.12.7`; NO 1.13.x tag |
| `HEAD .../download/v1.13.1/obsidian-1.13.1.tar.gz` | 404 |
| `desktop-releases.json` | `latestVersion: 1.12.7`; `beta.latestVersion: 1.13.3` |
| `HEAD https://releases.obsidian.md/release/obsidian-1.13.3.asar.gz` | 404 — Catalyst-gated |

1.13.x is insider-only (paid Catalyst licence) and ships as an `.asar.gz` payload, not a runnable
platform tarball. The npm `obsidian` typings are at 1.13.1 — i.e. typings ship AHEAD of the GA app,
which is exactly why the inline arm could be written from a `@deprecated` note no shipped build
demonstrates. So `OBSIDIAN_VERSION` was NOT bumped and the acceptance criterion is NOT met.

Two shortcuts were considered and DELIBERATELY REJECTED (do not re-attempt):
- Swapping a 1.13 `app.asar` into the 1.12.7 Electron shell — licence-gated anyway, and a 1.13
  payload in a 1.12 shell is not a faithful build, so a green would not discharge this ticket.
- Synthesising the 1.13 DOM in the test to "exercise" the inline arm — that tests our guess against
  itself. A green would look like the ticket was discharged while proving nothing about real 1.13.

## The setDynamicTooltip() half IS answered: it STAYS

`src/view/VicinityGraphSettingTab.ts` `addLabeledSlider` — its documented removal condition is
`minAppVersion >= 1.13.0`, unreachable while 1.13 is not GA. `manifest.json` `minAppVersion` remains
1.12.4. Its existing WHY doc already reads as a gating condition (not an imminent removal), so it was
left untouched.

## What WAS delivered instead (commit 8d8fe32)

The ticket's stated risk is "a confusing RED that looks like a product regression but is a
test-locator problem". That half is fixable today, and was fixed: the union assertion in
`e2e/settingsUxVisual.e2e.ts` previously failed as ONE opaque Playwright timeout that never revealed
which arm missed. It now captures the row's `.setting-item-control` DOM plus any body-level
`.tooltip` and re-throws with the original error preserved as `cause`. Observed during a perturbation
check: `body .tooltip texts=[["2"]]` — which separates "value is rendered, we mislooked" from "value
absent" at a glance.

Assertion semantics are UNCHANGED (reviewer proved the test body byte-identical to its parent once
try/catch scaffolding is removed; failure is never swallowed; failing-test cost +~0.1s). Green on
1.12.7: check exit 0, 990 unit tests, 16 e2e passed. `scripts/setup-obsidian-bin.sh` now warns a
future bumper that 1.13 will exercise the unverified inline arm.

Note the evidentiary basis for the inline arm is ONE sentence — `obsidian.d.ts`:
"@deprecated The value is now always shown inline next to the slider." It specifies no selector and
no number formatting, so BOTH risks this ticket lists (rendered outside `.setting-item-control`;
formatted differently from `input.value`) remain entirely unconstrained by documentation.

## RE-CHECK TRIGGER

When Obsidian 1.13.x reaches GA (`desktop-releases.json` `latestVersion` >= 1.13.0, with a
`obsidian-1.13.x.tar.gz` asset on the releases repo): bump `OBSIDIAN_VERSION` in
`scripts/setup-obsidian-bin.sh`, run `npm run test:e2e -- settingsUxVisual.e2e.ts`, and confirm the
INLINE arm does the matching by temporarily removing the `.tooltip` arm. Then re-evaluate dropping
`setDynamicTooltip()` alongside any `minAppVersion` bump.

**2026-07-27T15:21:12Z**

RE-CHECK 2026-07-27: trigger has NOT fired. `desktop-releases.json` `latestVersion` is still `1.12.7`; newest tag on `obsidianmd/obsidian-releases` is still `v1.12.7` (no 1.13.x asset). No new work done — the 2026-07-26 analysis and its two rejected shortcuts stand unchanged. Ticket stays OPEN awaiting 1.13.x GA.
