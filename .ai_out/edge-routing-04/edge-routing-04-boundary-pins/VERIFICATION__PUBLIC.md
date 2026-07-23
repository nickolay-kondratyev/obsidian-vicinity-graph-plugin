# VERIFICATION — edge-routing__04 (boundary pins) — VERDICT: **STOP**

Role: VERIFICATION sub-agent. Ran the real-Obsidian Playwright edge-routing EVAL
harness (headless, Obsidian 1.12.7) on NEW code (`edge-routing-04-boundary-pins`
@ `5e175ed`) and on BASE (`main` @ `02c4b4b`, centre pins) via a git worktree.

## Headline

**STOP.** The 8-pins-per-shape change makes the dense-fixture routing pass explode
from ~137 ms (base) to **~8838 ms (~8.8 s)** — a ~64× regression that is ~6× the
elk+d3 layout time on the same fixture. This violates the ticket's perf budget
(`routingMs` must stay well under `layoutMs` on dense/force) and matches the
human's explicit STOP condition. Route QUALITY did improve (near-direct routes,
low detour ratios on sparse/medium), but the perf blowup is disqualifying.

## Perf — routingMs vs layoutMs per fixture

| fixture (force) | obstacles | edges | BASE routingMs | NEW routingMs | layoutMs (≈) | NEW routing vs layout |
|---|---|---|---|---|---|---|
| sparse | 13 | 10–11 | 1.9 | 11.8 | ~34 | under |
| medium (folder groups) | 21 | 20 | 5.4 | 64.8 | ~38 | **over** (routing > layout) |
| **dense** | **101** | **292** | **137.7** | **8838.2** | **~1450** | **STOP: routing ≈ 6× layout** |
| layered/dense | 101 | 292 | 174.3 | (not isolated) | ~255 | — |
| radial/dense | — | — | gated off | gated off | ~43 | routing correctly skipped |

Scaling is super-linear in obstacle count (808 pins on 101 shapes): base→new is
~6× at 13 obstacles, ~12× at 21, and ~64× at 101.

## PERF BUDGET test verdict — PASSED, but a FALSE PASS

The committed `edgeRoutingEval.e2e.ts` PERF BUDGET test reported PASS on NEW code
(`routingMs=1 < layoutMs=1508`, obstacles=3). **That number is bogus.** Phase B
moved the routing `console.debug` in `GraphViewController.resolveRoutes()` to
AFTER the `isStale(token)` early-return (`src/view/GraphViewController.ts:267-286`).
The real 101-obstacle dense pass is superseded (stale) by a later rebuild and so
is discarded WITHOUT logging; the eval's `onConsole` therefore only captures a
tiny intermediate 3-obstacle pass and the assertion passes vacuously. On BASE the
debug line logged before the stale check, so BASE correctly reported obstacles=101.
The eval as written cannot see the regression — the human's warning about a
false-passing perf gate is exactly what happened.

The true 101-obstacle NEW timing was obtained with a throwaway long-settle spec
(30 s window, deleted after use) that captured every routing pass:
```
[dense-pass] obstacles=3   edges=4   durationMs=3      maxDetourRatio=1
[dense-pass] obstacles=26  edges=43  durationMs=95     maxDetourRatio=1.537
[dense-pass] obstacles=101 edges=292 durationMs=8838.2 maxDetourRatio=3.257 meanDetourRatio=1.181
```

## Detour ratios (NEW code)

| fixture | maxDetourRatio | meanDetourRatio |
|---|---|---|
| sparse (13 obs) | 1.000 | 1.000 |
| medium (21 obs, folder groups) | 1.000 | 1.000 |
| dense (101 obs) | 3.257 | 1.181 |

Sparse/medium routes are perfectly direct (ratio 1.0) — the boundary-pin fix
achieves its route-quality goal on grouped fixtures. Dense shows one route at
3.26× the chord and mean 1.18× (routes still bend, but not pathologically).
BASE detour ratios are unmeasurable (main has no detour telemetry), so the
before/after quality comparison is visual (below), not numeric.

## Screenshots

NEW (repo `.out/`): `edge-routing-force-{sparse,medium,dense,layered-dense,radial-dense}.png`
(also copied to `new-*.png`). BASE (from worktree): `.out/base-force-{sparse,medium,dense}.png`.
These are not source-controlled.

Visual before/after (force-medium, the folder-group fixture that exhibits the
pathology):
- **BASE** (`.out/base-force-medium.png`): visible roundabout routes — the top-left
  `×4` edge loops up and over grp-b to reach grp-c; grp-a edges wrap around the
  left; edges enter group boxes at non-facing points.
- **NEW** (`.out/new-force-medium.png`): edges attach on the side of each group box
  facing the hub and take short direct hops; no big loops. Route quality clearly
  improved, consistent with detour ratio 1.0.

force-sparse similarly clean on NEW. So Phase A's route-quality intent is met.

## Exact-repro status (public vault)

NOT automated. The note exists at
`.out/vaults/public/p/Naval-Ravikant/th/wealth-buys-external-freedom.md`, but
`ObsidianHarness` hardcodes `DEV_VAULT_DIR = .dev-vault` with no env/config
override — pointing it at `.out/vaults/public` would require modifying committed
harness code (out of scope per task). The pathology is covered by the grouped
`force-medium` fixture + the detour metric, which is sufficient to show the
quality fix; the STOP is driven by the dense perf number regardless.

## Overall verdict — STOP

- **STOP trigger:** dense/force `routingMs` (8838 ms) ≫ `layoutMs` (~1450 ms) —
  routing is ~6× layout and ~64× the base routing time. Perf budget violated.
- Route quality DID improve (near-direct routes, ratio 1.0 on sparse/medium;
  facing-side attachment visible), so Phase A works functionally.
- But per the human directive, a perf-budget breach on dense/force is a STOP and
  I do NOT propose alternative routing strategies. The ticket's own fallback
  (boundary pins on folder-group shapes ONLY, `kind`-threaded) was NOT shipped;
  that or a pin-count reduction is the obvious next lever, but that is a
  design/implementation decision for TOP_LEVEL, not this verification.
- Secondary correctness issue surfaced: the Phase B debug-line move makes the
  committed PERF BUDGET e2e test silently vacuous (measures a 3-obstacle stale
  intermediate, not the 101-obstacle dense pass). The perf gate must be made to
  measure the heaviest NON-stale pass, or it will keep green-lighting regressions.

## Reproduction commands

```bash
# NEW eval (current branch HEAD)
npm run test:e2e -- edgeRoutingEval.e2e.ts        # -> .tmp/eval-new.log (PERF test false-passes)

# True dense timing (throwaway long-settle spec, since committed eval can't see stale pass)
#   printed: [dense-pass] obstacles=101 ... durationMs=8838.2

# BASE (centre pins) via worktree
git worktree add .worktree/base main
cd .worktree/base && OBSIDIAN_PATH=<cached> npm run test:e2e -- edgeRoutingEval.e2e.ts  # -> obstacles=101 routingMs=137.7
git worktree remove .worktree/base --force
```
