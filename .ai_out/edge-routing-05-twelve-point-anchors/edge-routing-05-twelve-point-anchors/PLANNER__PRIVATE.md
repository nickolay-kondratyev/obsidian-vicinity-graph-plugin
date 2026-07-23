# PLANNER__PRIVATE — 12-point edge-routing anchors

## Verdict
Small, well-scoped change. Plan is proportionate. No pushback needed — the request is
coherent and the corner-removal rationale is sound. Selection stays delegated to libavoid;
we only edit the candidate pin set + constants.

## Key reasoning locked in
- **Existing facing-side tests (234–262) pass unchanged.** Geometry is cross-axis ALIGNED
  (horiz: both y=0; vert: both x=0), so straight shot is level with the 0.5 midpoint pin.
  Adding 0.25/0.75 pins doesn't beat 0.5 for aligned boxes → midpoint still chosen → MID_SPAN_TOL_PX=10
  assertions still hold. Verified by reading test source. Told IMPLEMENTATION NOT to loosen tol if red.
- **Corner test needs DIAGONAL offset** to be meaningful (aligned geometry never tempts a corner).
  Chose boxL(0,0,100,100) + boxR(300,300,100,100). Assert minCornerDistance > 12px
  (quarter pins are 25px from corner, corners 0px → 12 cleanly separates).
- **Unit spec test is the durable anchor** (pure, fast). Requires exporting BOUNDARY_PIN_SPECS.
- Corners = both fracs ∈ {0,1}. Quarter/mid pins have exactly one extreme coord.

## Stale-doc hotspots to fix (say "8"/"corner")
- edgeRouting.ts RoutingObstacle.kind JSDoc (~lines 29–37): "the 8 boundary pins".
- BOUNDARY_PIN_SPECS array doc (~196–210): "eight … four side-midpoint … four corner".
- registerPinsForShape JSDoc (~249): "get the 8 {@link BOUNDARY_PIN_SPECS}".
- architecture-map.md + high-level-plan.md: confirmed NO 8/corner detail → no change.

## New constants
PIN_EDGE_Q1 = 0.25, PIN_EDGE_Q3 = 0.75, beside PIN_EDGE_MIN/MID/MAX (~180). Extend block comment.

## Open (non-blocking) question flagged to human
Exact diagonal offset is a tuning choice; corner-clearance assertion is the real contract so any
reasonable offset passes. Optional stronger "quarter pin used" assertion left out for KISS.
