---
closed_iso: 2026-08-01T00:46:31Z
id: nid_lfcyfbrggrusyv8xn1aroc7h1_e
title: Make the click on the node in the graph focus on that node
status: closed
deps: []
links: []
created_iso: '2026-08-01T00:37:33Z'
status_updated_iso: 2026-08-01T00:46:31Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Lets make the click on the node focus the node in the graph.

When the node is clicked it should become the focused node, instead of the fly out happening for that node.

## Resolution (2026-08-01)

Done. A plain click on a note node now makes it the graph's MAIN (the graph
re-centers on it) instead of opening the node flyout.

- `GraphViewController.focusNode(path)` (`src/view/GraphViewController.ts`): sets
  `mainPath` and reruns the rebuild pipeline. Folder-group ids are inert; clicking
  the current MAIN is a no-op. The editor's active file is NOT touched — focusing
  is a graph-only gesture, and the next active-file change re-takes MAIN as usual
  (Obsidian-follows behavior unchanged).
- `VicinityGraphFlow.tsx` `onNodeClick`: plain click → close any open preview
  drawer (same rule as pane click) + `focusNode`; ctrl/cmd-click still opens the
  note in a NEW tab (unchanged).
- Edge click → edge preview drawer is unchanged.

Tests:
- Unit (`src/view/GraphViewController.test.ts`, "node focus" block, written
  failing-first): rebuild centered on the clicked node; note NOT opened; MAIN
  re-click and folder-group id are no-ops; a later active-file change to the
  focused path is a no-op.
- e2e (`e2e/vicinityGraph.e2e.ts`): replaced the stale "clicking a node opens
  that note in the current tab" spec with "clicking a node makes it the graph's
  MAIN without opening its note" (asserts `data-tier="main"` on the clicked node
  and an unchanged active file). Full spec file passes against real Obsidian
  (21/21); `npm test` 1455/1455; `npm run check` clean.

Follow-up: the node-scoped preview flyout machinery (`openNodePreview`,
`LinkPreviewModels.node`, outgoing/backlink occurrence queries) now has no UI
trigger. Kept intact pending human decision — ticket
`nid_k0yntdzrpfhh1hyx3af6bjkdf_e` (tag `decide`: remove it vs. rebind to another
gesture).
