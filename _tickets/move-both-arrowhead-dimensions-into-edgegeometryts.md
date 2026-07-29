---
id: nid_sw50n310je164zf8psqig77a9_e
title: move both arrowhead dimensions into edgeGeometry.ts
status: in_progress
deps: []
links: []
created_iso: '2026-07-25T04:35:13Z'
status_updated_iso: '2026-07-29T18:39:59Z'
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
