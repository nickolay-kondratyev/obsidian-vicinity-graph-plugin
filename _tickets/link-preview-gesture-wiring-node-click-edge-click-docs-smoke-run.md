---
id: nid_z2k1eebic1nilpz9z3r65cnrx_e
title: 'Link preview: gesture wiring (node click, edge click) + docs + smoke run'
status: in_progress
deps: [nid_tpghu4nsbt08slhm2vannrnqw_e]
links: []
created_iso: '2026-07-31T18:49:32Z'
status_updated_iso: '2026-07-31T20:15:35Z'
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
