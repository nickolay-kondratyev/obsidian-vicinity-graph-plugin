---
closed_iso: 2026-08-01T01:31:33Z
id: nid_tiitgrp5bt7g2niwcvthxw1jk_e
title: Links side panel to render well for multi links and group nodes.
status: closed
deps: []
links: []
created_iso: '2026-08-01T00:55:11Z'
status_updated_iso: 2026-08-01T01:31:33Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now when we click on the link visual that has multiple links collapsed into a single visual, we do not get a side panel with the links.

This is the request so that side panel works for multi links and links that are coming out of group nodes. When the side panel opens for such scenarios it should be clear from where to where the links are going for (in case of group nodes), we should visually group the elements where to where they are going. 

It should also work nicely when its just node to node, and we have mulitple links between them.

## Resolution (2026-07-31)

Implemented: clicking ANY edge visual now opens the link-preview side panel, including group-collapsed edges (edges into/out of folder-group boxes) and bidirectional collapsed edges.

**How it works:**
- `FlowEdge` (`src/view/flowMapping.ts`) now carries `notePairs` — the engine note→note pairs behind each rendered edge (one for a plain edge; every contributor, both directions, for a group-collapsed edge).
- Edge clicks pass the rendered edge **id** (`VicinityGraphFlow.tsx`); `GraphViewController.openEdgePreview(edgeId)` looks the edge up in the published snapshot, queries `occurrencesBetween` per contributing pair, and builds the model. The old "folder-group endpoint ⇒ show nothing" guard is gone.
- `EdgePreviewModel` (`src/view/linkPreviewModel.ts`) is now grouped: one `EdgePairGroupModel` per contributing pair, sorted by (source, target) path, plus display endpoint names (`edgeEndpointDisplayName`: note title, or folder name for a group endpoint) and a `bidirectional` flag.
- Rendering (`LinkPreviewContent.tsx`): a single pair renders flat (drawer title already names from→to); several pairs each get a "source → target" header with a count pill (reuses the backlink-group styles). GO buttons target each pair's own source note. Drawer title (`LinkPreviewDrawer.tsx`) uses the endpoint names, joined with "↔" for bidirectional collapsed edges.

Node-to-node multi-link edges keep working: one pair, flat occurrence rows (count = number of links).

Covered by unit tests at every layer (flowMapping notePairs, model grouping/sorting/row-id uniqueness, controller collapsed-edge preview, rendered component group headers/GO targets, drawer titles). `npm run check`, `npm test` (1476 passing) and `npm run build` all green. Note: rowIds changed shape (`edge:<pair>:<row>`) — transient UI state only, nothing persisted.
