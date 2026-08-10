---
closed_iso: 2026-08-10T22:27:14Z
id: nid_1iskliqzhf6k4euouhn44phiq_e
title: fix warn pre release
status: closed
deps: []
links: [nid_zyv1x5w08difwfdopm50bt2lu_e]
created_iso: '2026-08-10T22:22:50Z'
status_updated_iso: 2026-08-10T22:27:14Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
The following files contain '@typescript-eslint/no-unsafe-member-access' issue which is showing up in obsidian pre publish check

```
e2e/buttonChrome.ts
e2e/canvasMarkdownLinkIndexing.e2e.ts
e2e/canvasSpaceKey.e2e.ts
e2e/controlsRestart.e2e.ts
e2e/coreEditingWhileGraphOpen.e2e.ts
e2e/edgeRouting.e2e.ts
e2e/edgeRoutingEval.e2e.ts
e2e/externalVault.e2e.ts
e2e/graphPlacement.e2e.ts
e2e/linkPreview.e2e.ts
e2e/localPinScenario.e2e.ts
e2e/nodeContentBox.ts
e2e/nodeContentOverride.e2e.ts
e2e/nodeOutline.e2e.ts
e2e/nodeResize.e2e.ts
e2e/nodeTitleWrap.e2e.ts
e2e/noteRename.e2e.ts
e2e/obsidianHarness.ts
e2e/perFileStorePersistence.e2e.ts
e2e/pinnedCentralScenario.e2e.ts
e2e/referenceProvenance.e2e.ts
e2e/settingsDependentRows.e2e.ts
e2e/settingsResetReview.e2e.ts
e2e/settingsResetVerify.e2e.ts
e2e/settingsTabPage.ts
e2e/settingsTypedInput.e2e.ts
e2e/settingsUxVisual.e2e.ts
e2e/settingsWriteWindow.ts
e2e/vaultTarget.ts
e2e/vicinityGraph.e2e.ts
src/main.ts
src/view/ConfirmModal.ts
src/view/DrawerResizeHandle.tsx
src/view/ElkLayoutRunner.ts
src/view/FolderGroupNode.tsx
src/view/GraphLayoutRunner.ts
src/view/GraphViewOpener.ts
src/view/LinkPreviewContent.tsx
src/view/LinkPreviewDrawer.tsx
src/view/NodeOutline.tsx
src/view/NoteNode.tsx
src/view/ObsidianGraphUi.ts
src/view/ObsidianNoteNavigator.ts
src/view/SettingsRowView.tsx
src/view/ToggleSwitch.tsx
src/view/VicinityEdge.tsx
src/view/VicinityGraphFlow.tsx
src/view/VicinityGraphSettingTab.ts
src/view/VicinityGraphView.tsx
src/view/d3ForceRefinement.ts
src/view/elkMapping.ts
src/view/libavoidLoader.ts
src/view/nodeResize.ts
src/view/rowRenderingSource.ts
src/view/useOptimisticValue.ts
```

Group up the files and create 1 ticket per group to fix this.
We are grouping so that each ticket has reasonable context window.

---

## Resolution (2026-08-10)

This was a **grouping/dispatch** task — split the file list into per-group fix
tickets, not fix the warnings here. Done.

### Finding: the rule cannot be reproduced locally today
The repo has **no local ESLint** (no `node_modules/.bin/eslint`, no
`typescript-eslint` dependency, no `eslint.config.*`). `@typescript-eslint/no-unsafe-member-access`
is a **type-aware** rule, so it only surfaces in Obsidian's pre-publish check.
An engineer cannot verify a fix without first wiring typed ESLint locally.
So a shared **prerequisite** ticket was created and made a `dep` of every group
ticket (see also existing `docs-internal/tickets/ticket-eslint-adoption.md`).

### Prerequisite ticket (all groups depend on it)
- `nid_zyv1x5w08difwfdopm50bt2lu_e` — eslint typed-lint reproduce
  `no-unsafe-member-access` locally (wire ESLint 9 flat config + typed
  `typescript-eslint`, add `npm run lint`, document single-file lint command).

### Group tickets (each `dep` → prerequisite above; all `link`ed to each other)
1. `nid_ez80034jh0f5mba3hgegc0lvq_e` — e2e core graph/canvas/editing specs
   (canvasMarkdownLinkIndexing, canvasSpaceKey, coreEditingWhileGraphOpen,
   controlsRestart, graphPlacement, vicinityGraph)
2. `nid_1fzz9jrjbnaa3iky57nmmckfc_e` — e2e edge/node rendering specs
   (edgeRouting, edgeRoutingEval, linkPreview, nodeContentOverride, nodeOutline,
   nodeResize, nodeTitleWrap)
3. `nid_weo2x5v4mks9ge9bf642u0hg4_e` — e2e settings specs
   (settingsDependentRows, settingsResetReview, settingsResetVerify,
   settingsTypedInput, settingsUxVisual)
4. `nid_d2ditwyebmdlyg3ktb3li0r3d_e` — e2e pins/persistence/rename/external specs
   (localPinScenario, pinnedCentralScenario, referenceProvenance,
   perFileStorePersistence, noteRename, externalVault)
5. `nid_6kz4747paujgvor7ftnav1xz6_e` — e2e shared harness/helpers
   (buttonChrome, nodeContentBox, obsidianHarness, settingsTabPage,
   settingsWriteWindow, vaultTarget)
6. `nid_epspxsqa74z7vnpu7846ou5sl_e` — src/view settings & controls
   (SettingsRowView, VicinityGraphSettingTab, ToggleSwitch, useOptimisticValue,
   rowRenderingSource, ConfirmModal)
7. `nid_dq0439hrj3lj7edst73p6a9ic_e` — src/view graph/flow/nodes
   (VicinityGraphFlow, VicinityGraphView, NoteNode, FolderGroupNode, NodeOutline,
   VicinityEdge, nodeResize, DrawerResizeHandle)
8. `nid_ymugwkesjh70astiz9bffzu26_e` — src/view layout runners
   (ElkLayoutRunner, GraphLayoutRunner, elkMapping, d3ForceRefinement,
   libavoidLoader)
9. `nid_cinizzkohsf4r3hn48qvdfvzt_e` — src/view link-preview + obsidian adapters
   + main (LinkPreviewContent, LinkPreviewDrawer, GraphViewOpener, ObsidianGraphUi,
   ObsidianNoteNavigator, src/main.ts)

All 55 files from the list above are covered exactly once across groups 1–9.
Grouped by directory + concern so each ticket fits a reasonable context window.
