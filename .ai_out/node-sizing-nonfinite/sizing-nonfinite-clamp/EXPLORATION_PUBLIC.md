# Exploration: sizing non-finite clamp (ticket nid_8vmo5ibhv1bvh2ukrgmafpofj_e)

Commands: `npm test` (vitest run), `npm run check` (tsc -noEmit).

## 1. `src/engine/NodeSizer.ts` — full structure

- `NodeSize { sizeScore: number in [0,1]; sizePx: number }` (exported interface, `sizePx` is the diff-stable field per its doc comment).
- `SizeMetric` interface (not exported): `normalizedValues(nodes) -> ReadonlyMap<VaultPath, number>`.
- `NodeSizer.computeSizes(nodes, settings: SizingSettings)`:
  - L41-46: builds `enabledWeightedMetrics(settings)` → `{weight, metric}[]`, computes `totalWeight`, then per-metric `normalizedValues(nodes)`.
  - L47-56: for each node, `score = node.isCentral ? CENTRAL_SIZE_SCORE : composeScore(...)`; **`sizePx = settings.minPx + score * (settings.maxPx - settings.minPx)`** (L52) — this is where `minPx`/`maxPx` enter; no clamp/guard here at all today.
  - `composeScore` (L58-71): weighted average of per-metric normalized values; returns `NEUTRAL_NORMALIZED_VALUE` (0.5) if `totalWeight <= 0`. No guard against NaN/Infinity from an individual metric leaking into the sum.
  - `enabledWeightedMetrics` (L74-88): registry of 5 metrics keyed by `SizeMetricId`; `"depth-decay": new DepthDecayMetric(settings.depthDecayK)` (L83) — **`depthDecayK` flows in completely unguarded**.
- `MinMaxNormalizedMetric` (L109-134): generic min-max normalizer, has its own degenerate-input guard (`max === min` → `NEUTRAL_NORMALIZED_VALUE`), not the offending class.
- **`DepthDecayMetric` (L136-147) — the bug**:
  ```ts
  class DepthDecayMetric implements SizeMetric {
      constructor(private readonly k: number) {}
      normalizedValues(nodes): ReadonlyMap<VaultPath, number> {
          const normalized = new Map<VaultPath, number>();
          for (const [path, node] of nodes) {
              normalized.set(path, 1 / (1 + this.k * node.minDepth));
          }
          return normalized;
      }
  }
  ```
  No guard: `k = -1, minDepth = 1` → denominator 0 → `Infinity`; `k = Infinity, minDepth = 0` → `Infinity * 0` → `NaN`. Both propagate through `composeScore` → `sizePx` (L52) unclamped, since `minPx`/`maxPx` are also unguarded there.
- Exported surface (from `NodeSizer.ts` itself): `NodeSize`, `NodeSizer`. Re-exported via `src/engine/index.ts` (check that barrel when exposing anything new — layering rule: "Import engine symbols from `src/engine/index.ts`, not deep paths").
- **Test file**: `src/engine/NodeSizer.test.ts`. BDD style: `describe("NodeSizer <metric/topic>", ...)` blocks, each `it("WHEN … THEN …", ...)`. Helpers: `sizingWith(enabledMap, depthDecayK=1)` builds a full `SizingSettings` from `EngineDefaults.sizingSettings()`; `sizeAll(spec, settings, rootPaths?)` runs a `FakeLinkProvider` + `VicinityTraversal` + `NodeSizer` end to end; `score(sizes, path)` reads `sizeScore`. The `describe("NodeSizer depth-decay metric", ...)` block (L117-141) is the natural home for new k-guard tests (currently only covers k=1 and k=4, no degenerate k). No existing test constructs `depthDecayK = -1` or `Infinity`.

## 2. `src/engine/SettingsSpec.ts`

- Leaf shapes: `BoundedNumberSpec { default, min, max, step }`, `MinBoundedNumberSpec { default, min }`, `DefaultSpec<T> { default }` — three tiers of "how bounded is this field."
- `SizingSpec` (L59-64):
  ```ts
  interface SizingSpec {
      metrics: Readonly<Record<SizeMetricId, DefaultSpec<SizingMetricSetting>>>;
      depthDecayK: DefaultSpec<number>;   // NO bounds today
      minPx: DefaultSpec<number>;         // NO bounds today
      maxPx: DefaultSpec<number>;         // NO bounds today
  }
  ```
  All three sizing numeric fields use the unbounded `DefaultSpec<number>` — this is the structural gap the fix must close (change to `BoundedNumberSpec`, mirroring `ForceLayoutSpec`).
