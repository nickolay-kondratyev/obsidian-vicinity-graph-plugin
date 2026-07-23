# CLARIFICATION — edge-routing__04

## Verdict: No blocking questions. Proceed automatically.

The ticket fully specifies the plan, endpoint positions, visDirs assignment, perf gate, fallback,
and STOP condition. Design decisions are pre-made by the ticket author. No ambiguity requiring human
input.

## Confirmed alignment / decisions inherited from ticket
1. **Scope = Phase A + Phase B.** Phase C (line-of-sight shortcutting) explicitly out of scope.
2. **8 pins/shape** (4 side-midpoints + 4 corners), all sharing the pin class id.
3. Side-midpoint pins get facing `ConnDir*`; corner pins keep `ConnDirAll`.
4. `insideOffset = 0` (unchanged from current centre pin).
5. `clipRouteToEndpointRects` kept unchanged.
6. Detour ratio computed on the CLIPPED polyline = arc length ÷ endpoint chord length.
7. Radial layout remains routing-skipped.
8. Perf gate + fallback (group-only pins) per ticket.

## STOP escalation (already agreed with human via task)
If after Phase A the repro edges are still visibly roundabout, OR the routing pass exceeds perf
budget even with group-only pins → STOP and report; do not improvise alternatives.
