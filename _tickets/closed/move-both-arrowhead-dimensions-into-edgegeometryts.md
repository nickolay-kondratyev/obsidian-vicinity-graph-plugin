---
closed_iso: 2026-07-29T18:43:12Z
id: nid_sw50n310je164zf8psqig77a9_e
title: move both arrowhead dimensions into edgeGeometry.ts
status: closed
deps: []
links: []
created_iso: '2026-07-25T04:35:13Z'
status_updated_iso: 2026-07-29T18:43:12Z
type: chore
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [refactor, edge-rendering]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
Pre-existing SRP split, made newly load-bearing by edge-routing__06.

`ARROWHEAD_HALF_WIDTH_PX` and `ARROWHEAD_LENGTH_PX` live in the React component `src/view/VicinityEdge.tsx`, while their sibling `EDGE_ARROWHEAD_INSET_MIN_PX` lives in `src/view/edgeGeometry.ts` -- a React-Flow-free, node-testable module whose docblock already claims "pure SVG path math for the custom graph edge".

edge-routing__06 made the split matter: it exports the half-width as the FLOOR of the edge-routing clearance clamp, so `src/view/edgeRouting.test.ts` now imports a React component file purely to read a geometry number. Three constants describing one arrowhead should have one home, and that home is the pure-geometry module, not the component.

No behaviour change -- this is a move plus import updates.

## Acceptance Criteria

- `ARROWHEAD_HALF_WIDTH_PX` and `ARROWHEAD_LENGTH_PX` live in `src/view/edgeGeometry.ts` alongside `EDGE_ARROWHEAD_INSET_MIN_PX`; `src/view/VicinityEdge.tsx` imports them.
- `src/view/edgeRouting.test.ts` no longer imports from a `.tsx` component file.
- No rendered geometry changes: `npm run check` and `npm test` green, and the settings/edge e2e visual specs stay green.

## Resolution (2026-07-29, commit `44edd55`)

Pure move + import updates, no value or behaviour change.

- `ARROWHEAD_LENGTH_PX` (11) and `ARROWHEAD_HALF_WIDTH_PX` (6) now live in `src/view/edgeGeometry.ts`, directly below `EDGE_ARROWHEAD_INSET_*`. The half-width docblock moved with it, minus the now-obsolete "exported, not module-private" clause.
- `src/view/VicinityEdge.tsx` imports both from `./edgeGeometry`; it no longer declares or re-exports either.
- `src/view/edgeRouting.test.ts` imports `ARROWHEAD_HALF_WIDTH_PX` from `./edgeGeometry` — no `.tsx` import remains.
- `npm run check` clean; `npm test` green (85 files / 1140 tests). E2E not run in this container (no Obsidian binary); change is a constant relocation with identical values, so rendered geometry is unchanged by construction.