- Declared values (L143-156): `depthDecayK: { default: 1 }`, `minPx: { default: 40 }`, `maxPx: { default: 160 }`.
- By contrast, `ForceLayoutSpec = Readonly<Record<keyof ForceLayoutSettings, BoundedNumberSpec>>` (L66) — every force-layout field is `BoundedNumberSpec` with a `min`/`max`/`step` and an inline WHY-bounded comment (see e.g. `centerPullStrength`, `repelStrength`, L178-263). This is the pattern to imitate for sizing: give `depthDecayK`/`minPx`/`maxPx` explicit `min`/`max`/`step` and a WHY comment (e.g. `depthDecayK` min must exclude the `k = -1/minDepth` singularities; practically `min: 0` since negative k inverts decay and can hit `1 + k*minDepth = 0`).
- `NodeExclusionSpec`, `ViewSpec`, `DepthSpec`, `SettingsSpec` — the rest of the tree, unrelated to this bug except as structural precedent (`nodeCap: MinBoundedNumberSpec` shows the "min-only" tier already used elsewhere).
- Pure engine module (import-guarded, only imports `./types`).

## 3. `src/engine/constants.ts` — `clampForceLayoutSettings`

Full signature/body (L90-113):
```ts
export const FORCE_LAYOUT_RANGES: Readonly<Record<keyof ForceLayoutSettings, ForceLayoutRange>> =
    Object.fromEntries(
        Object.entries(SETTINGS_SPEC.globalView.forceLayout).map(([field, spec]) => [
            field,
            { min: spec.min, max: spec.max, step: spec.step },
        ]),
    ) as Readonly<Record<keyof ForceLayoutSettings, ForceLayoutRange>>;

export function clampForceLayoutSettings(settings: ForceLayoutSettings): ForceLayoutSettings {
    const clamp = (field: keyof ForceLayoutSettings): number => {
        const range = FORCE_LAYOUT_RANGES[field];
        return Math.min(range.max, Math.max(range.min, settings[field]));
    };
    return {
        centerPullStrength: clamp("centerPullStrength"),
        repelStrength: clamp("repelStrength"),
        linkStrengthFactor: clamp("linkStrengthFactor"),
        linkGapPx: clamp("linkGapPx"),
        collidePaddingPx: clamp("collidePaddingPx"),
        elkNodeSpacingPx: clamp("elkNodeSpacingPx"),
        edgeRoutingClearancePx: clamp("edgeRoutingClearancePx"),
    };
}
```
Style notes to mirror for a new `clampSizingSettings`:
- `Math.min(max, Math.max(min, value))` — no rounding (unlike `clampOutlineMaxDepth`, L47-49, which also rounds — sizing/depth-decay are not integers, so no rounding needed, same as force-layout).
- Named export, one field-by-field literal object return (not a generic loop over keys) — keeps it typo-safe against the `ForceLayoutSettings` type.
- `FORCE_LAYOUT_RANGES` is a derived `Readonly<Record<...>>` projected once from `SETTINGS_SPEC` — an equivalent `SIZING_RANGES` (or reuse per-field constants) would serve both `clampSizingSettings` and the UI slider/number-input bounds.
- IMPORTANT: `Math.min(range.max, Math.max(range.min, settings[field]))` with `NaN` or `Infinity` input: `Math.max(min, Infinity) === Infinity`, then `Math.min(max, Infinity) === max` — so `Math.min/Math.max` clamping already fixes ±Infinity correctly (finite max/min wins). `NaN` however: `Math.max(min, NaN) === NaN` and `Math.min(max, NaN) === NaN` — **`Math.min`/`Math.max` do NOT filter `NaN`**, so `clampForceLayoutSettings` itself would NOT rescue a NaN force-layout field either. This is a real gap in the existing pattern, not just the new sizing code — the plan should decide whether `clampSizingSettings` needs an explicit `Number.isFinite` fallback-to-default check before/instead of the min/max clamp (this is exactly why the ticket also asks for a last-line guard inside `DepthDecayMetric`, since a NaN there cannot be caught by a bare min/max clamp).
- **ALL call sites of `clampForceLayoutSettings`** (repo-wide grep):
  1. `src/persistence/persistedShapes.ts` `parseForceLayout` (persistence-LOAD path) — the only production call site.
  2. `src/persistence/persistedShapes.test.ts` — indirectly exercised via `PersistedShapes.parseDocData`/`parsePluginData` tests (no direct unit test of `clampForceLayoutSettings` itself found under `src/engine`).
  - NOTABLE GAP: `clampForceLayoutSettings` is **NOT** called from any UI-write path (`settingsWritePlan.ts`, `PluginDataStore.saveGlobalView`, `VicinityGraphSettingTab.ts`, `ControlsActions.ts`) — only from the persistence parser on load. The ticket's design decision for sizing explicitly asks for BOTH load-path AND UI-write-path clamping, which is a **stricter bar than the existing force-layout precedent**. Implementer should note this divergence (and may want to flag whether force-layout should also get write-path clamping, though that is likely out of scope — file a ticket per CLAUDE.md guardrails rather than silently expanding scope).

