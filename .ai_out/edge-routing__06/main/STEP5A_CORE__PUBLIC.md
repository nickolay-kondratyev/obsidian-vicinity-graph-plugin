# STEP5A_CORE__PUBLIC — edge-routing__06 item (b), the CORE

The routing clearance is now a persisted, clamped, user-facing engine setting that reaches libavoid,
and the two buffer invariants are replaced by two stronger ones. Base commit `3786495`; **not
committed** (TOP_LEVEL_AGENT commits). `npm run check` exit 0, `npm test` **779 passed / 0 failed**,
`npx tsc -p e2e/tsconfig.json --noEmit` exit 0. No e2e run — step 5b owns the AFTER measurement.

## 1. The field: `edgeRoutingClearancePx` (default 11, min 6, max 14, step 1)

**Name chosen over the suggested `edgeClearancePx`.** `src/engine/types.ts:194-201` states the file's
own rule: force-layout field NAMES describe the MECHANISM, the UI shows the label. `elkNodeSpacingPx`
names its subsystem (the elk pass), so this one names its subsystem too (the edge-routing pass) — and
D1 explicitly asked for a name that makes the routing meaning unmistakable inside a type otherwise
documented as driving elk+d3. The UI label is unchanged from D4: **"Edge clearance"**, in *Advanced
spacing*.

Inside the view the same value travels as `EdgeRoutingInput.shapeBufferPx` — libavoid's own parameter
name (`avoid.shapeBufferDistance`), which is also what the retired constant was named. JSDoc on both
sides ties the two names together.

## 2. Every file:line touched

### Constants extracted (task 1)

| File:line | Change |
|---|---|
| `src/view/VicinityEdge.tsx:22-30` | `ARROWHEAD_HALF_WIDTH_PX = 6` is now **exported**, with a WHY block naming it the measured FLOOR of the clearance (perpendicular reach of the head off its own route). |
| `src/view/constants.ts:122-148` | Extracted `GROUP_SIDE_PADDING_PX = 16` (exported) + private `GROUP_TOP_PADDING_PX = 36` + private `elkPaddingValue()`; `ELK_GROUP_PADDING` is now **built** from them. WHY comment: it is the ceiling on the clearance, because a member's clearance must not escape the group border and seal the group's own boundary pins. |
| `src/view/elkMapping.test.ts:102-110` | NEW literal lock — `expect(ELK_GROUP_PADDING).toBe("[top=36.0,left=16.0,bottom=16.0,right=16.0]")`. The pre-existing assertion at `:99` compares against the constant itself and is blind to a change in the string, so without this the extraction could have silently moved every folder group's layout. |

The elk string is **byte-identical in value** — proven by that lock plus the unchanged `elkMapping`
suite. Layout is untouched.

### The engine setting (task 3)

| File:line | Change |
|---|---|
| `src/engine/types.ts:222-234` | 7th `ForceLayoutSettings` field + JSDoc saying WHY a routing knob sits here (D1) and what it costs (a full elk+d3 relayout it does not need). Type-level doc at `:194-201` updated ("the remaining px fields are the Advanced spacing section"). |
| `src/engine/SettingsSpec.ts:217-245` | The spec entry with the mandatory `[min,max]` rationale JSDoc **plus the migrated rationale** of the retired `EDGE_ROUTING_SHAPE_BUFFER_PX` (task 5). |
| `src/engine/constants.ts:97` | `clampForceLayoutSettings` (hand-listed). |
| `src/engine/constants.ts:144` | `EngineDefaults.forceLayoutSettings()` (hand-listed). |
| `src/persistence/persistedShapes.ts:196-200` | `parseForceLayout` (hand-listed) + the explicit no-version-bump comment. |
| `src/view/forceLayoutFieldMeta.ts:41-44,:64` | Copy entry ("Edge clearance") and `FORCE_LAYOUT_ADVANCED_FIELDS` membership. **Forced, not scope creep**: `FORCE_LAYOUT_FIELD_META` is a compile-time exhaustive `Record<keyof ForceLayoutSettings, …>` and `_assertEveryForceLayoutFieldGrouped` is a compile-time partition assert — omitting either ships a RED `npm run check`. Copy follows D4 verbatim; step 5b owns reviewing the description wording. |
| `src/view/testFixtures/graphFixtures.ts:59` | Hand-listed `forceLayout` literal — **not in any exploration table**, found by `tsc` (TS2741). |

### Plumbing to the router (task 4)

