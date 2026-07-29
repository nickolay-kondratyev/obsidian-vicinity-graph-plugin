# Engine/Shared exploration — settings descriptor-model rewrite

## 0. Scope correction (read this first)

The ticket text says the reset-scope table lives at `src/engine/settingsResetPlan.ts`. **It does not.** Both silent-hole #2 files actually live in `src/view/`, not `src/engine/`:

- `src/view/settingsResetPlan.ts` (215 lines)
- `src/view/settingsWriteScope.ts` (39 lines)

`src/engine/` contains **no** reset-scope or write-scope table at all. Whoever is assigned the view/persistence layer owns those two files; nothing in `src/engine`/`src/shared` needs to change for them except that they already import `EngineDefaults`/`SETTINGS_SPEC` from `../engine` (barrel), so the descriptor rewrite's exported shape is their contract.

Also confirmed: the dependency ticket (`nid_niz5dz6uqeyv237ckm15ittqa_e`, delete `groupByFolder`/`edgeVisibility`) is **already done** in the engine — `grep -rn "groupByFolder|edgeVisibility|EDGE_VISIBILITY_MODES" src/engine src/shared` returns nothing. Only `src/persistence/persistedShapes.test.ts` still mentions them (out of engine scope).

`src/shared/` (`FileKinds.ts`, `MarkdownInlineLinks.ts`, `VaultPathFacts.ts`, `Wikilinks.ts`) has **zero** settings involvement — none of those four files or their tests reference `ViewSettings`/`SettingsSpec`/any settings union. It only matters here as an import-guard co-target (see §5).

---

## 1. Field inventory table

Three independent "settings families" exist in the engine, each with its own cascade rules — this distinction is itself something a descriptor model must encode, not flatten:

| Field | TS type | Default | Scope | Unions used | Range/step metadata | Override counterpart |
|---|---|---|---|---|---|---|
| `DepthSettings.outgoingDepth` | `number` | `1` | global + per-root (own doc-depth, not part of `ViewSettings`) | — | `{min:0,max:5,step:1}` (`DEPTH_STEPPER_BOUNDS`) | Yes — `DepthOverride.outgoingDepth?: number` |
| `DepthSettings.incomingDepth` | `number` | `1` | global + per-root | — | `{min:0,max:5,step:1}` (same bounds object) | Yes — `DepthOverride.incomingDepth?: number` |
| `ViewSettings.nodeCap` | `number` | `100` | both (cascade: main override → pinned → global) | — | `{min:1}` only (`MinBoundedNumberSpec` — no max/step) | Yes — `ViewSettingsOverride.nodeCap?: number` |
| `ViewSettings.outlineMaxDepth` | `number` | `2` | both | — | `{min:1,max:6,step:1}` | Yes |
| `ViewSettings.nodePreviewPreference` | `NodePreviewPreference` (`"auto"\|"outline"\|"image"`) | `"auto"` | both | `NodePreviewPreference` / `NODE_PREVIEW_PREFERENCES` (types.ts:157-168) | none (`DefaultSpec<T>` only) | Yes |
| `ViewSettings.sizing` (whole object, atomic pin) | `SizingSettings` | see below | both, pinned **wholesale** — no per-metric override in V1 | — | composite (leaves below) | Yes — `sizing?: SizingSettings` |
| `SizingSettings.metrics` | `Readonly<Record<SizeMetricId, SizingMetricSetting>>` | 5 entries, only `own-file-size` on | inside `sizing` (atomic) | `SizeMetricId` (5-value union, **no** `ALL_SIZE_METRIC_IDS` const — see §5) | per-metric `weight` shares `metricWeight` bounds `{min:0,max:100,step:0.5}`; `enabled` unbounded | — (inherits with parent `sizing`) |
| `SizingSettings.depthDecayK` | `number` | `1` | inside `sizing` | — | `{min:0,max:10,step:0.5}` | — |
| `SizingSettings.minPx` | `number` | `40` | inside `sizing` | — | `NODE_SIZE_PX_BOUNDS = {min:1,max:400,step:4}` | — |
| `SizingSettings.maxPx` | `number` | `160` | inside `sizing` | — | same `NODE_SIZE_PX_BOUNDS` | — |
| `ViewSettings.forceLayout` (whole object, atomic pin) | `ForceLayoutSettings` | see below | both, atomic | — | composite | Yes — `forceLayout?: ForceLayoutSettings` |
| `ForceLayoutSettings.centerPullStrength` | `number` | `0.05` | inside `forceLayout` | — | `{min:0,max:0.15,step:0.01}` | — |
| `ForceLayoutSettings.repelStrength` | `number` | `300` | inside `forceLayout` | — | `{min:50,max:1000,step:10}` | — |
| `ForceLayoutSettings.linkStrengthFactor` | `number` | `1` | inside `forceLayout` | — | `{min:0.25,max:4,step:0.05}` | — |
| `ForceLayoutSettings.linkGapPx` | `number` | `40` | inside `forceLayout` | — | `{min:10,max:250,step:5}` | — |
| `ForceLayoutSettings.collidePaddingPx` | `number` | `50` | inside `forceLayout` | — | `{min:0,max:100,step:5}` | — |
| `ForceLayoutSettings.elkNodeSpacingPx` | `number` | `20` | inside `forceLayout` | — | `{min:10,max:120,step:5}` | — |
| `ForceLayoutSettings.edgeRoutingClearancePx` | `number` | `11` | inside `forceLayout` | — | `{min:6,max:14,step:1}` (asserted against `ARROWHEAD_HALF_WIDTH_PX`/`GROUP_SIDE_PADDING_PX` in `src/view/edgeRouting.test.ts`) | — |
| `NodeExclusionSettings.enabled` | `boolean` | `false` | **global only, no per-view/per-doc override at all** — not part of `ViewSettings`/`ViewSettingsOverride` | — | `DefaultSpec<boolean>` | **No** |
| `NodeExclusionSettings.patterns` | `readonly string[]` | `[]` | global only | — | `DefaultSpec<readonly string[]>` | **No** |