## 4. Persistence load path — `src/persistence/persistedShapes.ts`

- `parseSizing(raw)` (search `function parseSizing`): builds a complete `SizingSettings` from `EngineDefaults.viewSettings().sizing` defaults, per-field:
  ```ts
  return {
      metrics,
      depthDecayK: numberOrUndefined(raw["depthDecayK"]) ?? defaults.depthDecayK,
      minPx: numberOrUndefined(raw["minPx"]) ?? defaults.minPx,
      maxPx: numberOrUndefined(raw["maxPx"]) ?? defaults.maxPx,
  };
  ```
  `numberOrUndefined(value)` = `typeof value === "number" && Number.isFinite(value) ? value : undefined`. **This already rejects `Infinity`/`NaN`/`1e999`-parsed-Infinity at JSON-load time** (falls back to the default) — so the persistence-load path is NOT where `Infinity` sneaks in from a round-tripped `data.json`. The actual reachable path for the bug is: a user types `1e999` (or `-1`, `Infinity`) directly into the SizingSection/settings-tab number input during a live session — that value is `Number.isFinite`-true... wait, `Infinity` fails `Number.isFinite` too, so a truly non-finite value would never survive even the live-session write IF the UI validated with `Number.isFinite` — but today the UI only checks `!Number.isNaN` (see section 5), which passes `Infinity`. So the live in-session settings object (`ViewSettings.sizing`) can hold `Infinity`/`-1` even though a **reloaded** `data.json` would have self-healed it. Both angles need fixing per the ticket.
- **Fix insertion point**: wrap the returned object in a new `clampSizingSettings(...)` call, exactly parallel to how `parseForceLayout` wraps its return in `clampForceLayoutSettings(...)`:
  ```ts
  function parseSizing(raw: unknown): SizingSettings | undefined {
      ...
      return clampSizingSettings({
          metrics,
          depthDecayK: numberOrUndefined(raw["depthDecayK"]) ?? defaults.depthDecayK,
          minPx: numberOrUndefined(raw["minPx"]) ?? defaults.minPx,
          maxPx: numberOrUndefined(raw["maxPx"]) ?? defaults.maxPx,
      });
  }
  ```
  `parseForceLayout` is the direct sibling/precedent (same file, same "whole object replaces wholesale in the view cascade" doc comment pattern — see the JSDoc directly above `parseSizing` and above `parseForceLayout`).
- Both `parseSizing` and `parseForceLayout` are called from `parseViewOverride` (used by both `parsePluginData`'s `globalView` parse and `parseDocData`'s `view` parse) — so fixing `parseSizing` covers both `data.json` (global) and any per-doc `view.sizing` override in one place. (Confirmed: no other production write path stores a per-doc `sizing` override — `DocDataMutations`/`DocDataStore` do not reference `sizing`; only the global `saveGlobalView` command carries it.)

## 5. UI write paths

### `src/view/SizingSection.tsx` (React in-view panel, step-06 Phase C "sizing mirror")
- Fully controlled off `ViewSettings.sizing`; writes go through `applySizing(next) → planSettingsWrite({kind:"global-sizing", sizing: next}, ctx)` (global write, same path the settings tab uses — see doc comment L9-19).
- `SizingNumber` helper (L100-129) — generic labelled numeric `<input type="number">`:
  ```ts
  onChange={(event) => {
      if (!Number.isNaN(event.target.valueAsNumber)) {
          onChange(event.target.valueAsNumber);
      }
  }}
  ```
  **Only guards `NaN`, not `Infinity`** — typing `1e999` in a browser number input parses to `Infinity` via `valueAsNumber`, `Number.isNaN(Infinity) === false`, so it passes straight through to `applySizing`. This is exactly the "1e999 passes settings guards" half of the ticket.
