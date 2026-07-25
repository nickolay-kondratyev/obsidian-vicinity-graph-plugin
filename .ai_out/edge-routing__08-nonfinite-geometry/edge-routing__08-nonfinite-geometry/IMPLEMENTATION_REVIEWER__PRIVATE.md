# IMPLEMENTATION_REVIEWER — PRIVATE rehydration memory

Ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`, branch `edge-routing__08-nonfinite-geometry`,
implementation commit `d3aa331`. Review round 1 completed. **Verdict issued: READY.**

## State at review time

- Branch commits: `6c5e1e7` scaffold, `3c2e4b8` + `89f7bee` docs, `d3aa331` the only src commit.
- `git diff main...HEAD --stat -- src/` = `edgeRouting.test.ts` +71, `edgeRouting.ts` +42/-11. Nothing else.
- Working tree clean apart from my two `.ai_out` md files.

## Commands I actually ran (results are MINE, not the implementer's)

- `npm run check` → exit 0. Log `.tmp/rev_check.log`.
- `npm test` → exit 0, 68 files / 912 tests passed, 0 failed, 0 skipped. Log `.tmp/rev_test.log`.
  (Matches the implementer's reported numbers exactly; the real-wasm block ran, did not skip.)
- No `sanity_check.sh` in repo root.

## Key line numbers (post-change)

- `src/view/edgeRouting.ts:115-168` `extractEdgeRoutingInput`; guard at `:154-156`; `obstacleIds.add` at `:158`.
- `src/view/edgeRouting.ts:186-193` `hasFiniteGeometry`; its doc `:170-185` (WHY-NOT clause `:182-184` = S2).
- `src/view/edgeRouting.ts:412` `dispose()` overclaim = S1.
- `src/view/edgeRouting.ts:475-477` `route()`'s "no registered shape" throw.
- `src/view/edgeRouting.test.ts:36-195` pure describe; new fixture `:131-153`; new tests `:155,160,166,171`.
- `src/view/edgeRouting.test.ts:726` KEEP-LAST ordering comment; file ends `:773`. Ordering intact.
- `src/view/GraphViewController.ts:270` sole `route()` call site; `withRoutedPoints` `:450-457` does
  `routes.get(edge.id)` → undefined ⇒ straight edge, so a partial route map is safely handled.
- `src/view/VicinityGraphSettingTab.ts:466` `!Number.isNaN(parsed) && parsed >= min`.
- `src/view/SizingSection.tsx:89` `min={0}` for depthDecayK; `:121-125` `SizingNumber` NaN-only guard.
- `src/engine/NodeSizer.ts:143` `1 / (1 + this.k * node.minDepth)` — untouched, correct per scope.

## Non-vacuity argument I constructed independently (reuse if challenged)

Test `:166` (`input.edges` toEqual `[]`) is the linchpin: it can only pass if `broken.md` was really
dropped, which proves `sizePx: Infinity` genuinely propagates to `node.width/height` through
`vicinityGraphToFlow`/`nodeDimensionsPx`. That retroactively proves `:155` potent too. `:160` writes
NaN directly into the positions map (copied verbatim, no transform). `:171` is non-vacuous because
the pre-existing test at `:87` proves the same two-member-folder fixture DOES emit a
`folder-group:notes` obstacle, so an exact-array `toEqual` must fail without the guard.

## Findings issued (none blocking)

- **S1** `edgeRouting.ts:412` — "a non-finite rect never reaches a Router — here or in `route()`"
  overclaims; `route()` takes any `EdgeRoutingInput`, `RoutingObstacle` is unbranded, and the file's
  own wasm tests build obstacle literals. Scope to "produced by `extractEdgeRoutingInput`".
- **S2** `edgeRouting.ts:182-184` — WHY-NOT first clause is a non-sequitur (dispose()'s flush has no
  bearing on whether `route()` could guard). Keep only the purity/testability reason.
- **N1** `let obstacle` vs an `obstacleOf(...)` extractor. **N2** fully silent drop; suggested a
  caller-side one-shot warn to preserve purity. **N3** `y`/`heightPx`/`-Infinity` only covered
  indirectly.

## Reachability verification (feeds TOP_LEVEL_AGENT's follow-up ticket)

Implementer's correction 1 (settings tab clamps `>= min`, rejects `-1`): CONFIRMED by reading
`VicinityGraphSettingTab.ts:466`. Correction 2 (`1e999` → `Infinity` passes for `minPx`/`maxPx`):
CONFIRMED for the settings-tab path; flagged that the React path goes via `input.valueAsNumber`
whose out-of-range behavior is browser-dependent and should be marked "verify in Electron".
**My own third finding:** `depthDecayK = Infinity` also passes both guards and gives `Infinity * 0 = NaN`
for the root (`minDepth === 0`) ⇒ `sizePx = NaN`. The follow-up's `DepthDecayMetric` fix must guard a
non-finite `k`, not just a zero denominator.

## If asked for a round 2

Only S1/S2 wording is outstanding — both are single-comment edits in `src/view/edgeRouting.ts`. Re-run
of `npm run check` / `npm test` would not be required for comment-only changes, but confirm the diff
touches nothing else before signing off again.
