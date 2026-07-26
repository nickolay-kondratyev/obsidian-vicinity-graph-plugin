---
id: nid_8vmo5ibhv1bvh2ukrgmafpofj_e
title: "node sizing: non-finite depthDecayK / minPx / maxPx produce NaN or Infinity node sizes"
status: open
deps: []
links: [nid_a7uwpxayt6w5vdnw8ogwskwvh_e]
created_iso: 2026-07-25T15:58:59Z
status_updated_iso: 2026-07-25T15:58:59Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, settings, robustness]
---

Upstream root cause found while closing `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` (non-finite obstacle geometry aborting the libavoid wasm module). Out dir with evidence: `.ai_out/edge-routing__08-nonfinite-geometry/edge-routing__08-nonfinite-geometry/` (see `EXPLORATION_REACHABILITY_PUBLIC.md` and the ITERATION 2 section of `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`).

`src/engine/NodeSizer.ts:143` (`DepthDecayMetric.normalizedValues`) computes `1 / (1 + this.k * node.minDepth)` with no guard:

- `depthDecayK = -1` and `minDepth = 1` => `1/0 = Infinity` => `Infinity` `sizePx`.
- `depthDecayK = Infinity` and the root note (`minDepth === 0`) => `Infinity * 0 = NaN` => `NaN` `sizePx`. So a guard on the zero denominator alone is NOT enough -- a non-finite `k` must be rejected too.

That `sizePx` flows through `src/view/graphIdentity.ts` `nodeDimensionsPx` into `FlowNode.width/height` and on into rendering.

Second, independent path: `1e999` parses to `Infinity` and passes the settings guards for `minPx` / `maxPx`.

Why the settings layer does not stop it:
- `src/engine/SettingsSpec.ts` declares `depthDecayK` as a bare `DefaultSpec<number>` with no min/max bounds, and there is no `clampSizingSettings` analogous to `clampForceLayoutSettings` in `src/engine/constants.ts`.
- The in-graph React panel `src/view/SizingSection.tsx` guards only against `NaN`, so `-1` and `1e999` pass. (The Obsidian settings tab `src/view/VicinityGraphSettingTab.ts` does clamp `>= min`, so `-1` is rejected THERE -- the React panel is the live entry point.)
- `src/persistence/persistedShapes.ts` `parseSizing` rejects non-finite values only; `-1` is finite and is stored un-clamped.

BLAST RADIUS IS NOW BOUNDED, NOT ZERO: `extractEdgeRoutingInput` (`src/view/edgeRouting.ts`) drops non-finite obstacles as of the linked ticket, so this can no longer kill the wasm module for the session. What remains is the sizing defect itself -- a node rendered at a nonsense size, and its edges silently dropped from routing.

## Design

Clamp/validate at the SETTINGS boundary, mirroring the existing `clampForceLayoutSettings` pattern in `src/engine/constants.ts` (bounds declared in `src/engine/SettingsSpec.ts`, applied on both the persistence-load and UI-write paths), rather than defensively patching `NodeSizer`.

A `DepthDecayMetric` guard is still warranted as the last line of defence, and it must reject a non-finite `k` as well as a zero denominator -- `Infinity * 0 = NaN`.

## Acceptance Criteria

- Pure unit tests on `NodeSizer` proving `sizePx` is finite for hostile `depthDecayK` values (`-1`, `Infinity`, `NaN`) and for non-finite `minPx`/`maxPx`.
- Sizing settings are clamped on the persistence-load path and on the React `SizingSection.tsx` write path.
- `npm run check` and `npm test` green.


## Notes

**2026-07-26T01:21:58Z**

CORRECTION to this ticket's premise, found during the iteration-1 review of branch `sizing-nonfinite-clamp` and confirmed by mutation testing.

The described `depthDecayK = Infinity` -> `Infinity * 0 = NaN` at the root note is NOT reachable. In `src/engine/VicinityTraversal.ts` only traversal ROOTS ever get a depth-0 tag (neighbours are tagged `currentDepth + 1`), and `isCentral` is exactly "is a root". `src/engine/NodeSizer.ts` `computeSizes` gives centrals `CENTRAL_SIZE_SCORE` and skips metric composition entirely, so the `Infinity * 0` product is computed and then discarded. Removing BOTH the new clamp and the `DepthDecayMetric` guard leaves the `k = Infinity` case green.

The defects that WERE real and are now caught by failing-without-the-fix tests: `depthDecayK = -1` (`1/0` -> Infinity at depth 1), `depthDecayK = NaN`, non-finite `minPx`/`maxPx`, and an `Infinity` metric weight (`Infinity/Infinity` -> NaN in the weighted average). The `minDepth === 0 <=> isCentral` coupling that makes the k = Infinity case moot is now pinned by its own test in `src/engine/NodeSizer.test.ts`.