- Depth-decay-k field uses `min={0}` as an HTML attribute only (L88-93) — HTML `min` on `<input type="number">` does NOT block typed/pasted out-of-range or non-finite values (only affects the stepper arrows and `:invalid` CSS pseudo-class), matching `edgeRouting.ts`'s comment (see section 7) "the `min` attribute on the settings input does not block typed values."
- Fix belongs at the point values leave this component: either (a) tighten `SizingNumber`'s guard to `Number.isFinite` instead of `!Number.isNaN` (cheap, but only catches this one component, not the settings tab's independent input), or (b) — matching the ticket's "clamp at the SETTINGS BOUNDARY" decision — leave the per-keystroke UI guard mostly as-is and instead clamp in `applySizing`/`setMetric` before calling `planSettingsWrite`, OR clamp inside `planSettingsWrite`'s `"global-sizing"` case (single choke point shared by both UI surfaces, see below).

### `src/view/VicinityGraphSettingTab.ts` (Obsidian PluginSettingTab)
- `renderSizing()` (grep `private renderSizing`): builds toggle+weight rows per metric, then three `addSizingNumber(...)` calls for `minPx` (min 1, step 4), `maxPx` (min 1, step 4), `depthDecayK` (min 0, step 0.5), each calling `this.applySizing({...sizing, field})` → `applyInteraction({kind:"global-sizing", sizing})` (same `SettingsInteraction` union as the React panel).
- `addSizingNumber` (private helper, near end of file):
  ```ts
  text.onChange((raw) => {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed >= min) {
          void onChange(parsed);
      }
  });
  ```
  Guards `NaN` and enforces the lower `min` bound (`Number(raw) >= min`) but has **no upper bound** and **`Number.isNaN(Infinity) === false`, `Infinity >= min` is true** — so `1e999`/`Infinity` typed here also passes straight through. This is the settings-tab twin of the SizingSection gap; both must be covered, or (better) both must be made irrelevant by clamping at the shared write choke point.
