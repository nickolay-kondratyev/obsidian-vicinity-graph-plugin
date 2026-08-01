---
closed_iso: 2026-08-01T04:42:03Z
id: nid_nsuszxnzggbck1ajwte4mqwzf_e
title: Allow the side panel to be resizable
status: closed
deps: []
links: []
created_iso: '2026-08-01T01:30:57Z'
status_updated_iso: 2026-08-01T04:42:03Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
If its side panel then resize on the side (make it larger smaller).
If its bottom panel then resize on the top (make it larger smaller).

So in both cases there is a resize handle that allows the user to resize the panel. The resize handle should be visible and easy to grab. The handle is towards the side of the graph.

## Resolution (2026-08-01)

Implemented for the link-preview drawer (`LinkPreviewDrawer`), which is the panel that docks to the bottom edge in tall panes and to the right edge in wide panes (container query in `link-preview.css`).

- **Handle on the graph-facing edge**: top edge in bottom-dock mode (drag up/down), left edge in side-dock mode (drag left/right). Both handles are always rendered; the same container query that picks the docking edge shows exactly one, so no JS needs to know the pane's aspect ratio.
- **Visible and easy to grab**: a 10px strip straddling the drawer border (half over the graph) with a centered grip bar (`--background-modifier-border`, accent on hover), `row-resize`/`col-resize` cursors.
- **Keyboard accessible**: the handle is a focusable `role="separator"`; arrow keys nudge by 24px (toward the graph = grow).
- **Bounds**: JS clamp (`src/view/drawerResize.ts`) — min 120px height / 240px width, max 90% of the pane; CSS keeps a `90cqh`/`90cqw` backstop for panes that shrink after the drag.
- **Session memory**: dragged size survives close/reopen via a module singleton (`sessionDrawerSizes`); deliberately NOT persisted to `data.json` (layout state, not a setting).

New files: `src/view/drawerResize.ts` (+ tests), `src/view/DrawerResizeHandle.tsx`. Changed: `LinkPreviewDrawer.tsx`, `link-preview.css`, drawer component tests (6 new rendered-behavior tests). Full suite (1493 tests) + `npm run check` + production build pass.
