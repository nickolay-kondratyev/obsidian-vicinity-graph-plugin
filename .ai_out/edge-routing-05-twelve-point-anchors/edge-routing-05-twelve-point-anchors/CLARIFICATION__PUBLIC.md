# CLARIFICATION__PUBLIC — 12-point edge routing anchors

## Task (from human)
Change node boundary routing points from **8** (4 corners + 4 side-midpoints) to **12**
(each side gets 3 points at 1/4, 2/4, 3/4 along it; **corners removed**). Layout:
```
--*--*--*--
|          |
*          *
|          |
*          *
|          |
*          *
|          |
--*--*--*--
```
**WHY:** at a corner, an edge can visually look like it continues *past* the node even
though it terminated at the node. Side-only anchors avoid that ambiguity.

## Resolved decisions
1. **Scope: GROUP BOXES ONLY.** Only `folder-group` obstacles get the 12 points.
   Note squares keep their single centre pin (`CENTRE_PIN_SPEC`) — preserves the
   perf-driven group-only decision from edge-routing__04 (no perf risk revived).
2. **New quarter pins (0.25 / 0.75) use OUTWARD-PERPENDICULAR direction** — same
   `dir` convention as the existing side-midpoints (top→"up", right→"right",
   bottom→"down", left→"left"). Edges attach square-on.
3. **12 = 4 sides × {0.25, 0.5, 0.75}, corners removed.** Midpoint (0.5) retained.
4. No cost-model / routing-algorithm change intended. Change is localized to
   `BOUNDARY_PIN_SPECS` + new fraction constants in `src/view/edgeRouting.ts`.

## Impact notes for downstream phases
- Facing-side attachment tests (`edgeRouting.test.ts:200-260`, `MID_SPAN_TOL_PX=10`)
  assert endpoints land near the SIDE MIDPOINT. With 12 pins the router may now pick a
  1/4 or 3/4 pin for offset geometry; assertions may need reframing (e.g. "on the facing
  side, at one of the 3 valid pin positions, never a corner"). PLANNER to specify.
- Corner-removal is the core behavioral guarantee to test: **no route endpoint attaches
  at a box corner** (both fracs extreme). Add a test capturing this.
