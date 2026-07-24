# Research (parked): crossing penalty & web-worker routing offload

Deliberately NOT ticketed (2026-07-24 decision): the near-term aesthetics work
is the facing-side attachment fix (`edge-routing__05`, closed as a negative
result → its surviving levers are `edge-routing__06`). This note
preserves the findings so the decision can be revisited with full context.
Companion investigations: `./research-layout-aesthetics.md` and
`./facing-side-edge-attachment.md`.

## Why this matters at all

Empirical graph-drawing research (Purchase et al., GD'95 → AUIC 2010) ranks
**edge crossings as by far the most important aesthetic** for comprehension —
ahead of bends, symmetry, edge-length uniformity, and angular resolution. Our
`EDGE_ROUTING_CROSSING_PENALTY_PX = 0` therefore disables the single
highest-value quality knob in the routing stack.

## Why it is off: the perf cliff

Measured in the edge-routing__03 tuning pass (dense fixture, ~100 nodes /
~292 edges, main thread):

| crossingPenalty | routing pass |
|---|---|
| 0 | ~140ms |
| 100 | ~1700ms (worse than the entire elk+d3 layout, ~1460ms) |

The crossing check is ~O(connectors²) and is incurred for **any positive
value** — it is a cliff, not a slope. "A small penalty" does not buy a small
cost. On the main thread (Obsidian's Electron renderer = UI thread), 1.7s per
relayout is an unacceptable freeze.

## Path A (cheap, no infrastructure): size-gated penalty

Enable `crossingPenalty` only when the routing input is small enough that the
pass stays within budget (threshold on edge/obstacle count, calibrated on the
dev-vault fixtures — target e.g. ≤200ms). Typical vicinities are far smaller
than the dense fixture, so most users get crossing minimization for free;
dense graphs keep today's behavior. Zero new infrastructure; one named
threshold constant + a measurement pass.

## Path B (full fix): web-worker routing offload

A worker does not make routing faster — it makes the cost not block the UI:
publish straight/cheap routes immediately, swap in routed edges when the
worker finishes (same UX pattern as today's lazy wasm load).

Implementation notes for this repo:
- Single-file `main.js` bundle → the worker script must be inlined (blob URL /
  data URL) via esbuild, and the libavoid wasm (already inlined as base64)
  must be loaded INSIDE the worker.
- Latest-wins already exists (`rebuildToken`); async route arrival slots into
  the existing `resolveRoutes` → publish flow with one extra publish.
- Bonus if built: elkjs has native worker support — the whole elk+d3 layout
  pass could move off-thread too, making ALL rebuilds non-blocking.
- Prior art: closed ticket `edge-routing: re-enable radial routing via
  web-worker offload` (nid_si26o1o5h4yrvv5v8tcgz1b68_e) explored offload
  before radial routing was removed.

## Related parked options (see companion note, section C)

- **Orthogonal routing mode** would unlock libavoid's nudging/shared-path
  stack (`idealNudgingDistance`, `nudgeOrthogonalSegmentsConnectedToShapes`,
  `fixedSharedPathPenalty`) — the designed fix for shared corridors — but is
  a visual-style decision (right-angle circuits vs organic lines).
- ~~**`clusterCrossingPenalty` + ClusterRef group boxes**~~: **infeasible on
  the pinned `libavoid-js@0.4.5` — `Avoid::ClusterRef` is not bound** (verified
  2026-07-24). Needs a WebIDL/wasm rebuild before it can even be measured.

## Revisit triggers

- Crossing clutter remains a complaint after `edge-routing__06` ships.
- A perf pass finds typical-vault routing headroom (Path A becomes ~free).
- Any other feature needs worker infrastructure anyway (amortizes Path B).