- **Both UI surfaces converge on `SettingsInteraction {kind: "global-sizing", sizing}` → `planSettingsWrite` → `SettingsCommand {kind: "global-view", view}` → `store.saveGlobalView(view)`.** This is the single natural choke point for "clamp on every UI-write path" without duplicating clamp logic in both `SizingSection.tsx` and `VicinityGraphSettingTab.ts`:
  - `src/view/settingsWritePlan.ts` L102-103: `case "global-sizing": return { kind: "global-view", view: { ...ctx.globalView, sizing: interaction.sizing } };` — could clamp `interaction.sizing` here with `clampSizingSettings` before merging (pure function, already engine-imported: `ForceLayoutSettings`/`SizingSettings` types come from `../engine`, and `clampOutlineMaxDepth`/`clampForceLayoutSettings`-style helpers are meant to be imported from the engine barrel).
  - Alternative choke point: `src/persistence/PluginDataStore.saveGlobalView(globalView)` (L47) — currently does NOT clamp anything (force-layout isn't clamped here either, only at load). Clamping inside `saveGlobalView` would ALSO retroactively harden `saveGlobalView` callers other than sizing (defense in depth) but changes behavior for `forceLayout` too if a shared `sanitizeViewSettings` were added — likely more scope than this ticket wants; prefer clamping precisely in `planSettingsWrite`'s `"global-sizing"` case (or in `SizingSection`/`VicinityGraphSettingTab` at the call site) so the change stays narrowly scoped to `sizing`, matching the ticket.
  - `settingsResetPlan.ts` (L91) already writes `EngineDefaults.sizingSettings()` for the "reset sizing" action — always in-bounds by construction, not a risk path, no change needed there.

## 6. `src/view/graphIdentity.ts` — `nodeDimensionsPx`

```ts
export function nodeDimensionsPx(node: GraphNode): NodeDimensions {
    return {
        width: Math.max(node.sizePx, Math.min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(node.title))),
        height: node.sizePx,
    };
}
```
`height` is `node.sizePx` directly — an `Infinity`/`NaN` `sizePx` here becomes an `Infinity`/`NaN` React-Flow node height/width directly (width: `Math.max(Infinity, anything) = Infinity`; `Math.max(NaN, x) = NaN`). This function is PURE and has no guard of its own — it is a downstream CONSUMER, not a place to add the fix (per the ticket's boundary-clamp design), but it is the last hop before `Infinity`/`NaN` becomes an actual rendered/laid-out pixel dimension, so it's worth an assertion/regression test showing that once `NodeSizer`/settings are fixed, `nodeDimensionsPx` never sees non-finite input (rather than adding a redundant guard inside `nodeDimensionsPx` itself).

## 7. Other consumers of sizing settings / NodeSizer output

- `src/engine/VicinityEngine.ts` L86: `sizePx: size.sizePx` — copies `NodeSizer` output into the engine's `GraphNode`. Pure pass-through, no guard; this is the seam between `NodeSizer` and everything downstream (`graphIdentity.ts`, `flowMapping.ts`, `edgeRouting.ts`, `GraphStructureDiff.ts`, `main.ts`).
- `src/view/flowMapping.ts` L52/L315: `FlowNode.sizePx` field, copied straight from `GraphNode.sizePx` into the React-Flow node model (`sizePx: node.sizePx`). No guard.
- `src/main.ts` L208: `sizePx: node.sizePx` — another copy into whatever `main.ts`'s own node shape is (likely the elk-layout input or persistence-diff structure). No guard.
- `src/view/GraphStructureDiff.ts` L87-101 (`anyNodeGrewBeyond`): compares `node.sizePx` growth ratio between the previous and next render to decide whether a relayout is warranted; already treats `previousSize <= 0` as "no meaningful ratio" (guards divide-by-zero one direction), documented as relying on the invariant "`sizePx` is >= `minPx` in practice" (L87-88 comment) — an invariant this ticket's fix should preserve/restore. An `Infinity`/`NaN` `sizePx` would make `growthRatio` `Infinity`/`NaN`, and `NaN > threshold` is always `false` (so a NaN size would silently NOT trigger the "grew" relayout signal — a secondary, less severe symptom worth being aware of but not necessarily worth a dedicated fix here since the settings-boundary fix removes the non-finite value upstream).
- **`src/view/edgeRouting.ts` — ALREADY DOCUMENTS THIS EXACT BUG** (L172-186, function `hasFiniteGeometry`):
  ```ts
  /**
   * Guards the ONE input class libavoid cannot survive: a `NaN`/`±Infinity` rectangle
   * makes `processTransaction()` ABORT the Emscripten module, and `loadAvoid()` is a
   * load-once singleton — so a single bad obstacle silently degrades EVERY later pass
   * of the Obsidian session to straight edges. Zero-size and negative-size rects are
   * fine; only non-finiteness is fatal, so nothing else is rejected here.
   *
   * NOT paranoia: `Depth decay k = -1` in the sizing panel makes `NodeSizer`'s
   * `1 / (1 + k * minDepth)` divide by zero, and that `Infinity` reaches `sizePx` →
   * `FlowNode.width/height` → this obstacle unclamped (`depthDecayK` has no engine-side
   * clamp; the `min` attribute on the settings input does not block typed values).
   * ...
   */
  function hasFiniteGeometry(obstacle: RoutingObstacle): boolean {
      return (
          Number.isFinite(obstacle.x) && Number.isFinite(obstacle.y) &&
          Number.isFinite(obstacle.widthPx) && Number.isFinite(obstacle.heightPx)
      );
  }
  ```
  This is a pre-existing, ALREADY-SHIPPED "last-line-of-defence" guard against exactly the same non-finite `sizePx` — it filters bad obstacles out of edge routing (obstacle + its edges dropped, per `extractRoutingObstacles` L60-66 in the same file: `if (!hasFiniteGeometry(obstacle)) continue;`). **This does NOT need to change** — it's evidence the layering discipline ("guard where a fatal input meets an external boundary — libavoid/Emscripten here") is already established in this codebase, and the DepthDecayMetric last-line guard the ticket calls for is the analogous discipline one layer up (engine boundary, not view/routing boundary). The implementer should leave `hasFiniteGeometry` alone but MAY want to update/trim its doc comment once the settings-boundary fix ships (comment currently says `depthDecayK` has "no engine-side clamp" — that becomes stale after the fix, though `hasFiniteGeometry` should stay as defense-in-depth regardless, per libavoid's Emscripten-abort risk being from ANY future source of non-finite geometry, not just this one).
- `src/view/constants.ts` — `RELAYOUT_SIZE_GROWTH_THRESHOLD`-type constant for `GraphStructureDiff`; not itself a sizing-settings consumer, just a threshold literal.

## 8. Existing test files (paths + coverage)

- **`src/engine/NodeSizer.test.ts`** (see section 1) — main target for a new `DepthDecayMetric` degenerate-k guard test (`describe("NodeSizer depth-decay metric", ...)` block). Fixture pattern: `sizingWith(enabledMap, depthDecayK)` from `EngineDefaults.sizingSettings()`, then `sizeAll(spec, settings, roots)`.
- **`src/persistence/persistedShapes.test.ts`** — `describe("PersistedShapes sizing parsing", ...)` (search that string) covers: round-trip-unchanged, partial-mangle-repaired-from-defaults, non-object-inherits. **No clamping test today** (unlike the sibling `describe("PersistedShapes force-layout parsing", ...)` block which DOES have a `"WHEN persisted forceLayout carries out-of-range values THEN they are clamped into the slider ranges"` test — copy this pattern verbatim for sizing, adding cases for `minPx`/`maxPx`/`depthDecayK` out-of-range AND non-finite-that-slipped-past-`numberOrUndefined` — though `numberOrUndefined` already filters `Infinity`/`NaN` themselves, so the persistence-layer test should focus on large-but-finite/negative values that a clamp must still catch, e.g. `depthDecayK: -1` (finite!), `minPx: -50`, `maxPx: 1e10`).
- **`src/engine/constants.ts` has no dedicated `constants.test.ts`** — `clampForceLayoutSettings` itself appears to have NO direct unit test (only indirectly via `persistedShapes.test.ts`'s force-layout describe block). Confirms the pattern: clamp helpers are tested through their persistence-parser call site, not standalone — follow suit for `clampSizingSettings` (test via `persistedShapes.test.ts`, no separate `constants.test.ts` needed, though one could be added if the plan wants isolated unit coverage of the clamp function's edge cases like `NaN` input, since `Math.min/Math.max` do not filter `NaN` — see section 3's flagged gap).
- **`src/view/sizingMetrics.test.ts`** / **`src/view/sizingMetrics.ts`** — defines `SIZING_METRICS` (the `{id, label}[]` array both UI surfaces iterate over for metric toggle rows); unrelated to numeric bounds, low relevance to this ticket.
- **`src/view/edgeRouting.test.ts`** — per the `hasFiniteGeometry` doc comment (section 7), this file already asserts bounds like `ARROWHEAD_HALF_WIDTH_PX` and `GROUP_SIDE_PADDING_PX` against the routing-clearance range; grep it for any existing `hasFiniteGeometry`/non-finite-obstacle test to confirm the downstream guard's coverage stays green (should be unaffected by this fix, since it operates on already-computed `sizePx`, but worth a quick check that no test there ASSUMES a bad `depthDecayK` reaches routing — such a test, if any, is testing the pre-fix behavior and may need updating/removing once the settings boundary rejects the bad value earlier).
- No `VicinityGraphSettingTab.test.ts` or `SizingSection.test.tsx` were found in the initial glob (only `NodeSizer.test.ts`, `sizingMetrics.test.ts`, `persistedShapes.test.ts` reference sizing) — re-check with `find src -iname "*SettingTab*" -o -iname "*SizingSection*"` before assuming no UI-level test coverage exists; if present, they were not located by the `*sizing*`/`*NodeSizer*` glob and should be searched by component name directly.

## 9. Pre-existing clamping/validation helpers (stay DRY)

- `clampOutlineMaxDepth(value)` (`src/engine/constants.ts` L47-49) — `Math.min(max, Math.max(min, Math.round(value)))`, single-field clamp, shared by slider AND persistence parser. Simplest precedent, rounds (not applicable to sizing's continuous fields).
- `clampForceLayoutSettings(settings)` (`src/engine/constants.ts` L99-113) — THE direct structural precedent for `clampSizingSettings`: whole-object clamp over a `Record<keyof X, BoundedNumberSpec>`-shaped range table, called only from the persistence parser today (see section 3's noted gap re: UI-write-path clamping).
- `numberOrUndefined(value)` (`src/persistence/persistedShapes.ts`, module-private) — the `Number.isFinite` gate already used per-field before ANY numeric persisted value (including `minPx`/`maxPx`/`depthDecayK` today) is accepted; this already blocks non-finite values from surviving a `data.json` round trip, so the persistence-layer gap is narrower than the live-session/UI-write gap (see section 4).
- `hasFiniteGeometry(obstacle)` (`src/view/edgeRouting.ts` L178-186) — the sibling "reject non-finite, everything else is fine" last-line guard at the libavoid/Emscripten boundary; same *shape* of guard the ticket wants inside `DepthDecayMetric`, one layer earlier (engine vs. view/wasm boundary).
- `FORCE_LAYOUT_RANGES` (`src/engine/constants.ts` L90-96) — derived `Readonly<Record<field, {min,max,step}>>` projected once from `SETTINGS_SPEC`; the precedent for a `SIZING_RANGES` (or equivalent per-field named constants, e.g. following `MIN_NODE_CAP`/`MIN_STEPPER_DEPTH`'s naming style at the top of `constants.ts`) that both `clampSizingSettings` and the two UI surfaces' `<input min/max/step>` attributes should read from — single source of truth end-to-end, matching the file's stated design intent (`constants.ts` header comment L11-15: "SETTINGS_SPEC is the single source of truth for every settings default AND limit").

## Summary of touch points for the implementation plan

1. `src/engine/SettingsSpec.ts` — change `SizingSpec.depthDecayK`/`minPx`/`maxPx` from `DefaultSpec<number>` to `BoundedNumberSpec` (add `min`/`max`/`step` + WHY comments), mirroring `ForceLayoutSpec`.
2. `src/engine/constants.ts` — add `SIZING_RANGES` (parallel to `FORCE_LAYOUT_RANGES`) and `clampSizingSettings(settings: SizingSettings): SizingSettings` (parallel to `clampForceLayoutSettings`); decide whether it needs an explicit `Number.isFinite` fallback given `Math.min/Math.max` do not filter `NaN` (flagged gap, section 3).
3. `src/engine/NodeSizer.ts` `DepthDecayMetric.normalizedValues` — add the "last-line-of-defence" guard: reject non-finite `k` and a zero (or otherwise degenerate) denominator, falling back to a sane value (e.g. `NEUTRAL_NORMALIZED_VALUE`, matching `MinMaxNormalizedMetric`'s existing degenerate-input convention) rather than propagating `Infinity`/`NaN`.
4. `src/persistence/persistedShapes.ts` `parseSizing` — wrap the returned object in `clampSizingSettings(...)`, exactly parallel to `parseForceLayout`.
5. UI write paths (`src/view/SizingSection.tsx`, `src/view/VicinityGraphSettingTab.ts`) and/or the shared choke point `src/view/settingsWritePlan.ts` `"global-sizing"` case — apply `clampSizingSettings` (or equivalent) on the LIVE in-session write, not just on reload-from-disk, per the ticket's explicit ask ("applied on both persistence-load and UI-write paths") — this is stricter than the current `forceLayout` precedent, which only clamps on load; flag/confirm this divergence explicitly rather than silently matching forceLayout's narrower behavior.
6. Update slider/input `min`/`max`/`step` HTML attributes in both UI surfaces to read from the new `SIZING_RANGES` (currently hardcoded `min={1}`/`min={0}` literals in `SizingSection.tsx` L76,84,90 and `addSizingNumber(...)` call args in `VicinityGraphSettingTab.ts` L344-352) so slider bounds and the clamp agree (matching `outlineMaxDepth`'s and `forceLayout`'s "same source" comments).
7. Tests: extend `src/engine/NodeSizer.test.ts`'s depth-decay `describe` block (degenerate k cases), extend `src/persistence/persistedShapes.test.ts`'s sizing `describe` block with a clamping test mirroring the force-layout one, and consider `src/engine/constants.test.ts` (does not currently exist) if isolated `clampSizingSettings` unit coverage is wanted beyond the persistence-parser integration test.
8. Leave `src/view/edgeRouting.ts` `hasFiniteGeometry` as-is (defense in depth); consider trimming its doc comment's now-stale "`depthDecayK` has no engine-side clamp" claim once the fix lands.
