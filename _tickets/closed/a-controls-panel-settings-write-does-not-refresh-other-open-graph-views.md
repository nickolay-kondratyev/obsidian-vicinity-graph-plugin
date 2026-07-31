---
closed_iso: 2026-07-25T17:03:39Z
id: nid_u36pqr4zljs44jt42lk9ln8ry_e
title: "A controls-panel settings write does not refresh OTHER open graph views"
status: closed
deps: []
links: []
created_iso: 2026-07-25T03:54:05Z
status_updated_iso: 2026-07-25T17:03:39Z
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


## Notes

**2026-07-25T17:03:39Z**

Fixed on branch controls-global-refresh-fanout (commits caa4e34, e777ed4, 0a22e10).

Seam: new ViewsRefreshPort { refreshAllViews() } in src/view/viewPorts.ts, implemented in src/main.ts over the existing refreshOpenViews() and threaded registerView -> VicinityGraphView -> ControlsActions. Scope decision is the pure exhaustive (compile-time-checked) src/view/settingsWriteScope.ts; FakeViewsRefresh records refreshed views.

Behaviour: global command kinds AND pin/unpin fan out to every open view; per-doc depth writes stay on the owning view. Originating view is not rebuilt separately (getLeavesOfType already enumerates it - verified). WriteOutcome makes it uniform that nothing landed => nothing rebuilds.

Tests: first-ever src/view/ControlsActions.test.ts (11 tests, incl. a fake recording refreshed views) + settingsWriteScope.test.ts. Started red; reverting the fix reproduces 3 failures. Suite 938/938, npm run check clean. No e2e run (release gate).

Note for the reader: review established that the per-doc narrowness is a deliberate scope boundary, NOT an invariant - sibling views follow the active file and share MAIN, so they DO go stale on a per-doc depth write. Out of scope here per the acceptance criteria; filed as docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md.
