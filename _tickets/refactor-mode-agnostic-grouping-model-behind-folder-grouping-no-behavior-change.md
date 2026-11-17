---
id: nid_44yk50pp4xl9yexnoufqsiytj_e
title: "Refactor: mode-agnostic grouping model behind folder grouping (no behavior change)"
status: open
deps: []
links: []
created_iso: 2026-11-17T20:32:44Z
status_updated_iso: 2026-11-17T20:32:44Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
profile: higher
---

## Goal
Make the view's grouping model mode-agnostic so a second grouper (tags, ticket `nid_86c83wvlt5tbfs6s9ttr8r7mq_e`) can feed the SAME layout/render/edge-collapse pipeline. Today every consumer is typed against folders (`FolderGroup`, `FolderPath` keys). This ticket is a pure refactor: folder grouping must render exactly as it does now.

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`; product decisions in `_agent_decisions/needs_review/tags-v1-product-decisions.md`.

## Done criteria
- A grouping result type that names groups by an opaque group id (branded type) rather than `FolderPath`, carrying at least: id, parent id, display label, full label/tooltip text, member paths, and the three lookup seams (`nearestRenderedAncestor…`, `lowestCommonAncestorContainerOf`, `projectOntoContainerChildOf`) expressed without folder arithmetic leaking to consumers.
- `deriveFolderGroups` produces that shape; `src/view/elkMapping.ts`, `src/view/flowMapping.ts`, `src/view/layoutFit.ts`, `src/view/truncationBadges.ts` and `src/view/FolderGroupNode.tsx` consume ONLY the mode-agnostic shape (no `FolderGroup`/`FolderPath` in their grouping code paths, except where truncation-badge attribution genuinely needs a note's folder — keep that behind a seam the folder grouper answers).
- Group nodes can carry an optional presentation hint (e.g. a colour token) that defaults to "none" so folder boxes stay neutral (folder colours were deliberately NOT shipped — see `docs-internal/tickets/ticket-folder-color-ux-design-pass.md`).
- All existing tests pass unchanged in assertion (test fixtures may be retyped, assertions must not be loosened): `npm run check`, `npm test`, and the grouping e2e specs (`npm run test:e2e -- nestedGrouping.e2e.ts folderGroupingDepth.e2e.ts folderGroupLabelNav.e2e.ts vicinityGraph.e2e.ts`).
- `docs-internal/architecture-map.md` and the "Folder grouping (recursive)" section of `docs-internal/plan/high-level-plan.md` name the new seam.

## Context
- `src/view/folderGrouping.ts` — current grouping; read its CONTRACT comment (called independently by elkMapping and flowMapping, must stay pure/deterministic).
- Consumers: `src/view/elkMapping.ts:37`, `src/view/flowMapping.ts:305,418`, `src/view/layoutFit.ts:92,146`, `src/view/truncationBadges.ts:39`.
- The depth cap (`folderGroupingDepth` in `src/engine/SettingsSpec.ts`) and `edgeDepthIntoGroups` must keep working through the new shape.
- `src/view/GraphStructureDiff.ts` / React Flow node ids for group nodes: keep group node ids stable for folder mode so the structural diff does not force needless relayouts.

## Constraints
- Lands BEFORE the tag grouper; the tag grouper is a second producer of this exact shape, so the shape must not assume a group is a path prefix of its members.
- A note renders in exactly one group (no duplicate nodes) — the shape may rely on that.
- Pure refactor commit(s), no behavior change (repo rule: refactors and behavior changes in separate commits).

## Non-goals
- No tag code, no new setting, no colours rendered.
