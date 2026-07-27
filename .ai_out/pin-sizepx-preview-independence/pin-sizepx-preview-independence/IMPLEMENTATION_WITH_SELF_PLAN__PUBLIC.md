# IMPLEMENTATION — pin the sizePx / nodePreviewPreference independence invariant

Ticket `nid_f8csd65emmy6p62ad9x5w1psz_e` (closed via `ticket close`).
**Test-only change. No production code touched.**

## What was added

1. `src/engine/NodeSizer.test.ts` — new block
   `describe("NodeSizer node preview preference independence")`, one test:
   *WHEN only nodePreviewPreference varies THEN every node keeps the same sizeScore and sizePx*.
   Iterates `NODE_PREVIEW_PREFERENCES` (so a fourth value is covered for free),
   builds a full `ViewSettings` per preference off `EngineDefaults.viewSettings()`,
   and asserts a per-preference keyed map equals the baseline (single assert; the
   keying makes a failure name the offending preference).

2. `src/engine/VicinityEngine.test.ts` — new block
   `describe("VicinityEngine sizing ignores the node preview preference")`, one test:
   *WHEN two builds differ ONLY in nodePreviewPreference THEN every node's sizePx is identical*.
   Reuses the existing `build()` helper, varies only `globalView.nodePreviewPreference`,
   compares `{path, sizePx}` per node. This covers the real
   `ViewSettingsResolver → NodeSizer` seam.

Both carry a WHY comment (relayout threshold / data-only refresh) and the
NodeSizer one carries the WHY-NOT for `GraphStructureDiff.test.ts`.

## Key design decision: making the NodeSizer test non-tautological

`NodeSizer.computeSizes(nodes, SizingSettings)` structurally cannot see the
preference today, so a naive test would pass vacuously forever. The helper
therefore hands the sizer a settings object that **deliberately carries the
preference** (`{ ...viewSettings.sizing, nodePreviewPreference }`). A future
sizer that widens its parameter to read that field goes RED here — which is
exactly the regression shape the ticket is guarding.

## Judgment call: no `nodeDimensionsPx` guard in `src/view/graphIdentity.test.ts`

Declined. `nodeDimensionsPx(node: GraphNode)` takes no settings at all — there is
no preference in scope to vary, so any test there would assert `f(x) === f(x)`.
Zero signal, permanent maintenance. Gold-plating avoided.

## Verification (all run, output in `.tmp/`)

- `npm test` → 76 files / **1013 tests passed**.
- `npm run check` → exit 0 (strict tsc for `src/` and `e2e/`).
- **MUTATION-VERIFY** — temporary hack applied to production code:
  - `NodeSizer.computeSizes` param widened to
    `SizingSettings & { nodePreviewPreference?: string }` and, for `"image"`,
    `maxPx` doubled.
  - `VicinityEngine` changed to pass
    `{ ...viewSettings.sizing, nodePreviewPreference: viewSettings.nodePreviewPreference }`
    (the literal "routed viewSettings wholesale" regression).
  - Observed: **exactly the 2 new tests failed**, 52 others in those two files
    stayed green. Hack reverted with `git checkout --`; full suite re-run green.

## Reviewer notes

- No `change_log` entry written (TOP_LEVEL_AGENT owns that).
- Committed on `pin-sizepx-preview-independence`; no other branch touched.
