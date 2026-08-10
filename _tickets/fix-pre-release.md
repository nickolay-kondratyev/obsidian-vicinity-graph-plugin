---
closed_iso: 2026-08-10T22:24:13Z
id: nid_2uh0ep3s7hcz529hpq6pmcjlw_e
title: fix pre-release
status: closed
deps: []
links: []
created_iso: '2026-08-10T22:19:45Z'
status_updated_iso: 2026-08-10T22:24:13Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
The following files contain `@typescript-eslint/no-unsafe-call` 

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
e2e/playwright.config.ts
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
src/view/ControlsActionsContext.ts
src/view/DrawerResizeHandle.tsx
src/view/ElkLayoutRunner.ts
src/view/FolderGroupNode.tsx
src/view/GraphUiContext.ts
src/view/GraphViewOpener.ts
src/view/LinkPreviewContent.tsx
src/view/LinkPreviewDrawer.tsx
src/view/NodeOutline.tsx
src/view/NoteNode.tsx
src/view/NoteOpenContext.ts
src/view/ObsidianGraphUi.ts
src/view/ObsidianNoteNavigator.ts
src/view/SettingsRowView.tsx
src/view/VicinityEdge.tsx
src/view/VicinityGraphFlow.tsx
src/view/VicinityGraphSettingTab.ts
src/view/VicinityGraphView.tsx
src/view/d3ForceRefinement.ts
src/view/elkMapping.ts
src/view/libavoidLoader.ts
src/view/rowRenderingSource.ts
src/view/testFixtures/settingsPanelHarness.tsx
src/view/useOptimisticValue.ts


Split these files into groups and create 1 ticket per group so that we can fix this issue in all the files.
The goal of the split so we dont have to have 50+ separate tickets. While also trying to fix all of them in one ticket would blow up the agent context.

---

## Resolution (2026-08-10)

The 57 flagged files were split into 5 fix tickets, sized so each fits comfortably
in a single agent's context. Every ticket body is self-contained: it carries the
shared background/how-to-fix guidance plus its own full-relative-path file list, and
all 5 are cross-linked. Files were grouped by seam so a fix in one place removes
many downstream sites:

1. **`nid_khnm364awuizz6cmr2pxxjkpk_e`** — e2e harness/support helpers (7 files:
   `buttonChrome.ts`, `nodeContentBox.ts`, `obsidianHarness.ts`, `settingsTabPage.ts`,
   `settingsWriteWindow.ts`, `vaultTarget.ts`, `playwright.config.ts`). **Do first** —
   the shared seams here (typed `page.evaluate`, Obsidian `app`) feed the spec groups.
2. **`nid_f7vkm00ahrak377r5dqpiyy9v_e`** — e2e specs group A (12 `*.e2e.ts`). Depends on (1).
3. **`nid_db5s4uypdiesrk6oi8nms46wv_e`** — e2e specs group B (12 `*.e2e.ts`). Depends on (1).
4. **`nid_wv95rkafrcxn9by7t5ng95dvn_e`** — `src/view` React components (11 `.tsx`).
5. **`nid_j1zgoruaddxyhykf2maxsnzqn_e`** — `src/main.ts` + `src/view` non-component modules (15 `.ts`).

All 57 original files are accounted for across the 5 groups (no overlap, no gaps).

**IMPORTANT context for the fix tickets:** there is NO ESLint config committed in this
repo yet — the rule findings came from an out-of-repo type-checked lint run. ESLint
adoption is separately tracked in `docs-internal/tickets/ticket-eslint-adoption.md`.
Each fix ticket instructs the agent to first establish a reproducible lint signal
(land the flat config, or run typescript-eslint's `recommended-type-checked` preset)
before changing code. This meta-ticket (split-only) is now CLOSED.
