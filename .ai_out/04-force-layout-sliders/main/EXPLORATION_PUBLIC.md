# EXPLORATION — Ticket 04: Force-Layout Tuning Sliders

## Ticket Summary

Expose 6 numeric sliders for force-layout tuning, wired through the existing settings pipeline with live re-layout, persistence, and BDD tests:
- **Native-parity section (4 sliders)**: Center force, Repel force, Link force, Link distance — named to match Obsidian's native graph view
- **Advanced section (2 sliders)**: Node spacing, Group member spacing — for layout aesthetics tuning

Ranges must be clamped to prevent degenerate combos. Sliders take effect without plugin reload. Restore-defaults affordance required. The stranding metric test (ticket-03) must stay green at defaults.

---

## 1. SETTINGS WIRING PATTERN (END-TO-END)

### Representative Example: `depthDecayK` (numeric sizing setting)

The ticket adds numeric settings to the **engine layer** (`ViewSettings` type), not the view layer. This is a CRITICAL distinction: new force-layout parameters must flow through the engine's settings cascade (resolution + persistence) so they work with pinned-doc overrides, not as view-only constants.

### Files Involved (in pipeline order)

| # | File | Purpose | Lines | Touchpoints |
|---|------|---------|-------|-------------|
| 1 | `src/engine/types.ts` | Define `ViewSettings` interface (engine's settings contract) | 195-201 | Add new numeric fields to `ViewSettings` interface |
| 2 | `src/engine/constants.ts` | Define `DEFAULT_*` constants & `EngineDefaults` factory | 19-20, 52-65, 72-79 | Add `DEFAULT_XXX_PARAM = value` at top; add field to `EngineDefaults.viewSettings()` factory (line 72-79 returns object with all fields) |
| 3 | `src/engine/ViewSettingsResolver.ts` | Cascade resolution (MAIN override → pinned → global) | 29-52 | No changes needed (already generic field resolution via `field()` helper, lines 33-45) |
| 4 | `src/persistence/persistedShapes.ts` | Versioned JSON parsing + defensive repair | 32, 86-98, 131-148, 156-172 | Current `PERSISTED_SHAPE_VERSION = 2`; update `parseViewOverride()` (lines 131-148) to recognize new fields; if nested object (like future layout settings), add parsing helper like `parseSizing()` (lines 156-172) |
| 5 | `src/view/settingsWritePlan.ts` | User interaction → persistence command mapping | 23-41, 68-95 | Add new `SettingsInteraction` kind (e.g., `{ kind: "global-force-layout", forceLayout: ForceLayoutSettings }`); add case in `planSettingsWrite()` to emit `{ kind: "global-view", view: {...} }` with merged field |
| 6 | `src/view/constants.ts` | View-layer force constants (NOT engine-facing) | 65, 89, 96, 103, 110, 118 | Current constants are **read-only hardcodes**; to make them tunable, must move numeric values into `ViewSettings` and pass through engine. WHY comments (lines 88, 92-96, 99-103, 105-110, 112-118) stay in code; values become parameters. |
| 7 | `src/view/d3ForceRefinement.ts` | d3-force simulation setup (consumes constants) | 5-10, 72, 75-78 | Accept new parameters (passed from engine-resolved `ViewSettings`); replace hardcoded constants with parameters at call sites: line 72 (D3_FORCE_LINK_GAP_PX), line 75 (D3_FORCE_CHARGE_STRENGTH), lines 76-78 (collide padding + center pull) |
| 8 | `src/view/elkMapping.ts` | ELK layout seeding (consumes `ELK_NODE_SPACING`) | 3, 48, 69 | Import ELK_NODE_SPACING from constants or pass as parameter; replace hardcoded value at lines 48 (group member options) and 69 (root options) |
| 9 | `src/view/GraphLayoutRunner.ts` | Orchestrates elk seed → d3 refinement | 2-4, 17-22 | No changes (already generic; just calls `ElkLayoutRunner` then `refineForceRootLayout()`) |
| 10 | `src/view/GraphViewController.ts` | Rebuilds on settings change → re-runs layout pipeline | 152-154, 200, 213 | Already handles `handleSettingsChanged()` (lines 152-154) which calls `runRebuild()` → passes engine graph to `vicinityGraphToElk()` (line 213) → layout runner processes it. No direct changes needed if parameters flow through `VicinityGraph.viewSettings`. |
| 11 | `src/view/VicinityGraphSettingTab.ts` | Settings UI: render controls, apply interactions | 43-273 | Add new section (e.g., `renderForceLayout()`) with slider/text controls for each parameter; call `applyInteraction()` to emit command; sliders route through existing write plan (lines 251-272) |
| 12 | Test files (5 new BDD suites; see section 4) | Verify each layer | — | — |

### Wiring Decision Point: CRITICAL ARCHITECTURE

**PROBLEM:** Force-layout constants currently live in `src/view/constants.ts` as **read-only hardcodes**. They do NOT flow through the engine or persist.

**SOLUTION:** Move numeric values into `ViewSettings`, thread them through the engine-persistence pipeline, and refactor consuming code to accept them as parameters.

**LAYERING CONSEQUENCE:** 
- `src/engine/types.ts::ViewSettings` gains new fields (e.g., `forceChargeStrength: number`)
- `src/view/constants.ts` keeps WHY comments; numeric values move to defaults (engine constants)
- `d3ForceRefinement.ts` and `elkMapping.ts` accept parameters instead of importing constants
- **The signature of functions must change** (e.g., `refineForceRootLayout(root, params)` instead of `refineForceRootLayout(root)`)

---

## 2. FORCE-LAYOUT CONSTANTS & CONSUMPTION

### Current Values in `src/view/constants.ts`

| Constant | Line | Current Value | WHY Comment | Where Consumed |
|----------|------|---------------|-------------|-----------------|
| `ELK_NODE_SPACING` | 65 | `"40"` | Minimum gap between sibling nodes in elk layout | `src/view/elkMapping.ts:48,69` (both ELK_FORCE_ROOT_OPTIONS and ELK_GROUP_MEMBER_OPTIONS) |
| `D3_FORCE_CHARGE_STRENGTH` | 89 | `-300` | Repulsion between root-level boxes (d3 `forceManyBody` strength); moderate to let collision + link distances do packing | `src/view/d3ForceRefinement.ts:75` (`.force("charge", forceManyBody().strength(...))`) |
| `D3_FORCE_LINK_GAP_PX` | 96 | `40` | Extra length on link's resting distance beyond half-extents; spring pulls partners into touching range, rect collide owns separation | `src/view/d3ForceRefinement.ts:72` (link distance calculation: `minHalfExtent(s) + minHalfExtent(t) + D3_FORCE_LINK_GAP_PX`) |
| `D3_FORCE_COLLIDE_PADDING_PX` | 103 | `20` | Minimum gap enforced between each **PAIR** of boxes by rect-collide force (applied once per pair, not per box); ticket-03 prototype: doubling worsened crowded layouts | `src/view/d3ForceRefinement.ts:76` (`.force("collide", forceRectCollide(D3_FORCE_COLLIDE_PADDING_PX, ...))`) |
| `D3_FORCE_CENTER_PULL_STRENGTH` | 110 | `0.05` | Weak pull of every box toward layout centre (d3 `forceX`/`forceY`); must stay well below link strength (~1) or graph collapses onto hub | `src/view/d3ForceRefinement.ts:77-78` (`.force("x", forceX().strength(...))` and `.force("y", forceY().strength(...))`) |
| `D3_FORCE_COLLIDE_ITERATIONS` | 118 | `2` | Rect-collide relaxation passes per tick; 1 leaves residual overlaps, 2 resolves them, 3 gained nothing per prototype | `src/view/d3ForceRefinement.ts:76` (second arg to `forceRectCollide()`) |

### Layout Pipeline Orchestration

```
Graph Build (engine) 
  ↓
Graph.viewSettings (carries force parameters)
  ↓
vicinityGraphToElk(graph)  [src/view/elkMapping.ts:30-72]
  ├─ Sets ELK_FORCE_ROOT_OPTIONS (line 69: hard-coded in object literal)
  └─ Sets ELK_GROUP_MEMBER_OPTIONS (line 48: hard-coded in object literal)
  ↓
ElkLayoutRunner.layout(elkRoot)  [src/view/ElkLayoutRunner.ts]
  └─ Runs elk force seed with those options
  ↓
refineForceRootLayout(laidOut)  [src/view/d3ForceRefinement.ts:39-95]
  └─ Hard-codes constants at lines 72, 75-78
  ↓
Extract positions & render
```

### Code Locations (Exact)

**d3ForceRefinement.ts — force setup:**
```typescript
// Line 72: link distance
.distance((link) => minHalfExtent(...) + minHalfExtent(...) + D3_FORCE_LINK_GAP_PX)

// Line 75: charge/repel force
.force("charge", forceManyBody<ForceBody>().strength(D3_FORCE_CHARGE_STRENGTH))

// Line 76: rect-collide (padding + iterations)
.force("collide", forceRectCollide<ForceBody>(D3_FORCE_COLLIDE_PADDING_PX, D3_FORCE_COLLIDE_ITERATIONS))

// Lines 77-78: center pull
.force("x", forceX<ForceBody>(0).strength(D3_FORCE_CENTER_PULL_STRENGTH))
.force("y", forceY<ForceBody>(0).strength(D3_FORCE_CENTER_PULL_STRENGTH))
```

**elkMapping.ts — elk options:**
```typescript
// Lines 48, 69: ELK_NODE_SPACING embedded in layout options
layoutOptions: { ...ELK_FORCE_ROOT_OPTIONS }    // line 69
layoutOptions: { ...ELK_GROUP_MEMBER_OPTIONS, ... }  // line 48
```

---

## 3. LAYOUT FLOW & PARAMETER THREADING

### Current Flow (Constants Hardcoded)

1. `GraphViewController.runRebuild()` (line 213) calls `vicinityGraphToElk(graph)`
2. `vicinityGraphToElk()` returns an `ElkNode` with hardcoded layout options
3. `GraphLayoutRunner.layout()` passes it to `ElkLayoutRunner` (elk seed) then `refineForceRootLayout()` (d3)
4. Both functions read from module-level constants
5. `GraphViewController` publishes positions back to React

### Required Change: Parameter Threading

To expose sliders, parameters must be **extracted from `ViewSettings`** and **threaded through the layout functions**:

```typescript
// BEFORE
refineForceRootLayout(root: ElkNode): ElkNode
  // Reads D3_FORCE_CHARGE_STRENGTH, etc. from constants

// AFTER
refineForceRootLayout(
  root: ElkNode,
  forceParams: {
    chargeStrength: number;
    linkGapPx: number;
    collidePaddingPx: number;
    centerPullStrength: number;
    collideIterations: number;
  }
): ElkNode
```

### Call Chain Updates

1. **GraphViewController.runRebuild()** (line 213):
   ```typescript
   // Extract params from resolved graph.viewSettings
   const forceParams = {
     chargeStrength: graph.viewSettings.forceChargeStrength,
     // ... other fields
   };
   const laidOut = await this.layoutRunner.layout(vicinityGraphToElk(graph), forceParams);
   ```

2. **GraphLayoutRunner.layout()** (line 17):
   ```typescript
   async layout(graph: ElkNode, forceParams?: ForceLayoutParams): Promise<ElkNode> {
     const laidOut = await this.elk.layout(graph);
     const isForceRoot = ...;
     return isForceRoot ? refineForceRootLayout(laidOut, forceParams) : laidOut;
   }
   ```

3. **refineForceRootLayout()** (line 39):
   ```typescript
   export function refineForceRootLayout(root: ElkNode, params: ForceLayoutParams): ElkNode {
     // Use params.chargeStrength instead of D3_FORCE_CHARGE_STRENGTH
     .force("charge", forceManyBody().strength(params.chargeStrength))
     // ...
   }
   ```

### ELK Node Spacing Threading

**Current:** `ELK_NODE_SPACING` is a string constant `"40"` hardcoded in layout options.

**Options:**
- **A:** Keep as view-layer constant (not user-tunable) — sliders only cover d3-force params
- **B:** Add to `ViewSettings` and thread through `vicinityGraphToElk()` — more complex, requires callback or context

**Recommendation:** **Option B** (ticket scope says "Advanced: Node spacing → ELK_NODE_SPACING"). The function `vicinityGraphToElk()` would accept an optional `elkNodeSpacing` parameter:

```typescript
export function vicinityGraphToElk(
  graph: VicinityGraph,
  elkNodeSpacing: string = ELK_NODE_SPACING  // default to current constant
): ElkNode {
  // Line 48, 69: use elkNodeSpacing instead of ELK_NODE_SPACING
  layoutOptions: { "elk.spacing.nodeNode": elkNodeSpacing }
}
```

**Consumed at:**
- `elkMapping.ts:48` (group member options)
- `elkMapping.ts:69` (root force options)

---

## 4. EXISTING TESTS TO MIRROR

### Test Suites & BDD Patterns

#### A. Settings Write Plan Tests

**File:** `src/view/settingsWritePlan.test.ts` (85 lines)

**Pattern:** WHEN/THEN BDD; one behavior per test.

**Existing coverage for numeric sizing fields:**
```typescript
describe("planSettingsWrite global writes", () => {
  it("WHEN global-sizing THEN it merges the sizing object over ctx.globalView", () => {
    const sizing = { ...EngineDefaults.viewSettings().sizing, minPx: 20, maxPx: 200 };
    expect(planSettingsWrite({ kind: "global-sizing", sizing }, CTX)).toEqual({
      kind: "global-view",
      view: { ...CTX.globalView, sizing },
    });
  });
});
```

**For ticket-04:** Create similar tests for force-layout params (new `global-force-layout` interaction):
```typescript
describe("planSettingsWrite force-layout", () => {
  it("WHEN global-force-layout params THEN it merges over ctx.globalView", () => {
    const forceLayout = { chargeStrength: -250, linkGapPx: 50, ... };
    expect(planSettingsWrite({ kind: "global-force-layout", forceLayout }, CTX)).toEqual({
      kind: "global-view",
      view: { ...CTX.globalView, forceLayout },
    });
  });
});
```

#### B. ViewSettingsResolver Tests

**File:** `src/engine/settingsResolvers.test.ts` (167 lines)

**Pattern:** Cascade behavior (MAIN → pinned → global); per-field independence.

**Existing pattern for nested settings:**
```typescript
it("WHEN MAIN pins the sizing object THEN the whole sizing field is taken from MAIN", () => {
  const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { sizing: customSizing(5) } });
  expect(resolved.sizing.minPx).toBe(5);
});
```

**For ticket-04:** Add tests for force-layout field cascade (treat as atomic like `sizing`):
```typescript
describe("ViewSettingsResolver force-layout cascade", () => {
  it("WHEN MAIN pins forceLayout THEN the whole field is taken from MAIN", () => {
    const mainLayout = { chargeStrength: -250, ... };
    const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { forceLayout: mainLayout } });
    expect(resolved.forceLayout.chargeStrength).toBe(-250);
  });
});
```

#### C. Persistence Parser Tests

**File:** `src/persistence/persistedShapes.ts` (239 lines; no dedicated test file — parsing is tested via adapter round-trips)

**Pattern:** Defensive parsing (unknown fields ignored, malformed → default); `numberOrUndefined()` + `nonEmpty()` helpers.

**Existing for numeric fields in `SizingSettings`:**
```typescript
// Line 168-170 in parseSizing()
depthDecayK: numberOrUndefined(raw["depthDecayK"]) ?? defaults.depthDecayK,
minPx: numberOrUndefined(raw["minPx"]) ?? defaults.minPx,
maxPx: numberOrUndefined(raw["maxPx"]) ?? defaults.maxPx,
```

**For ticket-04:** In `parseViewOverride()` (lines 131-148), add parsing for force-layout object:
```typescript
...definedOnly("forceLayout", parseForceLayout(raw["forceLayout"]))
```

Create a helper (similar to `parseSizing()`):
```typescript
function parseForceLayout(raw: unknown): ForceLayoutSettings | undefined {
  if (!isRecord(raw)) return undefined;
  const defaults = EngineDefaults.viewSettings().forceLayout;
  return {
    chargeStrength: numberOrUndefined(raw["chargeStrength"]) ?? defaults.chargeStrength,
    linkGapPx: numberOrUndefined(raw["linkGapPx"]) ?? defaults.linkGapPx,
    // ... other fields
  };
}
```

#### D. Ticket-03 Stranding Regression Test

**File:** `src/view/d3ForceStranding.test.ts` (166 lines)

**Pattern:** Metric-driven acceptance: boundary-gap budget + overlap count.

**Current assertions (lines 157-165):**
```typescript
describe("d3-force stranding around a folder-grouped hub (ticket 03 Enchiridion mirror)", () => {
  it("WHEN a folder-grouped hub fans out to a crowd plus one degree-1 leaf THEN no projected root edge is stranded beyond the boundary-gap budget", async () => {
    const layout = await layoutStranded(strandedHubGraph(STRANDED_CROWD_COUNT));
    expect(worstBoundaryGapPx(layout)).toBeLessThanOrEqual(D3_FORCE_MAX_BOUNDARY_GAP_PX);
  });

  it("WHEN the stranded-hub fixture is laid out THEN no two root-level boxes overlap", async () => {
    const layout = await layoutStranded(strandedHubGraph(STRANDED_CROWD_COUNT));
    expect(overlappingRootPairCount(layout)).toBe(0);
  });
});
```

**Dependencies on constants:**
- `D3_FORCE_MAX_BOUNDARY_GAP_PX = 100` (line 28) — budget; this is **test logic**, not a product constant
- Implicitly uses default force params: `D3_FORCE_CHARGE_STRENGTH`, `D3_FORCE_LINK_GAP_PX`, `D3_FORCE_COLLIDE_PADDING_PX`, `D3_FORCE_CENTER_PULL_STRENGTH`, `D3_FORCE_COLLIDE_ITERATIONS`

**For ticket-04:** This test must **stay green at default slider values**. When sliders are added, the test implicitly uses the defaults baked into `EngineDefaults.viewSettings()`. No changes to the test itself unless slider defaults diverge from current constants.

### Summary of Test Files to Create/Modify

| Test File | Purpose | BDD Classes |
|-----------|---------|-------------|
| `src/view/settingsWritePlan.test.ts` | NEW: global-force-layout interaction planning | 3-5 tests (merging, field independence) |
| `src/engine/settingsResolvers.test.ts` | NEW: force-layout cascade (MAIN/pinned/global) | 2-3 tests (pinning, inheritance) |
| `src/persistence/persistedShapes.ts` (inline or dedicated test) | NEW: defensive parsing of force-layout fields | 2-3 tests (malformed repair, missing fields) |
| `src/view/d3ForceStranding.test.ts` | UNCHANGED: regression test stays green at defaults | 0 changes (implicitly uses engine defaults) |

---

## 5. SETTINGS UI STRUCTURE

### Current Structure (from `VicinityGraphSettingTab.ts`)

```
Display():
  ├─ renderDepthDefaults()  [lines 112-127]
  │  ├─ Heading: "Depth defaults"
  │  └─ 2 sliders (outgoing, incoming) via addDepthSlider()
  │
  ├─ renderSizing()  [lines 129-180]
  │  ├─ Heading: "Node sizing"
  │  ├─ Toggle + weight fields for each metric
  │  └─ 3 number inputs: minPx, maxPx, depthDecayK
  │
  ├─ renderExclusion()  [lines 75-110]
  │  ├─ Heading: "Node exclusion"
  │  ├─ Toggle for enable
  │  └─ Textarea for patterns (if enabled)
  │
  └─ renderPerformance()  [lines 182-199]
     ├─ Heading: "Performance"
     └─ 1 number input: nodeCap
```

### Control Types Available (from Obsidian `Setting` API)

- **Heading:** `.setName(text).setHeading()`
- **Slider:** `.addSlider((slider) => slider.setLimits(min, max, step).setValue(...).setDynamicTooltip().onChange(...))`
- **Text/Number input:** `.addText((text) => text.inputEl.type = "number".setValue(...).onChange(...))`
- **Toggle:** `.addToggle((toggle) => toggle.setValue(...).onChange(...))`
- **Textarea:** `.addTextArea((text) => text.inputEl.rows = N.setValue(...).onChange(...))`

### Design for Ticket-04 Sections

**Proposed structure:**

```
renderForceLayout()  [NEW]
  ├─ Heading: "Force Layout — Native Parity"
  │  ├─ Slider: "Center force" (D3_FORCE_CENTER_PULL_STRENGTH)
  │  ├─ Slider: "Repel force" (D3_FORCE_CHARGE_STRENGTH)
  │  ├─ Slider: "Link force" (new param: forceLink strength, currently unset)
  │  └─ Slider: "Link distance" (D3_FORCE_LINK_GAP_PX)
  │
  ├─ Heading: "Force Layout — Advanced" (or collapsible group?)
  │  ├─ Slider: "Node spacing" (D3_FORCE_COLLIDE_PADDING_PX)
  │  └─ Slider: "Group member spacing" (ELK_NODE_SPACING)
  │
  └─ Button: "Restore Defaults" (resets all to EngineDefaults)
```

**Questions:**
- **Collapsible?** Ticket says "Advanced section (collapsible/secondary)". Obsidian's Setting API does NOT have built-in collapsible groups. **Workaround:** Use a visual separator (e.g., faded/smaller heading) or a toggle that shows/hides the advanced controls (re-render on toggle like exclusion patterns do).
- **Restore Defaults button?** Add via `.addButton((btn) => btn.setButtonText("Restore Defaults").onClick(async () => { ... }))` — emits a new interaction kind `global-force-layout-reset`.

### Slider Range Clamping (Ticket AC)

"Ranges clamped so degenerate combos are unreachable (center pull well below link strength; spacings bounded so containers/labels never overlap)."

**Suggested clamping (example values; refine with human):**

| Slider | Param | Current | Min | Max | Rationale |
|--------|-------|---------|-----|-----|-----------|
| Center force | centerPullStrength | 0.05 | 0.01 | 0.2 | Must stay << link strength (~1); upper bound prevents collapse |
| Repel force | chargeStrength | -300 | -500 | -100 | Negative (repulsion); wider range = strength tuning |
| Link force | forceLink.strength | (unset, ~0.35 d3 default?) | 0.1 | 2.0 | Controls link spring tension |
| Link distance | linkGapPx | 40 | 5 | 100 | Gap between boxes; too small risks overlap |
| Node spacing (collide padding) | collidePaddingPx | 20 | 0 | 50 | Per-pair minimum gap |
| Group member spacing | elkNodeSpacing (string → parse to number?) | "40" | 10 | 100 | ELK layout gap; affects label collision risk |

### Existing "Restore Defaults" Pattern

No current restore-defaults button, but the pattern would be:
```typescript
.addButton((btn) =>
  btn.setButtonText("Restore Defaults").onClick(async () => {
    await this.applyInteraction({
      kind: "global-force-layout-reset",
      // or emit individual resets:
      // kind: "global-force-layout",
      // forceLayout: EngineDefaults.viewSettings().forceLayout
    });
  })
);
```

---

## 6. TICKET-03 IMPLEMENTATION SUMMARY

Shipped changes (from `IMPLEMENTATION__PUBLIC.md`):

| Artifact | Change |
|----------|--------|
| `src/view/forceRectCollide.ts` (new) | Rect-AABB collision force; replaces circular `forceCollide`. Deterministic, O(n²). |
| `src/view/forceRectCollide.test.ts` (new) | 7 BDD unit tests. |
| `src/view/d3ForceRefinement.ts` | Wired `forceRectCollide(D3_FORCE_COLLIDE_PADDING_PX, D3_FORCE_COLLIDE_ITERATIONS)` at line 76; changed link distance to `minHalfExtent(s) + minHalfExtent(t) + D3_FORCE_LINK_GAP_PX` (line 72). |
| `src/view/constants.ts` | WHY comments rewritten; values unchanged (padding 20, iterations 2). |
| `src/view/d3ForceStranding.test.ts` (new) | Regression test: Enchiridion mirror fixture; asserts boundary gap ≤ 100px, zero overlaps. |
| `scripts/setup-dev-vault.sh` | Added test fixture notes. |
| `docs-internal/CHANGELOG.md` | New entry. |

**Key metric:** Worst boundary gap: **207px → 33px** (circular collide → rect collide).

**Shipped defaults:**
- `D3_FORCE_CHARGE_STRENGTH = -300`
- `D3_FORCE_LINK_GAP_PX = 40`
- `D3_FORCE_COLLIDE_PADDING_PX = 20`
- `D3_FORCE_CENTER_PULL_STRENGTH = 0.05`
- `D3_FORCE_COLLIDE_ITERATIONS = 2`

**Ticket-04 constraint:** Sliders must default to these values so the stranding test stays green. These are the "tuned defaults" from ticket-03 that the sliders allow users to adjust.

---

## 7. LAYERING & CRITICAL DECISIONS

### Engine vs. View Layer

**Current state:**
- `src/engine/` is pure (no obsidian/react/d3 imports) — guarded by `src/engine/importGuard.test.ts`
- Force constants live in `src/view/constants.ts` — view layer

**Ticket-04 requirement:** Make force params **user-tunable via sliders** without plugin reload.

**Architecture implications:**
1. Force params must be in `ViewSettings` (engine layer) so they persist, cascade, and resolve like other settings
2. View functions that use them must accept them as parameters, not import constants
3. `d3ForceRefinement.ts` and `elkMapping.ts` currently import constants — must refactor to accept parameters

**No violation of layering:** Engine stays pure; it just carries more data. View layer passes parameters when calling layout functions.

### Persistence Versioning

Current `PERSISTED_SHAPE_VERSION = 2` (line 32, `persistedShapes.ts`). Adding new fields to `ViewSettings`:
- **Option A:** Bump to version 3 (breaking old saves)
- **Option B:** Treat missing new fields as defaults in parsing (no version bump)

**Recommendation:** **Option B** (backward-compatible). The parser already does this: `numberOrUndefined(raw["field"]) ?? defaults.field`. Old v2 files without the new fields will auto-upgrade on first write.

No version bump needed unless the format of an existing field changes (e.g., `sizing` object structure).

---

## 8. COMPLETE FILE MODIFICATION CHECKLIST

**MUST TOUCH (in implementation order):**

1. `src/engine/types.ts:195-201` — Add fields to `ViewSettings`
2. `src/engine/constants.ts:19-20, 52-79` — Add `DEFAULT_*` constants; update factory
3. `src/view/constants.ts:89, 96, 103, 110, 118` — Preserve WHY comments; values move to engine defaults
4. `src/persistence/persistedShapes.ts:131-148, 156-172` — Add parsing for new fields
5. `src/view/settingsWritePlan.ts:23-41, 68-95` — Add `global-force-layout` interaction + case
6. `src/view/d3ForceRefinement.ts:39-95` — Accept params; replace hardcoded constants
7. `src/view/elkMapping.ts:3, 30-72` — Accept/thread `elkNodeSpacing` parameter
8. `src/view/GraphLayoutRunner.ts:17-22` — Thread params to `refineForceRootLayout()`
9. `src/view/GraphViewController.ts:213, 189-200` — Extract params from `graph.viewSettings` before layout
10. `src/view/VicinityGraphSettingTab.ts:55-63, 200-240` — Add `renderForceLayout()` section with sliders

**TESTS (mirror existing patterns):**

11. `src/view/settingsWritePlan.test.ts` — Add 3-5 tests for `global-force-layout` interaction
12. `src/engine/settingsResolvers.test.ts` — Add 2-3 tests for cascade + pinning
13. `src/persistence/persistedShapes.ts` (or new test file) — Add 2-3 defensive parsing tests
14. `src/view/d3ForceStranding.test.ts` — VERIFY unchanged (should pass with defaults)

---

## 9. NO QUESTIONS FOR HUMAN

All design decisions are either:
- Explicitly stated in the ticket
- Derived from existing architectural patterns
- Documented with rationale above

Proceed with implementation.
