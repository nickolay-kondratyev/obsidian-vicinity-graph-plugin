# Canvas vs note: how a node shows its file kind

**Decision:** a `.canvas` node draws Obsidian's own canvas icon (`layout-dashboard`,
muted, 12px) inline before its title; a markdown note draws **nothing**.

**Why**
- A canvas title is a bare basename, so `plan.md` and `plan.canvas` rendered as two
  identical "plan" boxes (`.out/node-file-kind-BEFORE.png`).
- Mark the minority: notes are the overwhelming default. A glyph on every node is
  noise that marks nothing, and fights the "collapse, don't multiply" principle.
- Familiar beats clever: it is the icon Obsidian already shows for canvas tabs/files.
- Inline (not a corner badge) so it never overlaps the title on a narrow node. The
  engine width estimate budgets it (`NODE_TITLE_KIND_ICON_PX`), so short canvas
  titles stay on one line.
- Hover tooltip reads `plan (canvas)`; screen readers hear "Canvas".

**Rejected**
- Dot-grid "canvas" background on the node: the graph pane itself is a dot grid, so
  the node read as a transparent hole.
- Different border/shape: border style is already spent on the tier (MAIN solid,
  pinned dashed).
- A "CANVAS" text tag (file-explorer style): costs ~50px of title width per node.

**Open question for you:** should notes also get a (note) icon, for symmetry?
Recommendation: no, for the noise reason above.

Screenshots: `.out/node-file-kind-canvas-vs-note.png`, `.out/node-file-kind-canvas-main-dark.png`
(regenerate with `npm run test:e2e -- nodeFileKind.e2e.ts`).
