---
id: nid_d2z2jgt6v49ssej8hxmwd2xi6_e
title: "Settings-tab toggles have no accessible name"
status: open
deps: []
links: []
created_iso: 2026-07-25T17:14:09Z
status_updated_iso: 2026-07-25T17:14:09Z
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

