# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Ticket: `nid_li45606h8uvcnjm7fss17xl1u_e` (sparse eval flips 10↔11 edges).
Branch: `sparse-eval-edge-flake`.

## Plan

**Goal**: make the sparse row of `e2e/edgeRoutingEval.e2e.ts` a deterministic signal,
and state the root cause (plugin vs harness).

**Steps**
1. [x] Re-verify explorer claims against code.
2. [x] Instrument (TEMP) `VicinityGraphBuilder.build` with capability + edge count; dump ordered
       pass list per fixture in the eval spec; run 5x.
3. [x] Probe whether `.canvas` ever lands in `metadataCache.resolvedLinks`.
4. [ ] Harness fix (condition-driven settle + non-arbitrary tie-break).
5. [ ] Plugin `[decide]` ticket.
6. [ ] Remove temp instrumentation; `npm test`, `npm run check`, 5 consecutive e2e runs.

## Step 1 verification (all confirmed, line numbers as of 252700c)

- `e2e/edgeRoutingEval.e2e.ts:127` `await page.waitForTimeout(4500)` — yes.
- `e2e/edgeRoutingEval.e2e.ts:137-141` `heaviest` = `.sort((a,b)=>sizeOf(b)-sizeOf(a))[0]` — stable
  sort ⇒ earliest wins on a tie. Yes.
- `src/adapters/VicinityGraphBuilder.ts:41` `await ObsidianLinkProvider.create(...)` per `build()`.
- `src/adapters/ObsidianLinkProvider.ts:74` `CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))`.
- `src/adapters/CanvasCapability.ts:20-27` `core-indexed` iff any key ends with `.canvas`.
- `scripts/setup-dev-vault.sh` `test.canvas` has file nodes `note1.md`, `note3.md` and a TEXT node
  containing `[[note2]]`.

## Step 2 — MEASUREMENT (the decisive experiment)

Temp instrumentation:
- `src/adapters/VicinityGraphBuilder.ts`: `console.debug("vicinity-graph: TEMP build pass", {mainPath, capability, nodeCount, edgeCount})`.
- eval spec: capture `"TEMP build pass"` as kind `build`; dump every entry in order as `[temp] …`.

Command: `for i in 1 2 3 4 5; do npm run test:e2e -- edgeRoutingEval.e2e.ts > .tmp/flake/measure-$i.log 2>&1; done`

### RAW — run 1 (`.tmp/flake/measure-1.log`)

```
[temp] sparse #0 kind=build main=note2.md cap=fallback-required nodes=3 obstacles=undefined edges=3
[temp] sparse #1 kind=layout main=undefined cap=undefined nodes=3 obstacles=undefined edges=undefined
[temp] sparse #2 kind=routing main=undefined cap=undefined nodes=undefined obstacles=3 edges=3
[temp] sparse #3 kind=build main=note1.md cap=fallback-required nodes=4 obstacles=undefined edges=5
[temp] sparse #4 kind=layout main=undefined cap=undefined nodes=4 obstacles=undefined edges=undefined
[temp] sparse #5 kind=routing main=undefined cap=undefined nodes=undefined obstacles=4 edges=5
[temp] sparse #6 kind=build main=note1.md cap=fallback-required nodes=11 obstacles=undefined edges=14
[temp] sparse #7 kind=layout main=undefined cap=undefined nodes=11 obstacles=undefined edges=undefined
[temp] sparse #8 kind=routing main=undefined cap=undefined nodes=undefined obstacles=13 edges=10
[eval] force/sparse: routingMs=3.4000000059604645 layoutMs=34.599999994039536 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
```

### RAW — run 2 (`.tmp/flake/measure-2.log`)

