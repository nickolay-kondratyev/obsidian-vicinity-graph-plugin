---
closed_iso: 2026-08-05T18:50:21Z
id: nid_xvuptvuct2b9uget7oc2asyif_e
title: toogle interactivity button in react flow graph doesnt do anything right?
status: closed
deps: []
links: []
created_iso: '2026-08-05T18:45:06Z'
status_updated_iso: 2026-08-05T18:50:21Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Look into whether toggle interactivity button right now that comes with react flow actually does NOT do anything right now? 

IF it doesnt do anything remove it.

## Resolution (2026-08-05) — removed

Confirmed: the lock button could NOT deliver interactivity here, and its only
observable effects were unintended. Removed via `<Controls showInteractive={false} />`
in `src/view/VicinityGraphFlow.tsx`; zoom-in / zoom-out / fit-view stay.

### What the button actually does (verified in `@xyflow/react` 12 dist)

`onToggleInteractivity` only writes three STORE flags —
`nodesDraggable` / `nodesConnectable` / `elementsSelectable`. In this graph:

- **Dragging — dead.** `NodeRenderer` drills the ReactFlow **prop**
  (`props.nodesDraggable ?? true`) into every `NodeWrapper`, not the store value.
  We pass `nodesDraggable={false}`, so nodes stay undraggable no matter what the
  store says. This is the button's headline function, and it is a no-op.
- **Connecting — nothing wired.** No `onConnect`/`onConnectEnd`; the handles are
  decorative edge anchors. Unlocking only re-arms them as connectable, letting a
  drag paint a connection line that can never create anything.
- **Selecting — filtered out.** `onNodesChange` applies ONLY `dimensions` changes
  (the resize gesture); select changes are dropped by design, so RF's `selected`
  never lands.

Net observable behavior of the button: `elementsSelectable` defaults to `true`, so
the graph shipped showing the *unlocked* icon; clicking it dropped the
`selectable` class from edges (losing the pointer cursor — edges stayed clickable,
since `inactive` requires no `onClick`) and clicking again re-armed the handles.
A control promising interactivity it cannot grant.

### Change + coverage

- `src/view/VicinityGraphFlow.tsx` — `<Controls showInteractive={false} />` plus a
  WHY comment recording the prop-vs-store detail above.
- `e2e/vicinityGraph.e2e.ts` — new failing-first test: no
  `button.react-flow__controls-interactive`, while fit-view and zoom-in remain.
  Verified failing before the change, passing after.
- `npm run check`, `npm test` (1647 tests), `npm run test:e2e -- vicinityGraph.e2e.ts`
  (26 tests) all green. The `.react-flow__controls-button:last-child` CSS rule is
  unaffected — fit-view simply becomes the last child.
