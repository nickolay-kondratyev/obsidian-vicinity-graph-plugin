---
id: nid_u36pqr4zljs44jt42lk9ln8ry_e
title: "A controls-panel settings write does not refresh OTHER open graph views"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:54:05Z
status_updated_iso: 2026-07-25T03:54:05Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui]
---

`ControlsActions.applySettings` persists and then calls only `this.controller.handleSettingsChanged()`, so just the view that owns the panel rebuilds. The settings TAB fans out via the plugin's `refreshOpenViews()` (see `src/main.ts` ~:95).

Consequence with two graph views open: change a GLOBAL setting from one view's controls panel and the other view keeps rendering the old value until something else makes it rebuild.

Pre-existing and shared by `SizingSection` / `ForceLayoutSection`, so not new — but `node-content-preference`'s Preview pill makes it visible as STALE UI, because the panel's radio is controlled off the snapshot: the second view literally shows the wrong segment selected.

## Acceptance Criteria

A global-scope write from the controls panel refreshes every open vicinity-graph view, not just the originating one. Per-doc writes must keep their current narrower behaviour (they only concern one doc). Cover it wherever `ControlsActions` is unit-tested, with a fake that records which views were refreshed.

