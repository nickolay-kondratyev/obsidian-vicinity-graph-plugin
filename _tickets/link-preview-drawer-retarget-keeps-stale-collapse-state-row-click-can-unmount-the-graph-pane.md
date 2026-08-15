---
closed_iso: 2026-08-15T01:43:23Z
session_ids: [{"a": "claude", "type": "execution", "id": "614aba45-d46d-4ce4-b3bc-798cbf0c3031"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_dma49vci6uxv0w1qlc66y3kgc_e
title: "Link-preview drawer retarget keeps stale collapse state; row click can unmount the graph pane"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:41:30Z
status_updated_iso: 2026-08-15T01:43:23Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [view, react]
---

ROOT CAUSE: src/view/LinkPreviewContent.tsx:53 initialises collapse state ONCE from the first model's rowIds (useState initializer) and never re-derives it on model change — but the drawer is deliberately retargeted IN PLACE: a second edge click replaces the model via LinkPreviewOverlayStore.showLinkPreview (src/view/VicinityGraphFlow.tsx:162-168 does NOT close the preview on edge click), and the drawer/content are rendered WITHOUT a key (src/view/VicinityGraphFlow.tsx:316-327). Row ids are minted per model as edge:<pairIndex>:<index> (src/view/linkPreviewModel.ts), so a row unique to the SECOND model fails ContextRowCollapseState.toggled's unknown-id guard (src/view/contextRowCollapse.ts:35-38) and the throw escapes the setState updater; with no error boundary above the root (src/view/VicinityGraphView.tsx createRoot render), React 18 unmounts the WHOLE graph pane. Milder symptom when ids collide by construction: rows expanded for edge A render pre-expanded for edge B, and bulk-button enablement is computed against A's row count.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/view/LinkPreviewContent.component.test.tsx, describe "LinkPreviewContent drawer retarget", test "WHEN the drawer is retargeted to an edge with more rows THEN the extra row still toggles".

FIX SHAPE: either key the content by model identity (key on LinkPreviewDrawer/LinkPreviewContent in VicinityGraphFlow) or reconcile collapse state against model.rowIds during render (the prop-derived-state pattern useOptimisticValue already uses).

## Acceptance Criteria

The committed it.skip test is unskipped and passes; clicking a second edge while the drawer is open serves the new model with all rows collapsed and working.

## Resolution (2026-08-15)

Fixed via the prop-derived-state option (reconcile during render), NOT the key-remount option — the committed acceptance test rerenders `LinkPreviewContent` in place with a new model, so only the in-component reconcile satisfies it, and it matches the sanctioned pattern `useOptimisticValue` already documents (render-time adjust, no stale-frame effect).

- `src/view/LinkPreviewContent.tsx`: alongside the `collapse` state, a second `seenModel` state tracks the model identity. When the incoming `model` prop differs, the render uses (and stores) `ContextRowCollapseState.allCollapsed(model.rowIds)` — so a retarget always serves the new model with every row collapsed, covering both the throw (row unique to the new model) and the id-collision leak (old expansions rendering on the new edge). Bulk-button enablement derives from the reconciled state.
- `src/view/LinkPreviewContent.component.test.tsx`: the acceptance test is unskipped and the describe's KNOWN-BUG framing removed; a second test pins the collision case (same row ids by construction, expanded row on edge A renders collapsed after retarget to edge B).

Verified: `npm run check` clean, full `npm test` (2090 passed), and `npm run test:e2e -- linkPreview.e2e.ts` (7 passed on the pinned real-Obsidian build).