All defaults/bounds above are read straight from `SETTINGS_SPEC` (`src/engine/SettingsSpec.ts:118-313`) — this is genuinely the single existing source of truth for defaults+limits, already good; the descriptor rewrite should extend it, not replace it wholesale.

Note the three-tier atomicity that a descriptor model must preserve exactly:
1. Leaf scalar fields of `ViewSettings` (`nodeCap`, `outlineMaxDepth`, `nodePreviewPreference`) resolve **per field**.
2. `sizing` and `forceLayout` are each **one field** of `ViewSettings` — the whole object is pinned/inherited atomically, never merged member-by-member across cascade layers. (Explicitly commented at `types.ts:300-305`: "`sizing` is a single field in V1 — per-metric pinning would be over-engineering.")
3. `NodeExclusionSettings` and `DepthSettings`/`DepthOverride` are entirely outside the `ViewSettings`/`ViewSettingsOverride` cascade machinery — different resolver (`TraversalSettingsResolver`, per-root not per-view), or no override at all.

---

## 2. File map

| File | Role | Hand-maintained list it contains (line refs) |
|---|---|---|
| `src/engine/types.ts` | Domain types: `ViewSettings`, `ViewSettingsOverride`, `DepthSettings`/`DepthOverride`, `SizingSettings`, `ForceLayoutSettings`, `NodeExclusionSettings`, `NodePreviewPreference`, `SizeMetricId`. | `ViewSettings` interface itself (types.ts:286-298, 5 fields) is list #1 — every table below must stay a mapped/derived type over this or a compile-time completeness check fires. `NODE_PREVIEW_PREFERENCES` (types.ts:164-168) + its `_assertEveryNodePreviewPreferenceListed` compile guard (175-177) — this is the **pattern to replicate** for every other union. `DIRECTION_DEPTH_FIELD` (215-218) is a 2-entry hand map `Direction → keyof DepthOverride`. |
| `src/engine/SettingsSpec.ts` | THE defaults+bounds spec (`SETTINGS_SPEC`), mirrors persisted shape (`globalDepths`/`globalView`/`nodeExclusion`), not UI order. | `SETTINGS_SPEC` object literal (118-313) is a hand-written mirror of `ViewSettings`+`DepthSettings`+`NodeExclusionSettings` — one entry per field, WHY-commented per field. `ViewSpec` interface (69-75) is a second hand-listed mirror of `ViewSettings`'s field names (but as `*Spec` types, so a missing field is a TS error on `SETTINGS_SPEC: SettingsSpec` — good). `ForceLayoutSpec` (line 67) is the one part that's already a mapped type (`Record<keyof ForceLayoutSettings, BoundedNumberSpec>`) — model for the rest. |
| `src/engine/SettingsDefaults.ts` | Discoverability shim only — re-exports `SETTINGS_SPEC`. | None (deliberately not a second source of truth; can likely be deleted or kept as a pointer under the new model). |
| `src/engine/constants.ts` | Derives `DEFAULT_*` constants, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`, `EngineDefaults` factory, `clampForceLayoutSettings`, `clampSizingSettings` from `SETTINGS_SPEC`. | `EngineDefaults.forceLayoutSettings()` (244-255) — hand-lists all 7 `ForceLayoutSettings` fields. `EngineDefaults.viewSettings()` (257-266) — hand-lists all 5 `ViewSettings` fields. `EngineDefaults.sizingSettings()` (224-237) — hand-lists 4 non-metric `SizingSettings` fields (metrics derived via `Object.entries`). `clampForceLayoutSettings()` (156-169) — hand-lists all 7 fields again (duplicate of the `EngineDefaults` list, same 7 names, independently maintained). `SIZING_RANGES` (174-179) — hand-lists 4 sizing fields as a literal object passed into `rangesOf`, NOT a mapped type (unlike `FORCE_LAYOUT_RANGES` at 151-153, which IS `Record<keyof ForceLayoutSettings, …>` and therefore already compile-checked). `type SizingRangeField = "metricWeight" \| "depthDecayK" \| "minPx" \| "maxPx"` (172) is a **hand-typed union**, not derived from `SizingSettings` — the weakest link in this file. |
| `src/engine/ViewSettingsResolver.ts` | Per-field cascade resolver: MAIN override → pinned (ranked) → global. | `resolve()`'s return object literal (46-52) hand-lists all 5 `ViewSettings` fields — **but this is the one place the ticket correctly says is NOT a silent hole**: the return type is `ViewSettings`, so TS itself forces completeness. Keep this shape (a `field()` closure per key) but drive the key list from a descriptor array rather than a literal, purely for DRY — not for safety. |
| `src/engine/TraversalSettingsResolver.ts` | Per-root depth cascade (own-doc override → global), separate from `ViewSettingsResolver`. | `resolveForRoot()` (12-17) hand-lists 2 fields (`outgoingDepth`/`incomingDepth`) — same "TS return type already enforces it" property as above. |
| `src/engine/NodeSizer.ts` | Sizing computation; owns the `SizeMetricId → SizeMetric` registry. | `enabledWeightedMetrics()`'s `registry` (117-124) — hand-lists all 5 `SizeMetricId` keys as a `Record<SizeMetricId, SizeMetric>` literal (TS-checked exhaustive since it's typed `Record<SizeMetricId, …>`, so this one is actually safe today, just verbose). |
| `src/engine/VicinityEngine.ts` | Engine facade; `GraphBuildRequest` shape, orchestrates resolvers → traversal → sizing → truncation. | Not a field-name list itself, but `GraphBuildRequest` (29-44) is a 4th parallel shape carrying `globalDepths`/`mainViewOverride`/`pinnedViewOverrides`/`nodeExclusion` — any descriptor-driven request builder must still match this interface's field names by hand unless it's also generated. |
| `src/engine/index.ts` | Public barrel — the ONLY import path consumers should use. | Three parallel `export type {...}` lists that must each individually stay in sync with `types.ts`/`SettingsSpec.ts`/`constants.ts`'s actual exports (31-55, 112-122). |

### Test files that assert field-name completeness directly (engine)
| File | What it enumerates |
|---|---|
| `src/engine/SettingsSpec.test.ts` | Two giant literal baselines (defaults, limits) hand-listing every `ViewSpec`/`DepthSpec`/`NodeExclusionSpec` field (lines 61-189), guarded by `EverySpecField<TSpec>`/`SpecLimitsBaseline<TSpec>` mapped-type "satisfies" markers (36-51) — this is the project's existing, working pattern for "structural completeness enforced by TS, not by a human keeping two lists in sync." **This is the template the descriptor model should generalize**, per owner decision #5 in `settings.md` ("KEEP a small number of literal assertions for product-meaningful defaults"). |

---

## 3. The inherit invariant — exact mechanics

This is the load-bearing constraint (`docs-internal/notes/settings.md`: "Absent override means inherit — the primary design constraint a naive descriptor rewrite would break").

**Type-level encoding** (`types.ts:285-305`):
```ts
export interface ViewSettings {
  readonly nodeCap: number;
  readonly outlineMaxDepth: number;
  readonly nodePreviewPreference: NodePreviewPreference;
  readonly sizing: SizingSettings;
  readonly forceLayout: ForceLayoutSettings;
}
export type ViewSettingsOverride = Partial<ViewSettings>;
```
`ViewSettingsOverride` is a **structural `Partial<>`**, not a hand-maintained parallel interface with `?` sprinkled on independently-named fields. This already prevents the two shapes from drifting field-for-field — a descriptor rewrite must keep this `Partial<ViewSettings>` relationship (or something provably equivalent), not reintroduce a second interface.

**Runtime encoding — "absent" is JS `undefined`, checked with `!== undefined`, never truthiness/nullish-only shortcuts that would also treat `0`/`false`/`""` as absent:**

- `ViewSettingsResolver.resolve()` (`ViewSettingsResolver.ts:33-45`):
  ```ts
  const field = <K extends keyof ViewSettings>(key: K): ViewSettings[K] => {
    const fromMain = input.mainOverride?.[key];
    if (fromMain !== undefined) return fromMain;
    for (const pinned of rankedPinned) {
      const fromPinned = pinned.override[key];
      if (fromPinned !== undefined) return fromPinned;
    }
    return input.global[key];
  };
  ```
  The `!== undefined` check (not `??`, not truthiness) is exactly what makes "pin a value of `0`" distinguishable from "don't pin this field". The **explicit** zero-pin proof is on the depth resolver:
  ```ts
  // settingsResolvers.test.ts:38-40
  it("WHEN an override pins a value equal to zero THEN zero is honored (presence = pinned)", () => {
    expect(TraversalSettingsResolver.resolveForRoot(global, { outgoingDepth: 0 }).outgoingDepth).toBe(0);
  });
  ```
- `TraversalSettingsResolver.resolveForRoot()` (`TraversalSettingsResolver.ts:13-16`) uses `??` (nullish coalescing, not `||`) for the same reason — `??` only falls through on `null`/`undefined`, so a pinned `0` still wins.

**Cascade ranking for `ViewSettings` specifically (3 layers, per-field independent):** MAIN's own override → pinned docs (ranked by `NodePriorityChain.compare`, i.e. most-recent-pin-timestamp then docid) → global. Each of the 5 `ViewSettings` fields resolves **independently** through this cascade — proven by `settingsResolvers.test.ts:149-160` ("WHEN fields come from three layers at once THEN each field resolves independently") and by the `sizing`/`forceLayout` atomic-pin tests (91-109) showing the *whole* composite object moves as one unit once *any* part of it is pinned, i.e. there is no field-level cascade *inside* `sizing`/`forceLayout` — the granularity of "one resolvable unit" is `keyof ViewSettings`, not every leaf number.

**Depth cascade is a *different*, shallower shape:** only 2 layers (own-doc override → global), no pinned-doc ranking, no MAIN-vs-pinned distinction — because it's per-root, not per-view. A descriptor model that tries to unify `DepthSettings`/`DepthOverride` and `ViewSettings`/`ViewSettingsOverride` under one generic "field descriptor + one resolver" must still support this different cascade depth/ranking, or it must explicitly special-case depth as "resolver: `own → global`" vs view fields' "resolver: `main → pinned(ranked) → global`" — a resolver-strategy field on the descriptor, not a single hardcoded cascade.

**Fields with NO override/inherit relationship at all:** `NodeExclusionSettings` (`enabled`, `patterns`) is persisted only globally; it never appears in `ViewSettingsOverride`, has no per-doc/per-pin cascade, and `VicinityEngine.build()` treats its absence as "no exclusion" (`exclusionMatcher()`, `VicinityEngine.ts:106-110`), not as "inherit a parent value" — a materially different "absence" semantic a descriptor model must not conflate with the ViewSettings inherit rule.

---

## 4. Existing tests pinning settings behavior (engine/shared)

| Test file | What it asserts |
|---|---|
| `src/engine/SettingsSpec.test.ts` | (a) `SETTINGS_SPEC`'s exact default values (61-120) and exact limit values (122-189) match the shipped baseline, using `EverySpecField`/`SpecLimitsBaseline` mapped-type markers so a newly-added spec field that isn't baselined is a **compile** error, not a silent gap (documented at lines 29-35 as fixing a real past incident with `outlineMaxDepth`). (b) Every `constants.ts` adapter (`EngineDefaults.*`, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`, `DEFAULT_*`, `MIN_*`) is a mechanical projection of `SETTINGS_SPEC`, not an independent literal (191-260). (c) `SettingsDefaults.SPEC === SETTINGS_SPEC` (262-265, identity). (d) `clampOutlineMaxDepth` behavior at/under/over bounds + fractional rounding (268-289). |
| `src/engine/settingsResolvers.test.ts` | `TraversalSettingsResolver`: both-inherit, one-overridden, both-overridden, and the zero-pin proof (10-41). `ViewSettingsResolver`: no-override passthrough; MAIN beats pinned beats global; per-field independence across 3 layers; `sizing`/`forceLayout` pinned atomically (whole object, not merged); multi-pin tie-break by recency then docid (`NodePriorityChain`); `outlineMaxDepth`/`nodePreviewPreference` cascade specifically (43-195). |
| `src/engine/forceLayoutSettings.test.ts` | `EngineDefaults.forceLayoutSettings()` equals the exact shipped 7-value baseline (14-25) — regression guard for "sliders must not change default rendered layout." `clampForceLayoutSettings`: over-max, under-min, NaN-fallback, and the anti-collapse invariant `centerPullStrength.max < linkStrengthFactor.min` (33-69) — a genuine cross-field range invariant. |
| `src/engine/sizingSettings.test.ts` | `clampSizingSettings`: defaults pass through unchanged; over-max/under-min/NaN/Infinity clamping for `depthDecayK`/`minPx`/`maxPx`/metric-weight; `enabled` flag survives clamping untouched (only weights are bounded); `SIZING_RANGES.depthDecayK.min >= 0` and `SIZING_RANGES.minPx.min > 0` invariants (15-115). |
| `src/engine/NodeSizer.test.ts` | Exercises `SizingSettings`/`SizeMetricId` end-to-end through actual size computation. Includes `DepthDecayMetric` edge-case tests via the exported-for-test class. |
| `src/engine/VicinityEngine.test.ts` / `.denseFixtures.test.ts` | End-to-end `build()` tests exercise `GraphBuildRequest` with `globalView`/`mainViewOverride`/`pinnedViewOverrides`/`nodeExclusion`, including a `nodePreviewPreference`-parameterized helper (`sizesUnderPreference`, line 333) — most likely to break if `GraphBuildRequest`'s shape changes. |
| `src/engine/GraphTruncator.test.ts` | `nodeCap` truncation behavior in isolation from the rest of `ViewSettings`. |
| `src/engine/importGuard.test.ts` | Not settings-specific, but **directly constrains the rewrite**: scans every `.ts`/`.tsx` under `src/engine/` and `src/shared/` for `obsidian`/`obsidian-id-lib`/`react`/`react-dom` imports (17, 47-51) — any descriptor helper carrying UI metadata (labels, row grouping, `disabledWhen`) must keep that metadata as plain data, never an Obsidian `Setting`/React reference. |
| `src/shared/*.test.ts` | None reference settings — no coupling. |