```
[temp] sparse #0 kind=build main=note2.md cap=core-indexed nodes=3 obstacles=undefined edges=4
[temp] sparse #1 kind=layout main=undefined cap=undefined nodes=3 obstacles=undefined edges=undefined
[temp] sparse #2 kind=routing main=undefined cap=undefined nodes=undefined obstacles=3 edges=4
[temp] sparse #3 kind=build main=note1.md cap=core-indexed nodes=4 obstacles=undefined edges=6
[temp] sparse #4 kind=layout main=undefined cap=undefined nodes=4 obstacles=undefined edges=undefined
[temp] sparse #5 kind=routing main=undefined cap=undefined nodes=undefined obstacles=4 edges=6
[temp] sparse #6 kind=build main=note1.md cap=core-indexed nodes=11 obstacles=undefined edges=15
[temp] sparse #7 kind=layout main=undefined cap=undefined nodes=11 obstacles=undefined edges=undefined
[temp] sparse #8 kind=routing main=undefined cap=undefined nodes=undefined obstacles=13 edges=11
[eval] force/sparse: routingMs=3.199999988079071 layoutMs=33.79999998211861 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
```

Run 3 identical in shape to run 2 (`core-indexed`, edges=11). Runs 4 and 5 identical in shape to
run 1 (`fallback-required`, edges=10).

### Correlation table (5/5 perfect)

| run | capability (all 3 builds in the window) | reported `edges=` | maxDetourRatio |
|-----|------------------------------------------|-------------------|----------------|
| 1 | fallback-required | 10 | 1.000 |
| 2 | core-indexed | 11 | 1.007 |
| 3 | core-indexed | 11 | 1.007 |
| 4 | fallback-required | 10 | 1.000 |
| 5 | fallback-required | 10 | 1.000 |

### Findings for the ticket's questions (a) and (b)

(a) **PLUGIN-side, entirely.** The edge SET genuinely differs between runs. Within a single run
    every build agrees on the capability — there is no intra-run flip and no disagreement between
    passes. The harness tie-break did **not** contribute in any of the 5 runs.

(b) **Exactly 3 routing passes land in the window**, with `obstacleCount` 3 / 4 / 13. Only ONE
    pass has the maximum `obstacleCount=13`, so `heaviest()` never faced a tie ⇒ the arbitrary
    tie-break is a **latent** hazard here, not the active cause.

Secondary observation worth recording: the first `note1.md` build sees only `nodes=4` — the
metadata cache is still filling — and the second (`resolved`-debounced) build sees `nodes=11`.
So the 4.5s window IS load-bearing for reaching the full graph; it just cannot fix the regime.

## Step 3 — canvas-index probe

TEMP probe in `beforeAll`, after `openGraphView()`: poll `resolvedLinks` every 500ms for up to 60s
for any `.canvas` key; log first + last sample.

RAW: see `.tmp/flake/probe-*.log` and the "Probe results" section below.

### Probe results — RAW

```
probe 1: [probe] first=t=0ms total=30  canvas=1 last=t=0ms     total=30  canvas=1 samples=1
         [eval] force/sparse: ... obstacles=13 edges=11 ...   (cap=core-indexed)
probe 2: [probe] first=t=0ms total=17  canvas=0 last=t=59577ms total=165 canvas=0 samples=120
         [eval] force/sparse: ... obstacles=13 edges=10 ...
probe 3: [probe] first=t=0ms total=17  canvas=0 last=t=59577ms total=165 canvas=0 samples=120
         [eval] force/sparse: ... obstacles=13 edges=10 ...
```

**KEY NEGATIVE RESULT**: in a `fallback-required` session the `.canvas` key NEVER enters
`resolvedLinks` — not after 60s, not after the index grew to its full 165 keys. So
"`page.waitForFunction` on a `.canvas` key" is NOT a usable settle condition: in ~60% of
sessions it can never be satisfied. This kills the harness-side fix both explorers suggested.

Notable: `.dev-vault/.obsidian/` ships NO `core-plugins.json`; Obsidian writes the defaults
(which DO include `"canvas": true`) at first boot of the throwaway copy. Suspected discriminator:
that defaults-write races the initial index sweep.

### Diagnostic run (`.tmp/flake/diag-*.log`)

Probe extended to, in a fallback session: report `internalPlugins.plugins.canvas.enabled`,
then try `app.internalPlugins.enablePlugin("canvas")` and, failing that, rewrite `test.canvas`
via `vault.modify` — re-polling for the key after each.

