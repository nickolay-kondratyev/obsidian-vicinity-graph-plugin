# TOP_LEVEL_AGENT — pin sizePx-independence invariant

Ticket: `nid_f8csd65emmy6p62ad9x5w1psz_e` — Pin the sizePx-independence invariant where
`sizePx` is computed (node preview must not resize a node).

Branch: `pin-sizepx-preview-independence` (from `main`).

## Flow (straightforward)

- [x] EXPLORATION (`d9dcabc`)
- [x] IMPLEMENTATION_WITH_SELF_PLAN (`16bed89`) — NodeSizer + VicinityEngine guards
- [x] IMPLEMENTATION_REVIEW — APPROVE, 0 blocking, 2 SHOULD-FIX
- [x] IMPLEMENTATION_ITERATION (`517b391`) — both SHOULD-FIX addressed; round-2 review: CONVERGED
- [x] change_log entry `yx3mxxn5s3w95aizp1iv1kjmi`; ticket closed; merged to `main`

## Outcome

Three test-only guards, each mutation-verified at its own layer:
`NodeSizer.test.ts`, `VicinityEngine.test.ts`, `flowMapping.test.ts`.
No production code changed. 1014 tests green, `npm run check` clean.

Declined: a `nodeDimensionsPx` guard in `graphIdentity.test.ts` — it takes a
`GraphNode` with no settings, so the assertion would be `f(x) === f(x)`.

## Residual risk (accepted, not ticketed)

The `flowMapping` guard asserts geometry while relying on its fixture to make
`data.preview` actually flip across preferences. Round-2 review empirically
confirmed it does flip today; a future fixture trim could silently make the test
vacuous. Reviewer rated this optional-only.
