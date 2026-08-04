---
closed_iso: 2026-07-31T18:07:45Z
id: nid_rg7fctr9gvm14ih5yu0yxtdwh_e
title: Improve the visualization of the outline in the nodes
status: closed
deps: []
links: []
created_iso: '2026-07-31T18:02:19Z'
status_updated_iso: 2026-07-31T18:07:45Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Use the '/Users/nkondrat/vintrin-env/config/claude/ai_input/deep/my-frontend-design.md' and general UI knowledge to improve how the note outline component renders in the vicinity graph so it looks more polished instead of current look.

## Resolution (2026-07-31)

CSS-only polish of `src/view/node-outline.css` (commit `5c12a11`); no JSX/engine
changes, visibility ladder in `src/view/graph-view.css` untouched. Applied the
design-memory craft rules to the previously flat list (all rows same
size/weight/color, invisible 8px indent, no separation from the title):

- **Section edge**: hairline `border-top` + 4px `padding-top` on the scroll
  container — the outline now reads as a distinct "contents" section (Gestalt
  enclosure) and the hairline doubles as a fixed edge while entries scroll.
- **Indent guides**: nested lists get `border-inline-start` in
  `--background-modifier-border` (4px margin + 1px guide + 4px padding ≈ the old
  8px step). Same affordance as Obsidian's own Outline pane (Jakob's Law); the
  guide lands exactly under the parent row's text start.
- **Hierarchy via weight**: top-of-tree entries get `--font-medium`; nested rows
  stay 400. Weight was the only free lever — size is at the floor
  (`--font-smallest`) and color tiers are taken by the title.
- **Micro-polish**: 1px vertical row padding (row ≈ 18px, still 3 rows at the
  104px density threshold) and the node's shared 0.12s hover transition.

All colors remain Obsidian theme variables (light/dark/community themes work).

**Verified**: `npm test` 1342/1342 green (also repaired the dev env — `jsdom`
was missing from `node_modules`; `npm install` fixed it, restoring the 3
component-test suites), `npm run check` clean, `npm run build` clean. Pixel
verification in a real Obsidian was not possible in this sandbox (no cached
Obsidian/Playwright browsers); the Playwright outline e2e asserts DOM/behavior
only and is unaffected — the release-gate `npm run test:e2e` run will exercise
it as usual.
