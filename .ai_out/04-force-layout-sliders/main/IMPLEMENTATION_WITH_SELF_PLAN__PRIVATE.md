# IMPLEMENTATION_WITH_SELF_PLAN — ticket-04 force-layout sliders (PRIVATE)

## Status: ITERATION-1 COMPLETE (review response) — NOT committed (TOP_LEVEL_AGENT commits)

Iteration-1 (2026-07-23, fresh instance): responded to APPROVED-WITH-MINORS review.
- MINOR-1 INCORPORATED: FakeLayout in GraphViewController.test.ts now records the
  forwarded `forceLayout` (`lastForceLayout`); new BDD test with NON-default
  linkGapPx=77 asserts the controller forwards graph.viewSettings.forceLayout.
  Verified failing-first (.tmp/t04-iter-ctrl-fail.log) before adding the recording.
- MINOR-2 INCORPORATED: sameForceLayout now derives its field list from
  FORCE_LAYOUT_RANGES keys (typed Record<keyof ForceLayoutSettings,…> ⇒ compile-time
  exhaustive). Plus it.each over the ranges keys in GraphStructureDiff.test.ts
  (each field change ⇒ relayout; uses range.max+1 as guaranteed-different value).
- NIT-3 REJECTED: no slider debounce — reviewer said none required; consistent with
  depth-slider pattern; speculative complexity (KISS). Revisit only if real-vault
  tuning feels janky.
Results: npm test 60 files / 729 tests PASS (.tmp/t04-iter-test.log), check PASS
(.tmp/t04-iter-check.log). Only 3 files touched (2 test files + GraphStructureDiff.ts,
pure semantics-preserving refactor). Stranding test not in diff.
Disposition doc: .ai_out/04-force-layout-sliders/main/IMPLEMENTATION_ITERATION__PUBLIC.md

## Original implementation status: COMPLETE (feature committed as 3291aaf by TOP_LEVEL_AGENT)

Final state (2026-07-24): npm test 60/722 PASS (.tmp/t04-test-final.log),
npm run check PASS, npm run build PASS (.tmp/t04-build.log). PUBLIC file written.
Bit-identical-at-defaults verified via a TEMPORARY probe test (position JSON dump)
run in both the working tree and a `HEAD` worktree (.worktree/t04-baseline, since
removed) — diff was byte-identical; probe deleted (never commit it).
Everything in the plan below was implemented as designed, plus:
- decideLayout gained sameForceLayout() value-equality check (live-effect enabler).
- elkMapping.test.ts got 2 spacing-threading tests; existing assertions untouched.
- README bullet + CHANGELOG entry added.
If rehydrated: nothing left to do except respond to review feedback.

## Goal
6 tunable force-layout settings (native-parity 4 + advanced 2) wired end-to-end
(engine ViewSettings → resolver → persistence → write-plan → settings tab UI),
live re-layout, restore defaults, defaults bit-identical to shipped constants.

## Key design decisions (made, verified against code)
1. **New engine type `ForceLayoutSettings`** — ONE atomic field on `ViewSettings`
   (like `sizing`). Fields (mechanism-named, UI uses native names):
   - `centerPullStrength` (Center force) — default 0.05, range [0, 0.15] step 0.01
   - `repelStrength` (Repel force) — POSITIVE magnitude, default 300, range [50, 1000] step 10.
     Negated at the d3 forceManyBody call site (WHY comment there). -(300) === -300 bit-identical.
   - `linkStrengthFactor` (Link force) — MULTIPLIER on d3's default per-link strength
     `1/min(degree(source),degree(target))`; default 1 → `1/m` bit-identical to d3's
     unset default (IEEE: `1/m === 1*(1/m)`; we compute `factor/m` so factor=1 gives exactly `1/m`).
     Range [0.25, 2] step 0.05. Degree map computed from the links array (replicates d3's
     internal `count`).
   - `linkGapPx` (Link distance) — default 40, range [10, 150] step 5
   - `collidePaddingPx` (Node spacing, advanced) — default 20, range [0, 80] step 5
   - `elkNodeSpacingPx` (Group member spacing, advanced) — NUMBER 40; `String(40)==="40"`
     identical to old `ELK_NODE_SPACING = "40"`. Range [10, 120] step 5.
2. **Ranges + defaults live ONCE in `src/engine/constants.ts`** as
   `FORCE_LAYOUT_RANGES` (min/max/step + WHY comments) + `clampForceLayoutSettings()`.
   UI sliders use ranges for setLimits; persistence parser clamps (makes degenerate
   values unreachable even via hand-edited JSON).
3. **Threading**:
   - elk spacing: `vicinityGraphToElk` reads `graph.viewSettings.forceLayout.elkNodeSpacingPx`
     directly (it already consumes graph.viewSettings.groupByFolder).
     `ELK_FORCE_ROOT_OPTIONS`/`ELK_GROUP_MEMBER_OPTIONS` constants → functions
     `elkForceRootOptions(px)` / `elkGroupMemberOptions(px)`; new `ELK_FORCE_ALGORITHM`
     const for GraphLayoutRunner's force-root detection.
   - d3 params: `refineForceRootLayout(root, forceLayout)` REQUIRED param;
     `GraphLayoutRunner.layout(graph, forceLayout = EngineDefaults.forceLayoutSettings())`
     optional-with-engine-default (WHY: keeps stranding/D3ForceLayout tests literally
     untouched per ticket; default IS the shipped default, documented). Port
     `GraphLayoutPort.layout(graph, forceLayout?)`. Controller passes
     `graph.viewSettings.forceLayout`. Threading guarded by a focused test
     (non-default linkGapPx ⇒ different positions).
