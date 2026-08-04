---
closed_iso: 2026-07-31T20:24:50Z
id: nid_z2k1eebic1nilpz9z3r65cnrx_e
title: 'Link preview: gesture wiring (node click, edge click) + docs + smoke run'
status: closed
deps: [nid_tpghu4nsbt08slhm2vannrnqw_e]
links: []
created_iso: '2026-07-31T18:49:32Z'
status_updated_iso: 2026-07-31T20:24:50Z
type: task
priority: 3
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part 4/4 of parent ticket nid_tohotgq2s92dvd1iov1rd0umv_e (_tickets/show-the-preview-of-the-links.md). Depends on the modal UI ticket (see deps).

HUMAN-ALIGNED behavior change (clarified 2026-07-31): plain node click no longer opens the note.
1. src/view/VicinityGraphFlow.tsx onNodeClick (currently ~line 46-52 -> controller.openNode): plain click -> open NODE preview modal; Ctrl/Cmd-click (src/view/nodeOpenIntent.ts opensInNewTab) -> keep opening the note in a new tab. Folder-group nodes stay inert for the modal, same guard as GraphViewController.openNode (src/view/GraphViewController.ts ~line 170).
2. Add onEdgeClick on the ReactFlow element (none exists today) -> open EDGE-scoped preview modal for that edge's source->target occurrences.
3. Route modal opening through a seam node components / flow can reach with a Fake for tests - either a new method on GraphUiPort (src/view/viewPorts.ts ~line 173, implemented in src/view/ObsidianGraphUi.ts, pattern: showNodeMenu) or a dedicated port; GraphViewController stays the only view class touching Obsidian + async engine.
4. Update README.md (user-facing interaction model: click = preview, Ctrl/Cmd-click = open) and docs-internal/architecture-map.md if a new port/seam was added.
5. Create a human smoke-run checklist ticket in docs-internal/tickets/ (precedent: docs-internal/tickets/ticket-node-preview-pill-human-smoke-run.md) covering: node modal content, edge modal scoping, expand/collapse buttons, GO for link and for backlink (recenter), Ctrl/Cmd-click still opens note.

## Acceptance Criteria

- Plain node click opens node preview modal; Ctrl/Cmd-click opens note in new tab; edge click opens edge-scoped modal
- Hover preview / right-click pin menu / attachment chip behavior unchanged
- README + architecture map updated; smoke-run ticket filed
- npm test and npm run check pass

## Resolution (2026-07-31)

Completed in commit "Link preview: gesture wiring (node click = preview, ctrl/cmd = open, edge click) + docs" on branch CC_nid_z2k1eebic1nilpz9z3r65cnrx_e__link-preview-gesture-wiring-node-click-edge-click-_fable.

- **Gestures (`src/view/VicinityGraphFlow.tsx`)**: `onNodeClick` branches on `opensInNewTab(event)` — modifier click keeps `controller.openNode(id, {newTab:true})`, plain click calls the new `controller.openNodePreview(id)`. New `onEdgeClick` calls `controller.openEdgePreview(edge.source, edge.target)`.
- **Seam (option "dedicated port")**: new `LinkPreviewPort { showLinkPreview(model) }` in `src/view/viewPorts.ts`. Chosen over a `GraphUiPort` method because the caller is the CONTROLLER (the one class allowed to run the async occurrence queries), not a node component. Implemented by new `src/view/ObsidianLinkPreview.ts`, which hosts `LinkPreviewModal` (one modal per show). `FakeLinkPreview` lives in the controller test.
- **Controller (`src/view/GraphViewController.ts`)**: gains `LinkOccurrenceProvider` + `LinkPreviewPort` deps; `openNodePreview` (Promise.all over outgoing/backlinks + outline read verbatim from the rendered engine node) and `openEdgePreview` (`occurrencesBetween`), both inert for folder-group ids. Stays the only view class touching Obsidian + async engine.
- **Data adapter**: new `src/adapters/LiveLinkOccurrenceProvider.ts` — per-QUERY fresh `ObsidianLinkProvider` snapshot (shared plugin-lived `CanvasParseCache`, so it is cheap) delegating to `ObsidianLinkOccurrenceProvider`; wired in `main.ts` → `VicinityGraphView` (new ctor param).
- **Tests**: 6 new BDD tests in `GraphViewController.test.ts` ("link previews" describe: node model outline/links/backlinks, folder-group guards, edge scoping) + 3 delegation tests in `LiveLinkOccurrenceProvider.test.ts`. `npm test` 1439/1439 green, `npm run check` clean.
- **Docs**: README gained an "Interacting with the graph" section (click = preview, ctrl/cmd = open in new tab, edge click, hover, right-click, inert groups); architecture-map.md documents the `LinkPreviewPort` seam + `LiveLinkOccurrenceProvider`.
- **Smoke run**: filed `docs-internal/tickets/ticket-link-preview-modal-human-smoke-run.md` (8-item human checklist: node modal content, edge scoping, expand/collapse-all buttons, GO for link, GO for backlink incl. recenter, ctrl/cmd-click still opens, unchanged hover/pin/attachment behavior, light+dark).

Unchanged surfaces verified by existing suites: hover preview, right-click pin menu, attachment chips (all `stopPropagation` before reaching the node click handler).
