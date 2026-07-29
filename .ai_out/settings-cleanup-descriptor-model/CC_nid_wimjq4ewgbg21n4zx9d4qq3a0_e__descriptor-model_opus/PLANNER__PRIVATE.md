# PLANNER — private working memory (rehydration file)

Session: 2026-07-29. Branch `CC_nid_wimjq4ewgbg21n4zx9d4qq3a0_e__descriptor-model_opus`.
Public deliverable: `DETAILED_PLANNING__PUBLIC.md` (same dir). This file is the
scratch trail: what I read, what I rejected and why, and the traps I verified.

---

## 1. What I read (in order), and the one-line takeaway from each

| Source | Takeaway |
|---|---|
| `_tickets/settings-cleanup-descriptor-model.md` | Acceptance = "ONE declaration + UI copy" + `satisfies Record<keyof ViewSettings,…>` guards. Ticket itself already concedes "make every REMAINING table exhaustive" — i.e. tables survive, guarded. Leaned on this hard in §0. |
| `CLARIFICATION__PUBLIC.md` | D1 scope, D2 depth-rename deferred, D3 mine. 7 standing constraints. ForceLayoutSection restore folded in. |
| `EXPLORATION_PUBLIC__1_engine.md` | Best of the three. §5 gotchas list is accurate. Correctly flags reset plan lives in `src/view/`, not `src/engine/`. |
| `EXPLORATION_PUBLIC__2_persistence.md` | Exact per-field parse semantics table (drop vs clamp vs repair). §5.5 correctly notes engine must not import persistence. |
| `EXPLORATION_PUBLIC__3_ui_tests.md` | Row-metadata inventory + full copy table + e2e blast radius. The tab/panel divergences here are what killed the "unified row-copy table" idea. |
| `docs-internal/notes/settings.md` | The 6-ticket chain, standing owner decisions. |
| `docs-internal/architecture-map.md` | `view → adapters → engine`; engine purity. |
| `CLAUDE.md` (project + global) | Compile-time > runtime; TS simple syntax preferred; keep files focused; never re-baseline a test. |

**Source files read in full** (reports are a map, not a substitute):
`src/engine/types.ts`, `src/engine/SettingsSpec.ts`, `src/engine/constants.ts`,
`src/engine/ViewSettingsResolver.ts`, `src/persistence/persistedShapes.ts`,
`src/view/settingsResetPlan.ts`, `src/view/settingsWritePlan.ts`,
`src/view/settingsWriteScope.ts`, `src/view/sizingMetrics.ts`,
`src/view/forceLayoutFieldMeta.ts`, `src/view/nodePreviewPreferenceMeta.ts`,
`src/view/ForceLayoutSection.tsx`, `src/view/sizingMetrics.test.ts`,
`settingsResetPlan.test.ts` (head + tail), `tsconfig.json`,
`src/engine/index.ts` (head), `src/engine/importGuard.test.ts` (head),
`e2e/selectorGuard.test.ts` (head).

---

## 2. Facts established (do not re-derive)