| File:line | Change |
|---|---|
| `src/view/edgeRouting.ts:47-57` | `EdgeRoutingInput.shapeBufferPx` (required, not optional). |
| `src/view/edgeRouting.ts:113-161` | `extractEdgeRoutingInput` takes and forwards it. |
| `src/view/edgeRouting.ts:395` | `setRoutingParameter(avoid.shapeBufferDistance, input.shapeBufferPx)` — was the module constant. |
| `src/view/edgeRouting.ts:1, :60` | `EDGE_ROUTING_SHAPE_BUFFER_PX` and its now-unused `EDGE_PAIR_CURVATURE_PX` import **deleted**. |
| `src/view/GraphViewController.ts:226-232` | `resolveRoutes(..., graph.viewSettings.forceLayout.edgeRoutingClearancePx, token)` — mirrors the layout hop at `:213`. |
| `src/view/GraphViewController.ts:247-260` | New `edgeRoutingClearancePx` parameter → `shapeBufferPx` in the extracted input. |
| `src/view/GraphViewController.ts:369-385` | `routingSignature` now prepends the clearance, with the WHY. Cache doc at `:95` updated. |
| `src/view/edgeGeometry.ts:132-135` | The dangling `EDGE_ROUTING_SHAPE_BUFFER_PX` reference in `ROUTED_CORNER_RADIUS_PX`'s doc now points at the setting (and says WHY-NOT derive the radius from a user slider). |

DIP seam intact: `EdgeRouter.route(input)` is unchanged in shape, the engine gained no view/obsidian
imports (`importGuard.test.ts` green), and the value crosses the boundary as a plain number.

`EDGE_ROUTING_CROSSING_PENALTY_PX` still 0. No `ShapeConnectionPin` reaches `AvoidArena.owned` or any
`destroy()` path — `registerPinsForShape` is untouched.

## 3. `PERSISTED_SHAPE_VERSION` — the explicit call: **NO BUMP**

Recorded in code at `src/persistence/persistedShapes.ts:196-199` and locked by a new test.

Reasoning: `parseForceLayout` fills each missing known field from the engine default per field, so a
`data.json` written before this field parses correctly and keeps every other stored value. A bump does
the opposite of a migration here — `parsePluginData` returns defaults **wholesale** on a version
mismatch (`:89-91`), so bumping would DISCARD all stored user settings to add one field.

New test (`src/persistence/persistedShapes.test.ts:165-177`) proves the compatibility claim directly
rather than by analogy to the pre-existing `:158`:

> `WHEN a forceLayout persisted before the edge-clearance field is read THEN only that field defaults, the user's other values survive`

## 4. The cache trap — made to fail first

Both controller tests were written and executed **before** any plumbing existed. Verbatim RED
(`.tmp/s5a-red1.log`, `npx vitest run src/view/GraphViewController.test.ts`):

```
 × src/view/GraphViewController.test.ts > GraphViewController edge-routing pass > WHEN a build routes THEN the graph's resolved edge-routing clearance reaches the router 3ms
   → expected undefined to be 7 // Object.is equality
 × src/view/GraphViewController.test.ts > GraphViewController edge-routing pass > WHEN only the edge-routing clearance changed THEN the router runs again (the cache signature covers it) 3ms
   → expected 1 to be 2 // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  … WHEN a build routes THEN the graph's resolved edge-routing clearance reaches the router
AssertionError: expected undefined to be 7 // Object.is equality
 FAIL  … WHEN only the edge-routing clearance changed THEN the router runs again (the cache signature covers it)
AssertionError: expected 1 to be 2 // Object.is equality

      Tests  2 failed | 37 passed (39)
```

`expected 1 to be 2` **is** the predicted trap reproducing: `FakeLayout` is deterministic, so both
rebuilds produce identical obstacle geometry and a geometry-only signature served the stale routes —
exactly the "slider looks dead" failure. `expected undefined to be 7` is the value never arriving.
Both green after the plumbing. `FakeEdgeRouter.lastInput` (`GraphViewController.test.ts:113-131`) needed
no change — it already records the whole input, and the new field rides along inside it.

## 5. The replaced invariants — before / after

Both live in `src/view/edgeRouting.test.ts:117-155`, asserted against the **spec RANGE**, so they hold
for every value a slider or a clamped hand-edited `data.json` can reach — not just the default.

| Before (`edgeRouting.test.ts:110-118`) | After |
|---|---|
| `expect(EDGE_ROUTING_SHAPE_BUFFER_PX).toBe(17)` — "derived from the paired-edge curvature" | `expect(CLEARANCE_RANGE.max).toBeLessThan(GROUP_SIDE_PADDING_PX)` — measured cliff: members are separate obstacles inset 16px by `ELK_GROUP_PADDING`; past that inset a member's clearance escapes the group border and seals the group's own pins (22-26 non-facing at ≤14 vs 40 at 17). The cliff moves when the inset moves (`SWEEP__PUBLIC.md` §4); 17 sat 1-2px over it. |
| `expect(EDGE_ROUTING_SHAPE_BUFFER_PX).toBeGreaterThan(EDGE_ARROWHEAD_INSET_MIN_PX)` (14) | `expect(CLEARANCE_RANGE.min).toBeGreaterThanOrEqual(ARROWHEAD_HALF_WIDTH_PX)` (6) — the old pair compared a PERPENDICULAR clearance to a LONGITUDINAL offset along the route, so it never described a containment relation. The half-width is perpendicular like the clearance, so this one actually keeps the head's body outside every box its route clears. |

Neither is a loosening, and no other assertion was touched: `FACING_BORDER_TOL_PX`, `MID_SPAN_TOL_PX`,
`CORNER_CLEARANCE_TOL_PX`, `GROUP_CENTRE_TOL_PX` and every real-wasm assertion are byte-identical. The
real-wasm scenes now route at the **shipped default** (`SHIPPED_CLEARANCE_PX =
EngineDefaults.forceLayoutSettings().edgeRoutingClearancePx`, `edgeRouting.test.ts:31`) rather than a
literal, and all 24 still pass at 11.

