---
closed_iso: 2026-07-31T18:28:36Z
id: nid_zxnhehkpoj3q2peirauby6w4q_e
title: Fix the styling for embeds
status: closed
deps: []
links: []
created_iso: '2026-07-31T18:24:16Z'
status_updated_iso: 2026-07-31T18:28:36Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Right now the embedded styling of edges makes it look embeds weaker than regular nodes. 

Let's go back to embeds just having a regular line as regular links for now.

## Resolution

Embed edges now render with the same solid stroke as regular link edges.

- `src/view/graph-view.css`: removed the `stroke-dasharray` rules for
  `--kind-embed` (dashed) and `--kind-both` (dash-dot); all edge kinds share
  the default solid stroke. The per-kind wrapper classes
  (`vicinity-graph-edge--kind-*`, `edgeKindClassName`, `EDGE_KIND_CLASS`)
  are kept as the CSS seam for any future restyle — CSS-only change, no
  TS behavior touched.
- Doc comments referencing the old dashed vocabulary updated in
  `src/view/flowMapping.ts` and `src/engine/CrossLinkSweep.ts`.
- Verified: `npm run build` clean; `npm test` 1341/1341 passed; generated
  `styles.css` no longer contains the `kind-embed`/`kind-both` dash rules.

## Resolution

Embed edges now render with the same solid stroke as regular link edges.

- `src/view/graph-view.css`: removed the `stroke-dasharray` rules for
  `--kind-embed` (dashed) and `--kind-both` (dash-dot); all edge kinds share
  the default solid stroke. The per-kind wrapper classes
  (`vicinity-graph-edge--kind-*`, `edgeKindClassName`, `EDGE_KIND_CLASS`)
  are kept as the CSS seam for any future restyle — CSS-only change, no
  TS behavior touched.
- Doc comments referencing the old dashed vocabulary updated in
  `src/view/flowMapping.ts` and `src/engine/CrossLinkSweep.ts`.
- Verified: `npm run build` clean; `npm test` 1341/1341 passed; generated
  `styles.css` no longer contains the `kind-embed`/`kind-both` dash rules.
