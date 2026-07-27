---
closed_iso: 2026-07-27T19:20:26Z
id: nid_d2z2jgt6v49ssej8hxmwd2xi6_e
title: "Settings-tab toggles have no accessible name"
status: closed
deps: []
links: []
created_iso: 2026-07-25T17:14:09Z
status_updated_iso: 2026-07-27T19:20:26Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [a11y, settings]
---

The settings tab at `src/view/VicinityGraphSettingTab.ts` now labels every slider / number / textarea via the shared `VicinityGraphSettingTab.nameControl` helper (aria-label == visible row name), but the TWO `addToggle` rows are still unlabeled:
- `renderExclusion()` — "Exclude notes from the graph"
- `renderSizing()` — one toggle per entry of `SIZING_METRICS` ("Own file size", "Backlinks", ...)

Obsidian renders a toggle as a `div.checkbox-container` wrapping a hidden `input[type=checkbox]`, so it is NOT obvious which element should carry the accessible name (the focusable/clickable element must be verified in the REAL rendered DOM, not from source — `node_modules/obsidian` ships types only).

Deliberately deferred from ticket nid_5wiribg2mn0mqcr7ni4ya0cfe_e to avoid guessing at Obsidian internals.

## Acceptance Criteria

- Each settings-tab toggle is programmatically associated with its visible row name, verified against the RENDERED DOM.
- The e2e guard in `e2e/settingsUxVisual.e2e.ts` ("every input carries its row name as accessible name") is extended to cover `input[type=checkbox]`, so a future toggle cannot regress.
- No visual change.


## Notes

**2026-07-27T19:20:26Z**

Resolved on branch a11y-toggle-labels (commit 25e75f6).

All 6 settings-tab toggles (5 SIZING_METRICS + exclusion enable) now carry an aria-label
on their checkbox via a new VicinityGraphSettingTab.nameToggle helper, applied from the two
addToggle sites so future sizing-metric rows inherit it.

Empirically resolved against the RENDERED DOM (Obsidian 1.12.7, throwaway marker-attribute
probe, since obsidian ships types only): ToggleComponent.toggleEl is the wrapping
<label class="checkbox-container"> -- NOT the checkbox, and NOT the div this ticket assumed.
That label is textless, which is exactly why the checkbox had no name. aria-label on a <label>
does not name the control it wraps, so the name lands on toggleEl.querySelector("input").

e2e guard extended: :not([type=checkbox]) exemption deleted, floor 20 -> 26, plus a
getByRole("checkbox", { name }) assertion that exercises the browser's own accessible-name
computation. Guard was RED first and mutation-checked. radio exemption kept.

Naming: "Exclude notes from the graph" (sole control in row); `${label} enabled` for sizing
metrics, matching the pre-existing `${label} weight` two-controls-per-row convention.

Caveat on AC 'no visual change': resting render is identical, but hovering a toggle now shows
Obsidian's tooltip, because Obsidian pops one for ANY aria-label. Same behaviour sliders and
number inputs already gained in nid_5wiribg2mn0mqcr7ni4ya0cfe_e. Judged acceptable and
consistent by review; flagging here in case you disagree.

Gates: npm run check exit 0, npm test 1053/1053, settingsUxVisual.e2e.ts 17 passed,
settingsDependentRows.e2e.ts 3 passed -- independently re-run by the reviewer.
Change log: jbtka0lh0wh7lyaoge15kzl75
