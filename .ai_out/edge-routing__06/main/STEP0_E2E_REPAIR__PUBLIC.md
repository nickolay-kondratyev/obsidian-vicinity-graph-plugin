# STEP0_E2E_REPAIR__PUBLIC — edge-routing__06

Scope: **e2e-only**. Closes the chore ticket `nid_6lxaenl4oamjxqj6f0eh6rr4c_e` (stale layered/radial
layout-mode references) and surfaces the detour-ratio metrics that edge-routing__06 needs as its
tuning signal. **No `src/` change** — the plugin already logs both ratios; only the spec's type
dropped them.

## What changed

### `e2e/edgeRoutingEval.e2e.ts` (net −56 lines)

| Was | Now |
|---|---|
| `:31` `type LayoutMode = "force" \| "layered" \| "radial"` | deleted |
| `:98-99` `renderFixture(mode, centralPath)` + `harness.setLayoutMode(mode)` | `renderFixture(centralPath)`; the no-op mode write is gone |
| `:161-169` `"layered layout routes the dense fixture…"` test | deleted (incl. its `layered-dense` screenshot) |
| `:171-181` `"radial layout SKIPS routing (gated)…"` test | deleted — the gate no longer exists (routing is unconditional), so its `expect(routingMs).toBeUndefined()` would now **fail** |
| `:184-187` PERF BUDGET comment describing the radial gate + layered | rewritten: force is the only layout, routing is unconditional |
| `:8-21` header prose "screenshot per (fixture × layout mode)" | "per fixture"; also documents the detour-ratio readout |

**New metric plumbing** (the edge-routing__06 headline signal):
- `PerfEntry["data"]` now declares `maxDetourRatio?: number; meanDetourRatio?: number` — these
  already rode the scraped `console.debug` payload (`src/view/GraphViewController.ts:280-286`) and
  were being silently dropped by the type.
- New `EvalMetrics` interface replaces the inline return type of `lastDurations`, which now returns
  both ratios **off the same heaviest routing entry**, so cost and quality always describe one pass.
- New `formatMetrics(metrics)` builds the one shared `[eval]` readout (DRY: the template was
  duplicated between the force loop and the PERF test, and would have been duplicated at 6 fields).
- Ratios print via `toFixed(DETOUR_RATIO_DIGITS = 3)` — raw floats are 17 significant digits and
  unscannable. Metric names and the `key=value` line style are unchanged.

### `e2e/obsidianHarness.ts` (−12 lines)

`setLayoutMode(...)` removed entirely (was `:297-307`). It was a genuine no-op — the persistence
parser strips `layoutMode` (`src/persistence/persistedShapes.test.ts:45-50`) — and after the spec
cleanup it had no caller.

**Untouched, as instructed** — benign English word senses, not layout modes:
`e2e/edgeRouting.e2e.ts:22` ("radial star" = edge topology), `e2e/obsidianHarness.ts:85,:127`
("fixtures layered on top of").

**PERF BUDGET assertions preserved verbatim** (`:192-194`): `routingMs >= 0`, `layoutMs > 0`,
`routingMs < layoutMs`.

## BASELINE OF RECORD — verbatim `[eval]` lines

Default `EDGE_ROUTING_SHAPE_BUFFER_PX = 17`. This is the reference for the later shapeBufferDistance
sweep. Copied verbatim from `.tmp/step0-e2e.log`:

```
[eval] force/sparse: routingMs=3.7000000029802322 layoutMs=38.29999999701977 obstacles=13 edges=11 maxDetourRatio=1.020 meanDetourRatio=1.002
[eval] force/medium: routingMs=11.299999997019768 layoutMs=27.900000005960464 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=144.1000000089407 layoutMs=1397.5 obstacles=101 edges=292 maxDetourRatio=1.342 meanDetourRatio=1.067
[eval] PERF dense/force: routingMs=147.79999999701977 layoutMs=1380.5999999940395 obstacles=101 edges=292 maxDetourRatio=1.342 meanDetourRatio=1.067
```

Reading it: dense `obstacles=101 edges=292` confirms the **real dense pass** was measured, not a
stale trivial intermediate (the edge-routing__04 false-pass hazard). Route quality is already near
optimal on sparse/medium (mean 1.000-1.002), so **dense is the only fixture with headroom** —
`maxDetourRatio=1.342` (worst edge 34% longer than its straight chord), `mean=1.067`. Judge the
sweep on the dense numbers; expect sparse/medium to stay flat.

Screenshots refreshed: `.out/edge-routing-force-{sparse,medium,dense}.png` (gitignored).

## Verification evidence

| Command | Result |
|---|---|
| `npx tsc -p e2e/tsconfig.json --noEmit` | **exit 0**, no output |
| `grep -rn -iE "layered\|radial\|layoutMode" e2e/` | only the 3 benign hits above; every dead ref gone |
| `npm run test:e2e -- edgeRoutingEval.e2e.ts` | **4 passed (19.8s)**, `E2E_EXIT=0` |
| `npm test` | `Test Files 1 failed \| 62 passed (63)`, `Tests 1 failed \| 768 passed (769)` |

e2e test list (was 6 tests, now 4 — the two deleted layout-mode tests):

```
✓ 1 force layout routes the sparse fixture and captures a screenshot (4.7s)
✓ 2 force layout routes the medium fixture and captures a screenshot (4.6s)
✓ 3 force layout routes the dense fixture and captures a screenshot (4.7s)
✓ 4 PERF BUDGET: on the dense fixture the routing pass stays well under the elk+d3 layout time (4.6s)
```

The single `npm test` failure is the **known pre-existing** one, deliberately left alone:
`src/engine/SettingsSpec.test.ts` expects `linkStrengthFactor.max: 2` while the spec ships `4`.
It cannot be mine: vitest runs `src/**/*.test.{ts,tsx}` only, and this diff touches `e2e/` exclusively.
No new failures introduced.

Logs: `.tmp/step0-tsc.log`, `.tmp/step0-e2e.log`, `.tmp/step0-unit.log`.

## Notes for the next step

- The ticket's acceptance criteria are all met; the chore ticket is ready to close (not closed here —
  no git commit was made, per instruction).
- Sweeping `EDGE_ROUTING_SHAPE_BUFFER_PX` (`src/view/edgeRouting.ts:71`) will turn `npm test` red on
  `src/view/edgeRouting.test.ts:109-131` (asserts `=== 17`). That is **expected during the sweep** and
  must not be "fixed" by loosening those tests — it is the value-of-record assertion.
- Screenshot filenames are fixed per fixture, so each sweep value's PNGs must be copied aside before
  the next run overwrites them.

## `#QUESTION_FOR_HUMAN:`

None. Scope was unambiguous and fully verified.
