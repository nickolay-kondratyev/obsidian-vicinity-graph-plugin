---
closed_iso: 2026-11-17T21:20:19Z
id: nid_lmftfz11vvfwj382i4xmmoqgf_e
title: "Grouping mode setting: Folders | Tags toggle top-right, tag boxes, tag chips"
status: closed
deps: [nid_86c83wvlt5tbfs6s9ttr8r7mq_e]
links: []
created_iso: 2026-11-17T20:32:45Z
status_updated_iso: 2026-11-17T21:20:19Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
---

## Goal
The user can switch the graph between folder grouping and tag grouping from a toggle in the graph's top-right corner, and in tag mode sees colour-coded tag boxes and leftover-tag chips on notes. Use case 1 of the epic, end to end.

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`. Read `_agent_decisions/needs_review/tags-v1-product-decisions.md` (sections 1-7) and run the `my-frontend-design` skill before UI work.

## Done criteria
- New global setting (spec leaf in `src/engine/SettingsSpec.ts`, default = folders) with ONE declared row in the Grouping section of `src/view/settingsRows.ts`, rendered by BOTH presenters (settings tab + in-graph panel) per the repo's settings rules (see CLAUDE.md "Settings rows" / "Settings values" / "Settings tests"; add the default to `src/engine/settingsProductDefaults.test.ts`).
- A dedicated Folders | Tags toggle, visible on its own in the graph's TOP-RIGHT corner (not inside the collapsed controls panel), writes the SAME field through the ONE `SettingsWritePipeline` (`src/view/settingsWritePipeline.ts`) — no second write path. It coexists with the existing top-right truncation overlay badge (`src/view/VicinityGraphFlow.tsx:306`) without overlap. Accessible name + tooltip say what it does in the user's words.
- In Tags mode both `elkMapping` and `flowMapping` use the tag grouper from `nid_86c83wvlt5tbfs6s9ttr8r7mq_e` (one choice point, so they can never disagree). Tag boxes show `#tag` labels and their colour token as a tinted border/header via theme CSS variables; folder boxes stay neutral.
- In Tags mode each note shows its leftover tags as small coloured chips (cap with `+N`, named constant); no chips in Folders mode. Chips must not break the node-size/density rules (`src/view/nodeDensityThresholds.test.ts`) — if they need space, reserve it through the sizer like other node content, or place them where they cost no layout space; explain the choice.
- The grouping depth row's copy becomes mode-neutral (the cap applies to tag boxes too); edge depth into groups and truncation still work in Tags mode (hidden-note counts with no tag box go to the corner overlay — acceptable for V1).
- Switching modes relayouts and rebuilds every open view (pipeline fan-out); flipping back restores the exact folder layout.
- Tests: unit/component tests for the choice point and the toggle; a NEW long-term e2e spec (e.g. `e2e/tagGrouping.e2e.ts`) covering: toggle flips to tag boxes for a small fixture vault (owner example tags), a note with a single unshared tag shows its chip, the choice survives a plugin restart, toggling back restores folder boxes. No CSS/look assertions.
- `npm run check`, `npm test`, and the touched e2e specs (new spec + `nestedGrouping.e2e.ts`, `folderGroupingDepth.e2e.ts`, settings specs touched by the new row) green.
- Update `docs-internal/plan/high-level-plan.md` (Folder grouping section's "D1 Always-on, no toggle" is superseded — record the owner request) and `docs-internal/architecture-map.md`.

## Context
- `src/view/VicinityGraphFlow.tsx` panels; `src/view/GraphToolbar.tsx` (panel presenter); `src/view/VicinityGraphSettingTab.ts` (tab presenter); `src/view/SettingsRowView.tsx`; the `node-preview` pill row is the nearest precedent for a two/three-way choice.
- Folder group rendering: `src/view/FolderGroupNode.tsx`, styles in `src/view/graph-view.css`.

## Constraints
- Group ids: `src/view/linkPreviewModel.ts` (~:124) and `src/view/GraphViewController.ts` (~:317,342) recognise groups only via `isFolderGroupId` / `folderOfGroupId`; tag group ids must be recognised as groups there (not treated as notes). The full-path label truncation (`fullPathLabel`) follows the folder-label setting for every group — decide what tag boxes do.
- `decideLayout` in `src/view/GraphStructureDiff.ts` reuses the old layout when only a note's tags change. In Tags mode a tag-set change must force a relayout (as the folder grouping depth does today); flipping the mode must too.
- The mode is GLOBAL config (CLAUDE.md: nothing is per-document as a setting).
- Not published ⇒ no migration needed for the new key.

## Non-goals
- User-assignable tag colours; folder colours; per-view grouping mode; tag filtering (separate tickets).
