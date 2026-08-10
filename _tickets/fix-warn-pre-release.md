---
id: nid_1iskliqzhf6k4euouhn44phiq_e
title: fix warn pre release
status: in_progress
deps: []
links: []
created_iso: '2026-08-10T22:22:50Z'
status_updated_iso: '2026-08-10T22:24:02Z'
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
