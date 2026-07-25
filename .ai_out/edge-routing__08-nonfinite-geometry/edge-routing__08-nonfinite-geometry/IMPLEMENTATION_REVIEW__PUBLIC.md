# IMPLEMENTATION_REVIEW — edge-routing__08-nonfinite-geometry

Reviewer: IMPLEMENTATION_REVIEWER (read-only). Branch `edge-routing__08-nonfinite-geometry`,
implementation commit `d3aa331`. Ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`.

## VERDICT: **READY**

The guard is correct, minimal, in the right place, and its tests are non-vacuous. Two comment
honesty items below are SHOULD-FIX (wording only, no re-review needed). Nothing blocking.

## Summary

`extractEdgeRoutingInput` (`src/view/edgeRouting.ts:115-168`) now builds one `RoutingObstacle`
candidate per node and skips it unless all four numeric fields pass `Number.isFinite`
(`hasFiniteGeometry`, `:186-193`). The skipped id never enters `obstacleIds`, so the pre-existing
id-membership pass (`:161-166`) drops every edge touching it — no second filter, no new discipline.
`src/view/edgeRouting.test.ts` gains a `withBrokenGeometry` fixture + 4 BDD tests. Diff is 2 files,
+113/-11. `route()` and `AvoidArena` behavior unchanged (only a comment edited).

## Verified independently by the reviewer

| Claim | Result |
|---|---|
| `npm run check` | **exit 0** (`.tmp/rev_check.log`) |
| `npm test` | **exit 0 — 68 files / 912 tests passed, 0 failed, 0 skipped** (`.tmp/rev_test.log`) |
| `sanity_check.sh` present? | No such file in repo root — n/a |
| Scope: `src/engine/NodeSizer.ts` / settings clamping untouched | **Confirmed** — `git diff main...HEAD --stat -- src/` lists only `edgeRouting.ts` + `edgeRouting.test.ts` |
| Real-wasm session-survival pair still LAST in its describe | **Confirmed** — `KEEP THE TWO TESTS BELOW LAST` at `edgeRouting.test.ts:726`, tests run to EOF (`:773`); all new tests are in the pure `describe` at `:36-195` |
| No new test feeds non-finite geometry to real wasm | **Confirmed** — all 4 new tests are pure `extractEdgeRoutingInput` calls |
| Purity / layering | **Confirmed** — `hasFiniteGeometry` is a module-private pure predicate in `src/view`; no new imports; `src/engine` / `src/shared` untouched, import guards still green |

### 1. Correctness of the guard — PASS

- Placed AFTER both branches assign `obstacle` (`:154`), so it covers `"note"` (size from
  `node.width/height`) and `"folder-group"` (size from `groupDimensions`) with ONE expression. DRY,
  and structurally impossible for a future third branch to bypass.
- All four fields checked: `x`, `y`, `widthPx`, `heightPx` (`:188-191`).
- `Number.isFinite` (not the coercing global) rejects `NaN`, `+Infinity`, `-Infinity` and nothing
  else — matches house style (`persistedShapes.ts:272`).
- **Zero/negative sizes are still ACCEPTED.** No unrequested behavior change; the doc comment
  (`:174-175`) states this explicitly.
- `obstacleIds.add(node.id)` (`:158`) is unreachable for a dropped obstacle — it sits after the
  `continue`. The edge invariant that `route()` relies on (`:475-477` throw) is therefore
  preserved: a dropped obstacle's id cannot be an endpoint of an emitted edge.

### 2. Non-vacuity of the tests — verified by reasoning, PASS

I did not take the implementer's word for this; here is the independent argument per test.

- **`:166` (edges dropped)** is self-proving: it asserts `input.edges` is `[]` for a graph whose ONE
  edge is `broken.md -> ok.md`. That can only hold if `broken.md` was actually dropped, which in
  turn can only happen if `sizePx: Infinity` really propagates to `node.width/height`. So this test
  simultaneously proves the fixture is potent AND that test `:155` is non-vacuous. Without the
  guard, the edge is retained and this fails.
- **`:155`** asserts exact `["ok.md"]`; without the guard the array is `["broken.md", "ok.md"]`.
- **`:160`** feeds `position: { x: NaN }` straight into the positions map — `position.x` is copied
  verbatim into the obstacle, no intermediate transform, so it cannot be vacuous.
- **`:171` (folder group)** asserts exact `["notes/a.md", "notes/b.md"]`. The pre-existing test at
  `:87` proves a two-member `notes/` folder DOES yield a `folder-group:notes` obstacle from these
  same fixtures, so without the guard the array additionally contains `folder-group:notes` and the
  `toEqual` fails. The implementer's reported single-member vacuity trap is genuinely fixed.

### 3. Tests — PASS

BDD `WHEN … THEN …`, one behavior per test, one real assertion each, no `try`/silent fallback, no
skip. `withBrokenGeometry` mirrors the block's existing `scenario()` helper idiom rather than
duplicating it (different graph shape, so this is not a DRY violation). `SHIPPED_CLEARANCE_PX` reused.

## SHOULD-FIX

**S1 — `src/view/edgeRouting.ts:412` — the `dispose()` comment overclaims.**

```
// extraction, so a non-finite rect never reaches a Router — here or in `route()`.
```

`route()` is a public method taking any `EdgeRoutingInput`; `RoutingObstacle` carries no
validated/branded type, so nothing enforces finiteness at the API boundary — the real-wasm tests in
this same file build `RoutingObstacle` literals and call `route()` directly. The guarantee is
"every obstacle produced by `extractEdgeRoutingInput`, the sole production input path
(`GraphViewController.ts:270`), has finite geometry", not "a non-finite rect never reaches a Router".
Per CLAUDE.md ("EXPLICIT without lies or misconceptions") please scope the sentence, e.g.
"…so no obstacle produced by `extractEdgeRoutingInput` — the only production input path — can carry
a non-finite rect into a Router." Everything else in the rewritten comment is accurate, and the
stale forward reference to this ticket is correctly gone.

**S2 — `src/view/edgeRouting.ts:182-184` — the WHY-NOT clause is a non-sequitur.**

```
* WHY-NOT guard inside `route()`: the abort happens in `processTransaction()`, not on a
* throw path, so `AvoidArena.dispose()`'s teardown flush cannot protect against it —
```

A guard inside `route()` (filtering obstacles before `arena.shape(...)`) would in fact have worked;
the `dispose()` teardown flush is a different mechanism and its inability to help is not a reason
against guarding in `route()`. The genuine reason is the second clause alone: extraction is pure and
unit-testable without wasm, and it is where the "drop invalid input" discipline already lives. Drop
the first clause — as written it will mislead the next maintainer into thinking `route()` *cannot*
guard.

## NICE-TO-HAVE

**N1 — `src/view/edgeRouting.ts:130-157` — `let obstacle` instead of an extractor.** The mutable
`let` assigned in both branches is the pragmatic 80/20 and I would not block on it, but a private
`obstacleOf(node, position, groupDimensions): RoutingObstacle | undefined` would restore `const`,
give the loop body one job (collect + validate), and make the two obstacle shapes independently
testable. Worth considering if this loop grows a third node kind.

**N2 — the drop is fully silent.** Deliberate and defensible (the file's existing skips are silent,
and `GraphViewController`'s `console.debug("vicinity-graph: edge routing pass", { obstacleCount, … })`
moves when an obstacle is dropped). But a user who hits the live `depthDecayK = -1` path sees edges
silently render straight with zero signal, and the upstream fix is only a follow-up ticket. A
one-shot `console.warn` at the CALLER (comparing `flow.nodes.length` against `input.obstacles.length`,
keeping `extractEdgeRoutingInput` pure) would cost ~4 lines and make the field report diagnosable.
Caller-side keeps purity intact.

**N3 — coverage granularity.** `x`/`widthPx` are exercised directly; `y` and `heightPx` only
indirectly (`sizePx: Infinity` sets both note dimensions; the group test sets `width` only).
`-Infinity` is never exercised. A single field-by-field `it.each` over the four fields would close
this for ~6 lines. Low priority — the guard is one conjunction — but a transposed-field typo would
currently pass.

## Reachability story — the two corrections CHECK OUT, plus a third finding

Both of the implementer's corrections are accurate, and they matter because they will be copied into
the follow-up ticket:

1. **CONFIRMED** — `src/view/VicinityGraphSettingTab.ts:466` guards `!Number.isNaN(parsed) && parsed >= min`,
   so a typed `-1` for `depthDecayK` (min `0`) is rejected on the Obsidian settings-tab path. The
   live entry point is the React panel: `src/view/SizingSection.tsx:121-125` (`SizingNumber`) guards
   `!Number.isNaN(valueAsNumber)` ONLY, and `min={0}` at `:89` is an advisory HTML attribute.
2. **CONFIRMED in principle** — `Number("1e999") === Infinity`, which is neither `NaN` nor `< min`,
   so it passes `addSizingNumber` for `minPx`/`maxPx`; `NodeSizer` then yields `sizePx = Infinity`
   with no depth-decay involvement. One caveat for the ticket text: on the React path the value goes
   through `input.valueAsNumber`, whose out-of-range behavior is browser-dependent — assert the
   settings-tab path as certain and mark the React path as "verify in Electron".
3. **NEW, same family, worth adding to the follow-up** — `depthDecayK = Infinity` (also accepted by
   both paths, since `Infinity >= 0`) produces `Infinity * 0 = NaN` for the root node
   (`minDepth === 0`) at `src/engine/NodeSizer.ts:143`, i.e. a **`NaN`** size, not just `Infinity`.
   So the follow-up's `DepthDecayMetric` guard must handle a non-finite `k`, not only the
   `1 + k*minDepth === 0` denominator.

`src/engine/NodeSizer.ts:143` (`1 / (1 + this.k * node.minDepth)`, unguarded) and the absent
`clampSizingSettings` remain untouched — correct per scope; TOP_LEVEL_AGENT owns the follow-up ticket.

## Documentation Updates Needed

None for `CLAUDE.md`. The reachability knowledge is recorded in exactly one place
(`hasFiniteGeometry`'s doc comment) — no DRY violation; `dispose()` cross-references rather than
restates it. Ensure the follow-up ticket is filed before this branch is closed, since the
`hasFiniteGeometry` comment asserts the upstream defect still exists.

---

# ITERATION 2 — convergence

Scope: commit `85ad6bd` only (comments in `src/view/edgeRouting.ts`, `it.each` in
`src/view/edgeRouting.test.ts`). `git diff HEAD~1 HEAD -- src/` touches exactly those two files:
`edgeRouting.ts` +9/-5 (comment text only, `hasFiniteGeometry` body and `dispose()` code unchanged),
`edgeRouting.test.ts` +16/-6. No production logic moved. **Verdict: READY (unchanged).**

## 1. S1 / S2 — now HONEST

- **S1 (`edgeRouting.ts:410-416`)** — RESOLVED. The guarantee is now explicitly scoped to
  "no obstacle produced by `extractEdgeRoutingInput` — the only production input path", with the
  counter-case stated outright ("`route()` is public and its `EdgeRoutingInput` is unvalidated, so
  this is a guarantee about production input, not about the API surface"). That is precisely the
  distinction the file's own wasm tests exercise. No overclaim remains.
- **S2 (`edgeRouting.ts:182-185`)** — RESOLVED. The non-sequitur (`dispose()`'s teardown flush) is
  gone; the clause now concedes "it could filter obstacles just as effectively" and gives the two
  real reasons: extraction is pure/wasm-free to test, and it already owns the drop discipline.
  I verified the factual claim in the second reason against the code: `extractEdgeRoutingInput`
  does `continue` on a missing position (`:127-129`) and on missing group dimensions (`:133-135`),
  so "already where this file drops unusable nodes" is accurate, not a rationalization.
- **DRY** — the reachability knowledge still lives in exactly one place (`hasFiniteGeometry`'s doc);
  `dispose()` cross-references via `{@link}` and does not restate it. No stale pointer.

## 2. N3 coverage — non-vacuous and BDD-consistent

- **Note position, 4 cases (`edgeRouting.test.ts:162-170`)** — `x`/`y` × `NaN`/`-Infinity`. The
  fixture copies the position map verbatim into the obstacle, so each case genuinely reaches a
  distinct conjunct of the guard; the exact-array `toEqual(["ok.md"])` fails if the corresponding
  `Number.isFinite` term is dropped. The inline WHY ("a transposed field would still pass if only
  `x` were exercised") states the real motivation. The pre-existing single-case test was widened,
  not replaced — the original `x is NaN` case is case 1. **No coverage lost.**
- **Folder group, 2 cases (`:178-181`)** — non-finite `width` and `height`. Non-vacuous because the
  pre-existing test earlier in the file proves this same two-member-folder fixture DOES emit a
  `folder-group:notes` obstacle; the exact `toEqual(["notes/a.md","notes/b.md"])` therefore fails
  without the guard.
- **BDD naming** — `$label` interpolation keeps every generated name in `WHEN … THEN …` form, one
  behavior per case, one assert per case. Consistent with the repo convention.
- The doc's honest caveat that note-side `widthPx`/`heightPx` cannot be split (both come from
  `sizePx`) is correct and I would not ask for a synthetic split.

## 3. The two rejections

- **N1 (`obstacleOf` extractor) — rejection ACCEPTED, not blocking.** The `let` is definitely
  assigned on both branches under strict TS, so this was style, and I said so in iteration 1. The
  "revisit at a third node kind" trigger is the right deferral.
- **N2 (caller-side `console.warn` on drop) — rejection ACCEPTED as a judgment call, NOT blocking.**
  The core argument holds: the only known reachable trigger is fixed upstream by the follow-up
  ticket, and a second reporting channel for a soon-unreachable state is net complexity. I still
  mildly prefer observability here, but not enough to block, and I will not re-litigate it.
  One accuracy correction to the disposition text, for the record only: the existing
  `console.debug("vicinity-graph: edge routing pass", …)` at `GraphViewController.ts:288-294` logs
  `obstacleCount`/`edgeCount` but **no** total node count in the same statement, so a drop is not
  self-evident from that line alone — it is inferable only by comparison. The conclusion is
  unaffected; the supporting claim is just slightly stronger than the code warrants.

## 4. Gate results — re-run by me, real numbers

- `npm run check` → **exit 0** (`.tmp/rev2_check.log`).
- `npm test` → **exit 0 — 68 test files passed (68), 916 tests passed (916)**, 0 failed, 0 skipped
  (`.tmp/rev2_test.log`). Matches the implementer's reported 916 exactly; the +4 delta over
  iteration 1's 912 is arithmetically consistent with 1→4 and 1→2 case expansion.
- No `sanity_check.sh` in the repo root.

## Remaining (unchanged from iteration 1, owned by TOP_LEVEL_AGENT)

File the upstream follow-up ticket before closing this branch — the `hasFiniteGeometry` comment
asserts that the `depthDecayK` defect still exists, and that guard must reject a **non-finite `k`**
(`Infinity * 0 = NaN` at `src/engine/NodeSizer.ts:143`), not merely a zero denominator.