---

## 5. Constraints/gotchas a descriptor rewrite must respect

1. **`strict: true` + `noUncheckedIndexedAccess: true`.** Any descriptor-array-keyed-by-object (`Record<K, Descriptor>` built via `Object.fromEntries`/indexing) will type as `Descriptor | undefined` on access unless the construction itself is typed as an exhaustive mapped type (`Record<keyof ViewSettings, Descriptor<...>>` literal), matching the *already-working* pattern at `ForceLayoutSpec` (`SettingsSpec.ts:67`) and `FORCE_LAYOUT_RANGES` (`constants.ts:151-153`) — **not** the `SIZING_RANGES`/`rangesOf({...})` pattern (`constants.ts:172-179`), which hand-types a `SizingRangeField` union instead of deriving it.
2. **`isolatedModules: true`.** Every type used across the `types.ts`/`SettingsSpec.ts`/`constants.ts` boundary must be re-exportable as `export type {...}` cleanly; a descriptor model that infers types from a single runtime array (e.g. `typeof FIELD_DESCRIPTORS[number]["key"]`) needs to confirm those inferred types isolate cleanly and don't create circular type-only imports.
3. **Branded types** (`VaultPath`, `DocId`, `FolderPath` — `types.ts:11-33`) are not part of the settings surface directly, but `PinnedNodeDescriptor`/`CentralNodeDescriptor` (used by `ViewSettingsResolver`) carry them — pass them through untouched.
4. **Import guard is a test, not ESLint** (`importGuard.test.ts`) — scans both `src/engine/` AND `src/shared/` by regex over raw source text. A descriptor file under `src/engine/` is automatically guarded; one under `src/persistence/`/`src/view/` is **not** — placement determines which purity guarantee applies.
5. **`SizeMetricId` has no `NODE_PREVIEW_PREFERENCES`-style completeness list today.** Its only enforcement is "any object typed `Record<SizeMetricId, X>` must have all 5 keys". If the descriptor model introduces a `FIELD_DESCRIPTORS` array (not a `Record`) for iteration/UI-row-order purposes, it loses this automatic exhaustiveness and needs its own `_assertEvery*Listed`-style compile guard (existing template: `types.ts:175-177` — copy it, don't invent a new mechanism).
6. **Atomic vs per-field granularity is not uniform** (§3) — `sizing`/`forceLayout` are one inheritable unit each, while their own leaves (`minPx`, `centerPullStrength`, …) have individual range metadata but NO individual inherit/override semantics. A descriptor keyed purely on "every leaf number is a field" will not reproduce this — the descriptor's unit of resolution must be `keyof ViewSettings` (5 entries), with `sizing`/`forceLayout` each carrying a *nested* set of range-only descriptors for their leaves (no inherit flag on the leaves).
7. **`DepthSettings`/`DepthOverride` and `NodeExclusionSettings` are outside `ViewSettings` entirely** and must not be forced into the same descriptor array as `ViewSettings` fields unless the descriptor's resolver-strategy is itself parameterized — different cascade depths (2-layer vs 3-layer) and, for exclusion, no override at all.
8. **`ViewSettingsResolver.resolve()`'s return-type-forces-completeness property is real and must be preserved as the safety net**, not replaced by a runtime `.forEach` over a descriptor array that silently produces a wider/narrower object.
9. **`GraphBuildRequest` (`VicinityEngine.ts:29-44`) is itself a 4th parallel surface** (`globalDepths`, `mainViewOverride`, `pinnedViewOverrides`, `nodeExclusion`) that callers construct by hand — flagged for the adapter/view owner.
10. **Field-level range invariants can be cross-field** (`FORCE_LAYOUT_RANGES.centerPullStrength.max < FORCE_LAYOUT_RANGES.linkStrengthFactor.min`, asserted in `forceLayoutSettings.test.ts:64-69`) — a per-field descriptor's `{min,max,step}` cannot express this; keep a place for cross-field assertions (likely still a bespoke test).
11. **`EngineDefaults` currently returns fresh, defensively-copied objects per call** (`constants.ts:224-266`, proven by `SettingsSpec.test.ts:210-215`) — a descriptor-derived factory must preserve this (no shared mutable default object handed to callers).