4. **Live effect**: `GraphStructureDiff.decideLayout` must return "relayout" when
   forceLayout values changed (else reuse-layout skips elk+d3 and sliders do nothing).
   Add value-equality check (like the existing groupByFolder check).
5. **Persistence**: no version bump (backward-compat missing-field → default; matches
   sizing pattern). `parseForceLayout()` mirrors `parseSizing()` (complete-shape repair
   from defaults) + clamp.
6. **Write plan**: `{kind:"global-force-layout", forceLayout}` → `{kind:"global-view", view:{...ctx.globalView, forceLayout}}`.
7. **UI** (`VicinityGraphSettingTab.renderForceLayout()`): heading "Force layout";
   4 sliders (native names); `<details>` element for "Advanced spacing" (Obsidian has
   no collapsible Setting API; `new Setting(detailsEl)` works on any container);
   "Restore defaults" button → applies interaction with `EngineDefaults.forceLayoutSettings()`
   then `this.display()`.
8. **Internal, untouched**: D3_FORCE_COLLIDE_ITERATIONS stays a view constant;
   ELK_GROUP_PADDING, alphaDecay, elk seed params untouched.
9. `graphFixtures.makeViewSettings()` gets a hand-written forceLayout (file's style is
   deliberate literals) with values equal to defaults so view tests behave identically.
10. WHY comments for charge/link-gap/collide-padding/center-pull move from
    src/view/constants.ts to engine/constants.ts alongside the defaults.

## File touch list
- src/engine/types.ts (+ForceLayoutSettings, ViewSettings.forceLayout)
- src/engine/constants.ts (defaults, ranges, clamp, EngineDefaults.forceLayoutSettings)
- src/engine/ViewSettingsResolver.ts (+forceLayout: field(...))
- src/engine/index.ts (exports)
- src/persistence/persistedShapes.ts (parseForceLayout)
- src/view/settingsWritePlan.ts (interaction)
- src/view/constants.ts (remove 4 D3 consts + ELK_NODE_SPACING; option factories; ELK_FORCE_ALGORITHM)
- src/view/d3ForceRefinement.ts (params + explicit link strength)
- src/view/GraphLayoutRunner.ts, src/view/viewPorts.ts
- src/view/elkMapping.ts (spacing from graph.viewSettings)
- src/view/GraphStructureDiff.ts (+forceLayout change ⇒ relayout)
- src/view/GraphViewController.ts (pass forceLayout)
- src/view/VicinityGraphSettingTab.ts (renderForceLayout)
- src/view/testFixtures/graphFixtures.ts
- README.md settings section (brief), docs-internal/CHANGELOG.md

## Tests
- NEW src/engine/forceLayoutSettings.test.ts: defaults === shipped values
  (0.05/300/1/40/20/40 — guards "no default behavior change"); clamp behavior;
  defaults within ranges.
- settingsResolvers.test.ts: +2 (MAIN pins forceLayout wholesale; pinned fills gap)
- persistedShapes.test.ts: +3 (round-trip; mangled repair; out-of-range clamped)
- settingsWritePlan.test.ts: +1 (global-force-layout merge)
- GraphStructureDiff.test.ts: +2 (changed forceLayout ⇒ relayout; equal ⇒ reuse)
- NEW src/view/GraphLayoutRunner.test.ts: explicit-defaults === omitted-arg positions;
  non-default linkGapPx ⇒ different positions (threading guard). Also elkMapping
  spacing threading: root+member options carry String(elkNodeSpacingPx) — put in
  elkMapping.test.ts.
- d3ForceStranding.test.ts + D3ForceLayout.test.ts: UNTOUCHED, must stay green.
- elkMapping.test.ts: may need expected-layoutOptions updates ONLY if it asserts
  literal option objects (check lines ~39-50, 141) — values identical, so likely
  only if it references removed constants (it imports only ELK_GROUP_PADDING/ELK_ROOT_ID → probably fine).

## Order
types → engine constants → resolver → index → engine tests → persistence (+tests)
→ writePlan (+tests) → view constants → elkMapping → d3ForceRefinement →
GraphLayoutRunner/viewPorts → StructureDiff (+tests) → Controller → fixtures →
GraphLayoutRunner.test → SettingTab → README/CHANGELOG → npm test + check.

## Gotchas
- verbose output → .tmp/ (t04-*.log)
- do NOT commit (TOP_LEVEL_AGENT commits)
- strict TS: noUncheckedIndexedAccess; exactOptionalPropertyTypes (definedOnly helper)
- Obsidian slider: setLimits(min,max,step), setDynamicTooltip
