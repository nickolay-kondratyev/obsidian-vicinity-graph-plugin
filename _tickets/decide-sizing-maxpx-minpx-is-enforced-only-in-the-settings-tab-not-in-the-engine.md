---
id: nid_9jiira82snkh7bgy8zv060c9r_e
title: "[decide] Sizing maxPx >= minPx is enforced only in the settings tab, not in the engine"
status: open
deps: []
links: []
created_iso: 2026-07-27T17:44:26Z
status_updated_iso: 2026-07-27T17:44:26Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
---

`src/view/settingsValidation.ts` (`describeSizingRejection`) now REFUSES to persist an inverted `maxPx < minPx` pair from `src/view/VicinityGraphSettingTab.ts`. Two other doors to the same invariant are still open:

1. `src/engine/constants.ts` `clampSizingSettings()` clamps `minPx`/`maxPx` INDEPENDENTLY into their spec bounds, so a hand-edited `data.json` with `minPx: 300, maxPx: 50` loads and reaches `src/engine/NodeSizer.ts` unchanged.
2. The in-view sizing mirror (`src/view/SizingSection.tsx`) writes the same `global-sizing` interaction through `src/view/settingsWritePlan.ts` WITHOUT the new cross-field check.

Deliberately left alone by the debounce/validation ticket (`nid_x6l6x07rd1d1h4cefqmnyrbec_e`): resolving an inverted pair in the engine is a user-visible semantics call with no precedent in this repo.

## Design

Options for an inverted pair reaching `clampSizingSettings`:
(a) swap the two values, (b) raise `maxPx` to `minPx`, (c) lower `minPx` to `maxPx`, (d) fall back to BOTH spec defaults.
(d) is the most predictable and matches how `clampIntoRange` already treats a meaningless value (`NaN` -> spec default), but it silently discards a value the user may have deliberately typed on the other field.
Whichever is chosen, `src/view/SizingSection.tsx` should surface the same rejection copy the settings tab does (reuse `describeSizingRejection`) so the two surfaces agree.

## Acceptance Criteria

HUMAN decides the resolution rule; `clampSizingSettings` enforces `maxPx >= minPx` with a BDD test pinning the chosen rule; the in-view sizing panel shows the same rejection feedback as the settings tab.

