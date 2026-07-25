# TOP_LEVEL_AGENT — edge-routing__08-nonfinite-geometry

Ticket: `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` — non-finite obstacle coordinates abort the wasm module
inside `processTransaction`. **CLOSED.**

Branch: `edge-routing__08-nonfinite-geometry` (from `main`).
Out dir: `.ai_out/edge-routing__08-nonfinite-geometry/edge-routing__08-nonfinite-geometry/`

## Flow record

- [x] Branch + out dir created.
- [x] EXPLORATION — two read-only agents (input path, reachability). Neither could write files;
      TOP_LEVEL_AGENT persisted their reports as `EXPLORATION_PUBLIC.md` /
      `EXPLORATION_REACHABILITY_PUBLIC.md`.
- [x] IMPLEMENTATION_WITH_SELF_PLAN — guard landed (`d3aa331`).
- [x] IMPLEMENTATION_REVIEW — verdict READY, no blocking items; two SHOULD-FIX comment-honesty items.
- [x] IMPLEMENTATION_ITERATION 2 — both SHOULD-FIX incorporated, one NICE-TO-HAVE incorporated,
      two rejected with rationale (`85ad6bd`). Reviewer confirmed convergence, verdict READY,
      and did not re-litigate the rejections.
- [x] Follow-up ticket filed: `nid_8vmo5ibhv1bvh2ukrgmafpofj_e` (upstream sizing defect), linked.
- [x] `change_log` entry `8nn12g4ymdho1idw1hxega6ap`.
- [x] Ticket closed with resolution note; branch merged to `main`.

## Outcome

`extractEdgeRoutingInput` drops obstacles with non-finite x/y/widthPx/heightPx; the dropped id never
enters `obstacleIds`, so referencing edges are dropped by the pre-existing pass (required — `route()`
throws on an edge with no registered shape). Zero/negative-size rects still accepted.

Reachability: REACHABLE, but via node SIZING (`src/engine/NodeSizer.ts` depth-decay division), not
via the layout runners the ticket suspected. That upstream defect is the follow-up ticket.

Gates: `npm run check` exit 0; `npm test` exit 0 — 68 files / 916 tests, 0 failed, 0 skipped.
Verified independently by IMPLEMENTATION_REVIEWER, not only self-reported.
