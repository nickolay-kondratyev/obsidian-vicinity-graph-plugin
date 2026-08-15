---
id: nid_dma49vci6uxv0w1qlc66y3kgc_e
title: "Link-preview drawer retarget keeps stale collapse state; row click can unmount the graph pane"
status: open
deps: []
links: []
created_iso: 2026-08-15T00:41:30Z
status_updated_iso: 2026-08-15T00:41:30Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, react]
---

ROOT CAUSE: src/view/LinkPreviewContent.tsx:53 initialises collapse state ONCE from the first model's rowIds (useState initializer) and never re-derives it on model change — but the drawer is deliberately retargeted IN PLACE: a second edge click replaces the model via LinkPreviewOverlayStore.showLinkPreview (src/view/VicinityGraphFlow.tsx:162-168 does NOT close the preview on edge click), and the drawer/content are rendered WITHOUT a key (src/view/VicinityGraphFlow.tsx:316-327). Row ids are minted per model as edge:<pairIndex>:<index> (src/view/linkPreviewModel.ts), so a row unique to the SECOND model fails ContextRowCollapseState.toggled's unknown-id guard (src/view/contextRowCollapse.ts:35-38) and the throw escapes the setState updater; with no error boundary above the root (src/view/VicinityGraphView.tsx createRoot render), React 18 unmounts the WHOLE graph pane. Milder symptom when ids collide by construction: rows expanded for edge A render pre-expanded for edge B, and bulk-button enablement is computed against A's row count.

FAILING TEST (committed, it.fails — flip to it as acceptance): src/view/LinkPreviewContent.component.test.tsx, describe "LinkPreviewContent drawer retarget", test "WHEN the drawer is retargeted to an edge with more rows THEN the extra row still toggles".

FIX SHAPE: either key the content by model identity (key on LinkPreviewDrawer/LinkPreviewContent in VicinityGraphFlow) or reconcile collapse state against model.rowIds during render (the prop-derived-state pattern useOptimisticValue already uses).

## Acceptance Criteria

The committed it.fails test flips to it and passes; clicking a second edge while the drawer is open serves the new model with all rows collapsed and working.

