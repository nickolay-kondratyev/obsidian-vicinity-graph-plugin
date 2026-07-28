# CLARIFICATION — compact group layout

Ticket: `_tickets/nodes-in-groups-folder-to-be-tighther-together.md` (nid_uzwco7e4y2bw5vzfk5vhs814a_e)
Goal: nodes inside folder groups should pack tighter — use space more frugally.

## Aligned decisions (HUMAN approved)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Switch group-interior layout from elk `layered` to elk `rectpacking`** | `layered` optimizes edge flow, not density. Its routing output is DISCARDED (repo routes edges itself via `edgeRouting.ts`/libavoid — no `sections` read anywhere in `src/view`), so its cost is paid for no benefit. `rectpacking` is purpose-built for densely packing heterogeneous rectangles. |
| D2 | **Use `elk.aspectRatio`** to keep group boxes a pleasing shape rather than long strips | Direct control over box shape; smaller boxes also shrink the collision rectangle fed to the root d3 pass (compounding win). |
| D3 | **Keep ONE spacing knob for now** (`forceLayout.elkNodeSpacingPx`) — do NOT split intra-group vs root spacing yet | KISS / Pareto. Ship the algorithm change, observe, then decide. Splitting is a follow-up ticket if needed. |
| D4 | **Scope is the group INTERIOR only** | No change to root force/d3 pass, group padding, node sizing, or edge routing. |
| D5 | Accepted trade-off: for folders whose members link to each other, internal edges lose their top-to-bottom "flow" reading | Judged small: those edges render as libavoid curves anyway, not clean layered orthogonals. |

## Explicitly REJECTED alternatives

- **Tune `layered`** (aspectRatio + tighter layer spacing): caps at ~15-25% and cannot fix the pathological case — members with no intra-group links all collapse into ONE layer, producing a single very wide strip. That is layer assignment, not spacing.
- **C4 "members join the force simulation"** (from `docs-internal/research/research-layout-aesthetics.md`): globally optimal but replaces elk's container sizing wholesale and puts the overlap-freedom + containment guarantees locked by `D3ForceLayout.test.ts` back in play. Keep as follow-up ONLY if rectpacking underdelivers.

## Constraints the implementation MUST respect

- `GROUP_SIDE_PADDING_PX = 16` is a load-bearing CEILING for edge-routing clearance (`edgeRouting.test.ts`, edge-routing__06 §4). Do not shrink it as part of this work.
- Node rectangles are heterogeneous (height from link/size metrics via `NodeSizer.ts`; width from title length, capped 250px) — packing must not assume uniform cells.
- Existing guarantees to preserve: members stay strictly INSIDE their container; zero AABB overlaps; layout determinism (`ElkLayout.test.ts`, `D3ForceLayout.test.ts`).
- Root layout stays elk `force` + d3 refinement. `SEPARATE_CHILDREN` remains in force (elk `force` does not support `INCLUDE_CHILDREN`).

## Success criteria

- A new test asserts **packing density / bounding-box efficiency** inside a group improves — no such test exists today (all current assertions are overlap-freedom, containment, determinism).
- Specifically: a folder of N members with NO intra-group edges must NOT lay out as a single row.
- All existing tests pass unchanged. `npm run check` clean.

See `EXPLORATION_PUBLIC.md` for the code map (files, line numbers, constants, test inventory).