**Teeth proven by mutation** (`.tmp/s5a-mutate.log`): temporarily widening the spec to `min: 5, max: 16`
gives `Tests 2 failed | 22 passed (24)` — one failure per invariant. Spec restored; `git diff` on
`SettingsSpec.ts` shows only the intended 29 insertions.

## 6. Verification (real output)

```
$ npm run check
EXIT=0                       (tsc -noEmit, strict)

$ npm test
 Test Files  63 passed (63)
      Tests  779 passed (779)

$ npx tsc -p e2e/tsconfig.json --noEmit
EXIT=0
```

**Zero failing tests — including in step-5b-owned files.** Baseline on a stashed tree was 774; the +5
is: +2 controller (cache + arrival), +1 elk-padding lock, +1 persistence no-bump, +1 free in
`GraphStructureDiff.test.ts` (it iterates `FORCE_LAYOUT_FIELDS`, so relayout-on-change coverage for the
7th field is automatic). The two replaced invariants are 2-for-2. Per-file counts diffed via
`--reporter=json` (`.tmp/s5a-base.json` vs `.tmp/s5a-now.json`).

Logs: `.tmp/s5a-{red1,check3,unit2,mutate,e2e-tsc}.log`.

## 7. HANDOFF — what step 5b must still do

**The settings row already exists.** Both write surfaces iterate `FORCE_LAYOUT_ADVANCED_FIELDS`, so the
"Edge clearance" slider appears in the settings tab AND in the in-graph `ForceLayoutSection` with no
further code. 5b VERIFIES it renders and writes; it does not need to add a row (and must still not need
to edit `VicinityGraphSettingTab.ts`).

1. **`e2e/settingsUxVisual.e2e.ts:96` — `toHaveCount(6)` → 7.** THE ONLY red surface left anywhere;
   it will fail on the next `npm run test:e2e`. While there, `:99-100` proves the advanced sliders are
   reachable by label — add `await expect(forceLayout.getByLabel("Edge clearance")).toBeVisible();`,
   and update the `:97-98` comment that says "the two advanced sliders".
2. **`src/view/settingsResetPlan.ts:94` copy** — "Resets all six force layout sliders, including the
   two under Advanced spacing." Now wrong on both counts (seven / three). **No test asserts this
   string**, so it fails silently — do not wait for a red test to find it.
3. **`README.md:67-71`** — "four sliders … plus an *Advanced spacing* group (**Node spacing**, **Group
   member spacing**) … resets all six." Add **Edge clearance**, fix "six" → "seven".
4. **`docs-internal/CHANGELOG.md`** — untouched by me.
5. **The AFTER measurement** — `npm run test:e2e -- edgeRoutingEval.e2e.ts` at the new default 11 and
   the `facing` fixture readout. Predicted from `SWEEP__PUBLIC.md` §2.2: dense `maxDetourRatio` 1.342 →
   **1.244**, mean 1.067 → **1.046**; medium flat at 1.000; sparse unusable (edge-count confound).
   The parked terminal probe `.tmp/zzFacingTerminalsProbe.e2e.ts.keep` (STEP4 PUBLIC) is the only
   readout that can see attachment SIDE — `[eval]` cannot.
6. **Ticket notes** — the D6 corrections plus this step's `PERSISTED_SHAPE_VERSION` call.

Not needed by anyone: `ViewSettingsResolver` (a field *inside* `forceLayout` resolves wholesale),
`settingsWritePlan` (the existing `global-force-layout` interaction carries it), `FORCE_LAYOUT_RANGES`
(auto-derived).

## 8. `#QUESTION_FOR_HUMAN:`

1. **`#QUESTION_FOR_HUMAN:` D3 is internally inconsistent on the lower bound and I resolved it in
   favour of the RANGE.** D3 decides "clamp 6-14" and `SWEEP__PUBLIC.md` §7 calls 6 "the arrowhead
   half-width floor", but D3's prose also says the test asserts `min > 6` — impossible with `min: 6`.
   I shipped `min: 6` with `toBeGreaterThanOrEqual(ARROWHEAD_HALF_WIDTH_PX)`, i.e. the clearance never
   drops BELOW the half-width; at the very floor the head's body grazes the boundary it clears without
   crossing it. If you want the strict inequality instead, the fix is `min: 7` — say which and it is a
   one-line change in `SettingsSpec.ts:245` plus the test's matcher.
2. **`#QUESTION_FOR_HUMAN:` Accepted downside now concrete:** moving the Edge clearance slider triggers
   a full elk+d3 relayout (via `GraphStructureDiff`'s `FORCE_LAYOUT_FIELDS`), so the graph visibly
   re-settles for a routing-only change — ~1.4s on the dense fixture. D1 accepted this in the abstract;
   flagging that it is user-visible. A follow-up ticket could exclude this one field from the relayout
   trigger (the route cache would still invalidate correctly, since that is keyed separately).