RAW (`.tmp/flake/diag-*.log`):

```
diag 1
[probe] settled total=166 canvas=1
[probe] canvasPlugin enabled=true hasInstance=true
[probe] vaultHasCanvas=true
[probe] fileCache={}
[eval] force/sparse: ... obstacles=13 edges=11 ...
diag 2
[probe] settled total=165 canvas=0
[probe] canvasPlugin enabled=true hasInstance=true
[probe] vaultHasCanvas=true
[probe] fileCache={}
[probe] enablePlugin failed: TypeError: app.internalPlugins.enablePlugin is not a function
[probe] afterEnable canvas=0
[probe] rewrote test.canvas
[probe] afterRewrite canvas=1
[eval] force/sparse: ... obstacles=13 edges=11 ...
diag 3  -> settled total=166 canvas=1 ... edges=11
diag 4  -> settled total=165 canvas=0 ... rewrote test.canvas -> afterRewrite canvas=1 ... edges=11
```

Conclusions:
- The Canvas CORE PLUGIN is always enabled (`enabled=true hasInstance=true`) — plugin
  enablement is NOT the discriminator.
- `app.internalPlugins.enablePlugin` does not exist on Obsidian 1.12.7 — dead end.
- **`vault.modify` on the canvas file deterministically makes the index take it: 2/2 misses
  went `canvas=0 → canvas=1` within the poll.** This is the lever the harness fix uses.
- With the canvas indexed, all 4 diag runs reported `edges=11`.

## Step 4 — the fix (`e2e/edgeRoutingEval.e2e.ts`)

1. `ensureCanvasFixtureIsIndexed()` in `beforeAll`: if `test.canvas` is absent from
   `resolvedLinks`, rewrite it (append `\n` — a no-op for the JSON, a real content change
   for Obsidian) and then `page.waitForFunction` on the key appearing.
2. `waitForRebuildBurstToSettle()` replaces `page.waitForTimeout(4500)`.
3. `lastDurations` → `settledMetrics`: LAST pass at the max `obstacleCount`, and a THROW
   when tied passes disagree on `edgeCount`.
4. `src/adapters/ObsidianLinkProvider.test.ts`: 2 characterization tests pinning the
   text-node-wikilink divergence between the two regimes.

### DEAD END / self-inflicted regression, caught before shipping

First cut of `waitForRebuildBurstToSettle` used quiescence ALONE (`SETTLE_QUIET_MS = 1500`).
Sparse went 5/5 at 11, but runs 1 and 4 published `[eval] force/dense: obstacles=3 edges=4`
— the 3-obstacle BOUNCE pass. Cause: the dense fixture's elk layout takes ~1.4s and logs
only on completion, so the silence while it runs is indistinguishable from the end of the
burst. Fixed by also requiring `LAYOUTS_PER_FIXTURE_RENDER = 2` layout passes (bounce +
central) before the quiet window may end. Do NOT revert to quiescence-only.

## Step 5 — plugin ticket

`nid_s676x55uojmtcwh9t4l9mc6zl_e` — `[decide] Canvas link regime is re-detected per rebuild
from a racing resolvedLinks…`. Linked to `nid_li45606h8uvcnjm7fss17xl1u_e`.

## Step 6 — verification

`npm run check` = 0. `npm test` = 0 (74 files / 990 tests).
Final acceptance: 5 consecutive `npm run test:e2e -- edgeRoutingEval.e2e.ts`, raw lines in
the PUBLIC file. All 5 identical on every row; `5 passed` each.

Temp instrumentation removed: `VicinityGraphBuilder.ts` `TEMP build pass` log, the `build`
PerfEntry kind, the `[temp]` dump, and the `[probe]` block. Verified by `git show`/diff —
no `TEMP`/`probe` strings remain in `src/` or `e2e/`.

Logs kept under `.tmp/flake/` (measure-1..5, probe-1..3, diag-1..4, verify-1..5, final-1..5,
full-suite).

