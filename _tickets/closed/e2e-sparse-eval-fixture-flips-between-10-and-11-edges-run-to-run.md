---
closed_iso: 2026-07-26T06:28:07Z
id: nid_li45606h8uvcnjm7fss17xl1u_e
title: "e2e: sparse eval fixture flips between 10 and 11 edges run-to-run"
status: closed
deps: []
links: [nid_s676x55uojmtcwh9t4l9mc6zl_e]
created_iso: 2026-07-25T03:33:28Z
status_updated_iso: 2026-07-26T06:28:07Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, flaky, edge-routing]
---

Found while running the `EDGE_ROUTING_SHAPE_BUFFER_PX` sweep for edge-routing__06 (`.ai_out/edge-routing__06/main/SWEEP__PUBLIC.md` section 2.2). PRE-EXISTING; not caused by that work.

`e2e/edgeRoutingEval.e2e.ts` renders the `sparse` fixture (central note `note1.md`) and prints an `[eval] force/sparse: ... obstacles=13 edges=N ...` line. **N flips between 10 and 11 across runs of identical code.** During the sweep, buffer 14 produced edges=10 on run 1 and edges=11 on run 2.

This makes the sparse row of the eval harness unusable for before/after comparison: its `maxDetourRatio` tracks the edge count (1.000 when 10, 1.001-1.013 when 11), not the thing under test. One third of the eval harness silently produces numbers that look like a signal and are not.

Suspected cause (NOT investigated): a settle-timing race. `renderFixture` waits for the FIRST edge path to attach and then waits a fixed `page.waitForTimeout(4500)` (`e2e/edgeRoutingEval.e2e.ts`, the fixed settle is deliberate and documented). If the graph is still converging, an edge may or may not be present when the perf entry is logged.

The `medium` and `dense` fixtures showed stable edge counts (20 and 292) across all 12 sweep runs, so this appears specific to sparse -- possibly because it is small enough for a single late edge to matter.

## Design

Investigate before fixing -- do not simply raise the timeout, that is the shaky-solution trap.

Worth checking:
- Is the edge count nondeterministic in the PLUGIN (a race in the rebuild/route pipeline), or only in what the spec OBSERVES? The first is a real bug and matters far more than the eval harness; the second is test-harness only.
- Does the console payload arrive from more than one rebuild pass, with `lastDurations` picking a different one per run? It already selects the heaviest pass by `obstacleCount` -- if two passes tie at 13 obstacles but differ in edges, the selection is arbitrary.

Prefer waiting on a deterministic CONDITION (a settled edge count, or an explicit signal from the view) over a longer fixed timeout.

## Acceptance Criteria

- Root cause identified and stated: plugin-side race vs harness-side observation race.
- `npm run test:e2e -- edgeRoutingEval.e2e.ts` reports the same `edges=` count for sparse across at least 5 consecutive runs.
- If the cause turns out to be plugin-side, file/point at a separate bug ticket -- do not bury a real routing race inside an e2e chore.
- No fixed-timeout increase used as the fix.


## Notes

**2026-07-26T06:13:55Z**

Root cause MEASURED as plugin-side (5/5 correlation between the detected CanvasCapability and edges=10 vs 11); the lastDurations tie-break contributed nothing (only one 13-obstacle pass per window). Plugin bug escalated as nid_s676x55uojmtcwh9t4l9mc6zl_e ([decide]). Harness fixed in e2e/edgeRoutingEval.e2e.ts: index the canvas fixture before measuring (waiting alone is impossible - in fallback sessions the .canvas key NEVER arrives, verified 60s past a settled index), replace waitForTimeout(4500) with a condition-driven settle, and make the tie-break report the LAST heaviest pass while throwing when tied passes disagree. Acceptance met: 5 consecutive runs all report obstacles=13 edges=11 (and identical medium/dense/facing rows). Details: .ai_out/sparse-eval-edge-flake/sparse-eval-edge-flake/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md
