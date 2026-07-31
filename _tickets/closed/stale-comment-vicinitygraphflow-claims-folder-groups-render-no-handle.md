---
closed_iso: 2026-07-29T18:37:52Z
id: nid_ub30ndqyp6ikq76hv4ba6yqss_e
title: 'Stale comment: VicinityGraphFlow claims folder groups render no Handle'
status: closed
deps: []
links: [nid_var2o7krxq7ribq3iofni3aw1_e]
created_iso: '2026-07-27T21:23:08Z'
status_updated_iso: 2026-07-29T18:37:52Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [view, docs]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
`src/view/VicinityGraphFlow.tsx:96-99` justifies `onlyRenderVisibleElements` with "group parents render no <Handle>, so React Flow's `forceInitialRender` (keyed on missing handleBounds) keeps them always mounted".

That is no longer true: `src/view/FolderGroupNode.tsx:26-31` and `:45-50` DO render hidden, non-connectable target/source `<Handle>`s (added so collapsed group edges can anchor to the box). If RF now measures handleBounds for group parents, `forceInitialRender` no longer applies and a scrolled-away group container could be culled out from under its children.

Spotted while implementing side-aware straight-edge anchoring (ticket nid_var2o7krxq7ribq3iofni3aw1_e); left untouched there because the culling rationale needs verifying, not just the comment rewriting.

## Acceptance Criteria

Either the comment is corrected to describe the REAL reason group parents stay mounted, or (if the rationale no longer holds) the culling behaviour is fixed and covered by a test/e2e check.

## Resolution (2026-07-29) — comment corrected; no product defect

The ticket's premise was right (the `forceInitialRender` rationale is dead — folder
groups DO render `<Handle>`s now), but the **conclusion it feared is not**: culling a
group container cannot orphan its members, for a different reason.

Verified against the pinned `@xyflow/react` 12.11.2 in `node_modules`:

- `NodeRenderer` (`react/dist/esm/index.js:2363`) renders **every** visible node as a
  flat sibling inside one `.react-flow__nodes` div, each positioned by
  `transform: translate(internals.positionAbsolute…)` (`:2344`). Subflow members are
  **not** DOM children of their container — so unmounting the container removes only
  the container box.
- `getNodesInside` (`system/dist/esm/index.js:354-381`) is called with `partially=true`
  (`react/…:2114`), so a node is kept whenever it overlaps the pane at all. A group box
  therefore only unmounts once it is fully off-pane, by which point its members (which
  sit inside its rect) are off-pane too.

Changes:

- `src/view/VicinityGraphFlow.tsx` — replaced the stale `forceInitialRender` justification
  with the flat-sibling / `positionAbsolute` one.
- `docs-internal/tickets/ticket-viewport-culling-visual-smoke.md` — carried the same stale
  rationale; updated, including its "guard against RF-internal fragility" item, which now
  points at the real upgrade risk (RF nesting group members under their container).

No behaviour change, so no new test. The runtime culling smoke/e2e net remains tracked by
`ticket-viewport-culling-visual-smoke.md` (pre-existing, still open by design).
`npm run check` and `npm test` (1140 tests) pass.