- `tsconfig.json`: `strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noUncheckedIndexedAccess`, `isolatedModules`. **`exactOptionalPropertyTypes`
  is NOT set** (despite `definedOnly`'s doc comment claiming friendliness).
- `ControlsActions.applySettings(command: SettingsCommand): Promise<void>` —
  takes ONE command, not an array. `planSettingsReset` returns an array ⇒ the
  panel needs a loop.
- `EngineDefaults.*` callers in `src/view/` (non-test):
  `GraphLayoutRunner.ts:26` (param default — legitimate),
  `ForceLayoutSection.tsx:57` (**the defect**),
  `settingsResetPlan.ts` ×6 (legitimate), `GraphViewController.ts:53-55`
  (initial state — legitimate).
  ⇒ a blanket "no EngineDefaults outside settingsResetPlan" scan would be red
  for good reasons. The Step-1 tripwire must be scoped to
  `forceLayoutSettings()` with a `GraphLayoutRunner.ts` allowlist entry.
- **No `.test.tsx` anywhere** — no React component testing infrastructure. This
  is why the ForceLayoutSection fix cannot have a behavioural test, and why a
  source scan is the only available red-first mechanism.
- `sizingMetrics.test.ts` **already** has a runtime completeness test. Hole #3 is
  test-guarded, not compile-guarded. Keep the runtime test — it catches
  double-listing, which a type guard cannot.
- `settingsResetPlan.test.ts:269` does `labels.filter(l => l === "Restore defaults")`.
  ⇒ narrowing `SETTINGS_RESET_SCOPES` with `as const satisfies` would make that a
  **TS "no overlap" error**. This single line is why the section map is a
  separate table. (Discovered by reasoning, then confirmed by reading the test.)
- `e2e/settingsDependentRows.e2e.ts:47-49` indexes `SIZING_METRICS[0]` behind an
  `if (!x) throw` guard → becomes dead under a const tuple. Compiles fine
  (tsconfig sets no `allowUnreachableCode: false`). Leave it.
- `_assertEveryResetScopePlaced` has **no test referencing it** — but I keep it
  anyway (zero cost, removing a guard needs a better reason than "it can no
  longer fail").
- **The repo is currently consistent**: all 5 `ViewSettings` fields are specced,
  parsed, and covered by a section reset. The three named holes are LATENT. This
  is the single most important framing fact in the plan — it dictates the
  honest test strategy (§0 of the public plan).

---

## 3. Compiler probes actually run (both green/red as expected)

`.tmp/scratch/probe.ts` — **exit 0**, proving all of:
1. `{readonly [K in keyof ViewSettings]: ViewSettings[K] | undefined}` forces every
   key present (the `@ts-expect-error` on a missing key *was* consumed, i.e. it
   really is an error).
2. `definedFieldsOnly<T>` compiles and its `Partial<T>` return is assignable to
   `ViewSettingsOverride`.
3. `restoreFields<T>` with `{...current} as Mutable<T>` compiles and returns `T`
   (no `Partial` leakage).
4. `SECTION_SETTINGS_FIELDS` `as const satisfies Record<Section, SectionFields>`
   with a shared `NO_FIELDS = [] as const` — the `SectionedField<F>` indexed
   access works and the guard is satisfied by a complete map.
5. Indexing the map with a **union** section under `noUncheckedIndexedAccess`
   introduces no `| undefined`; `.length` and widening to
   `readonly (keyof ViewSettings)[]` both fine.
6. `type SizingRangeField = Exclude<keyof SizingSpec, "metrics">` works.

`.tmp/scratch/probe2.ts` — deliberately added an unhandled `embedDepthOut` field;
**all three guards fired and named it**:
```
probe2.ts(11,14): TS2322: Type 'true' is not assignable to type '"embedDepthOut"'.   ← spec guard
probe2.ts(23,14): TS2322: Type 'true' is not assignable to type '"embedDepthOut"'.   ← section guard
probe2.ts(27,14): TS2741: Property 'embedDepthOut' is missing … 'ParsedViewFields'.  ← parse guard
```
This is the plan's strongest evidence. If a fresh PLANNER doubts any mechanism,
re-run these two probes rather than re-arguing.

---

## 4. Options considered and REJECTED (with the reason, so they stay rejected)

### 4.1 Unified descriptor list with a `cascade` discriminant (D3 option A)
**Killer argument**: the completeness guard for `parseViewOverride` must be keyed
by `keyof ViewSettings`. From a flat heterogeneous array you only get there via
`filter(d => d.family === "view")` — a runtime predicate that cannot fail to
compile. The unified list would reintroduce the exact silent hole it exists to
close. Secondary: invents a strategy abstraction with 3 instances (2 of them
1–2 fields); every consumer narrows by hand.

### 4.2 Deriving `ViewSettings` (the type) from a descriptor array
`{[D in Descriptors as D["key"]]: D["type"]}` is possible. Rejected: loses the
per-field doc comments (which are genuinely excellent here), degrades IDE hover,
fights `isolatedModules`, forces UI copy into the engine, and **weakens
`ViewSettingsResolver.resolve()`'s return-type guarantee** — explicitly
forbidden by CLARIFICATION constraint 5. This is the only path to a literal
"ONE declaration", so I push back on that acceptance wording instead.

### 4.3 Moving parse functions into engine descriptors (D3 option C)
Costed seriously. Rejected: drags ~80 lines of *persistence recovery policy*
("repair a mangled sizing object from defaults rather than drop it") into the
pure engine, plus an `isRecord` duplicate. Clean split preserved instead:
engine = valid VALUE (bounds/clamps/enum), persistence = valid JSON SHAPE +
recovery. The guard can cross the boundary as a **type** at zero runtime cost.

### 4.4 A `VIEW_FIELD_PARSERS: Record<keyof ViewSettings, (raw)=>T|undefined>` table + loop
Genuinely tempting; would be per-field addressable for ticket 5. Rejected:
the loop `parsed[key] = PARSERS[key](raw[key])` with a union `K` hits the classic
TS "not assignable" wall and needs a cast **in the enumeration itself** — which
is exactly the code path the guard is protecting. The annotated-literal approach
needs no cast there at all. Ticket 5 doesn't need per-field parsers anyway: it
can iterate `Object.keys(EngineDefaults.viewSettings())` + spec defaults.

### 4.5 Template-literal reset keys (`"view:nodeCap"`)
`` `view:${keyof ViewSettings}` `` is compile-checked and compact — but needs
runtime `split(":")` parsing and is "advanced syntax" (CLAUDE.md prefers simple
TS). Rejected for the explicit three-array shape with `NO_FIELDS`.

### 4.6 Discriminated-union `resets: {family, keys}` (one family per section)
Cleaner-looking than three arrays with empties, but bakes in "a section touches
exactly one family". The Depth-group satellite ticket
(`nid_1rslube8at5xj60ji4jeve0b0_e`) could break that. Rejected.

### 4.7 Adding `resets` directly to `SETTINGS_RESET_SCOPES` with `as const satisfies`
Rejected — over-narrowing breaks `settingsResetPlan.test.ts:269` (see §2). A
separate `SECTION_SETTINGS_FIELDS` table also factors better: structural fact vs
reset affordance = two reasons to change.

### 4.8 Deriving the `all` scope from the union of section field sets
Would be equivalent *today* and stay equivalent by the guard. Rejected: `all` is
the belt-and-braces scope; deriving it makes it only as complete as the section
map, which is the one thing it should be independent of. Existing code comment
already states the whole-slice intent.

### 4.9 Merging `forceLayoutFieldMeta` + `nodePreviewPreferenceMeta` into one file (one reading of D1)
Rejected — **the decisive insight of the whole session**: the ROW space is not
the FIELD space. `sizing` is one `ViewSettings` field and ~8 rows; `forceLayout`
is one field and 7 rows. So there is no `Record<keyof ViewSettings, {label,
description}>` for them to fold into — such a table would be a category error.
The three leaf tables are keyed by three different key spaces and are already
single-source + compile-exhaustive. Merging = SRP regression, zero gain.
Flagged as Q-A for the reviewer.

### 4.10 A `keyof ViewSettings`-keyed ROW copy table (lifting labels out of the tab)
Rejected for this ticket. Two blockers: (a) 4.9's row-vs-field mismatch;
(b) tab/panel copy genuinely diverges ("Exclude notes from the graph" vs
"Exclude notes"; panel omits descriptions), so the table would need
`label` + `compactLabel` + optional description — a *presenter* design decision
that is ticket 4's, and baking a shape now risks ticket 4 having to redo it.

### 4.11 DRY-ing `EngineDefaults.forceLayoutSettings()` vs `clampForceLayoutSettings()`
Rejected: both are return-type-forced (duplication, not *silent* duplication);
collapsing needs `Object.fromEntries(...) as ForceLayoutSettings`, trading a
compile guarantee for brevity. Wrong direction for this ticket.

### 4.12 A generic helper for the `_assertEvery…` idiom
Rejected: would make the compiler report the alias instead of the missing key
name. The error legibility (see §3's `"embedDepthOut"` messages) IS the feature.

---

## 5. Dead ends / false starts worth recording

- Spent effort trying to make `ViewSpec` a **mapped type** over `ViewSettings`
  (`{[K in keyof ViewSettings]: SpecFor<ViewSettings[K]>}`). **Does not work**:
  `nodeCap` and `outlineMaxDepth` are both `number`, so a conditional type
  cannot give one `MinBoundedNumberSpec` and the other `BoundedNumberSpec`; the
  union then breaks `SETTINGS_SPEC.globalView.outlineMaxDepth.max` and
  `MAX_OUTLINE_DEPTH`. Fell back to the `Exclude<>` guard idiom — same safety,
  no gymnastics.
- Hunted hard for a **red-today behavioural** test. There is none: the repo is
  currently consistent, and the ForceLayoutSection fix is value-identical (as
  CLARIFICATION itself states). Wrote up that honesty explicitly rather than
  manufacturing a fake red. Settled on: source-scan tripwire (real red) +
  red-because-new module TDD + compile guards proven in §3.
- Considered a blanket "no `EngineDefaults.*` outside `settingsResetPlan.ts`"
  scan. Would be **red for three legitimate reasons** (`GraphLayoutRunner`,
  `GraphViewController` ×3). Narrowed to `forceLayoutSettings()` + allowlist.

---

## 6. Traps IMPLEMENTATION will hit if not warned (all already in the public plan)

1. **Step 4 must not precede Step 3** — `definedFieldsOnly<DepthSettings>`
   returns `Partial<DepthSettings>`, which is only `DepthOverride` after
   `DepthOverride := Partial<DepthSettings>` lands.
2. Do **not** put `as const` on `SETTINGS_RESET_SCOPES` (breaks
   `settingsResetPlan.test.ts:269`).
3. `SECTION_RESET_SCOPES` must keep its exported name — `e2e/settingsBaseline.ts`
   imports it. Re-export as `export const SECTION_RESET_SCOPES = SETTINGS_SECTIONS;`
   (value binding, `isolatedModules`-safe).
4. `ForceLayoutSection` must keep `.vicinity-graph-forcelayout__restore`, its
   `title` text and its "Restore defaults" label — `selectorGuard.test.ts` +
   e2e locators.
5. `SizingSpec` has an extra `metricWeight` with no `SizingSettings`
   counterpart — guard **top-level keys only**, or the spec guard false-positives.
6. `ViewSettingsResolver.ts` — **do not touch. Not one line.**

---

## 7. If a fresh PLANNER must re-plan

The load-bearing conclusions, ranked by how much re-deriving they'd cost:
1. Row space ≠ field space (§4.9) — kills every "one big row descriptor" design.
2. A flat unified list cannot yield a `keyof ViewSettings`-keyed compile guard
   (§4.1) — kills D3 option A.
3. The repo is currently consistent, so the holes are latent (§2) — dictates the
   test strategy.
4. `settingsResetPlan.test.ts:269` forbids narrowing that table (§2).
5. The compiler probes (§3) — re-run rather than re-argue.
