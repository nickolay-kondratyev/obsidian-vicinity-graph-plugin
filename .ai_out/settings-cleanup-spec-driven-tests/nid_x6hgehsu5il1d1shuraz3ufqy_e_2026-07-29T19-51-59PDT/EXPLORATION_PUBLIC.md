# Exploration: settings-cleanup ticket 5 (spec-driven tests + tab/panel parity)

Ticket id `nid_x6hgehsu5il1d1shuraz3ufqy_e`. Context: `docs-internal/notes/settings.md`
(read fully — it is the standing source of truth for this whole chain). No dedicated
ticket markdown file exists yet for #5; the two closed/resolved staleness tickets
(`docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`,
`docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`) are
explicitly cited in `settings.md` as the motivating incidents for #5.

`npm test` baseline on current HEAD (`fdf4214`): **87 test files, 1139 tests, all green**
(log at `.tmp/explore-test.log` in the repo — ephemeral, not committed).

## 1. Descriptor / spec single source of truth

- `src/engine/SettingsSpec.ts` — **the** spec. Exports:
  - Leaf shapes: `BoundedNumberSpec { default, min, max, step }`, `MinBoundedNumberSpec { default, min }`, `DefaultSpec<T> { default }`.
  - Section shapes: `DepthSpec`, `SizingSpec` (`metrics: Record<SizeMetricId, DefaultSpec<SizingMetricSetting>>`, `metricWeight`, `depthDecayK`, `minPx`, `maxPx`), `ForceLayoutSpec = Record<keyof ForceLayoutSettings, BoundedNumberSpec>`, `ViewSpec` (`nodeCap`, `outlineMaxDepth`, `nodePreviewPreference`, `sizing`, `forceLayout`), `NodeExclusionSpec`.
  - `SettingsSpec { globalDepths, globalView, nodeExclusion }` and the constant `SETTINGS_SPEC: SettingsSpec` (the actual data, lines 159-354).
  - Two compile-time completeness guards (both directions): `_assertEverySettingsFieldSpecced` (every `ViewSettings`/`DepthSettings`/`NodeExclusionSettings` field has a spec entry) and `_assertNoOrphanSpecField` (no spec entry survives a deleted field). Pattern: `type X = Exclude<keyof A, keyof B>; export const _assert...: X extends never ? true : X = true;` — a violation is a TS error *naming the offending key*.
  - Pure module (only imports `./types`), import-guarded.
- `src/engine/SettingsDefaults.ts` — explicitly a "discoverability shim, NOT the source of truth"; re-exports `SETTINGS_SPEC` and a non-instantiable `SettingsDefaults.SPEC` alias.
- **How to enumerate all fields programmatically** — there is no single flat array; the natural walks are:
  - `Object.entries(SETTINGS_SPEC.globalDepths)`, `Object.entries(SETTINGS_SPEC.globalView)` (careful: `sizing`/`forceLayout` are composites, not leaves), `Object.entries(SETTINGS_SPEC.globalView.sizing)`, `Object.entries(SETTINGS_SPEC.globalView.forceLayout)`, `Object.entries(SETTINGS_SPEC.nodeExclusion)`.
  - `SETTINGS_SPEC.globalView.sizing.metrics` keyed by `SizeMetricId` — also independently listed as `SIZING_METRICS` in `src/view/sizingMetrics.ts` (order-bearing `as const satisfies` array + a completeness guard test).
  - Row-level enumeration (the UI-facing list, not the raw spec) is `EVERY_SETTINGS_ROW` from `src/view/settingsRows.ts` (see §2) — this is likely the more useful iteration surface for a parity/spec test since it already carries label/kind/section.
  - Downstream derived tables that already do mechanical, type-safe projection from the spec (useful as models for a spec-iterating test): `src/engine/constants.ts` (`EngineDefaults.*`, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`, `DEFAULT_*`, `MIN_*`/`MAX_*` — read `.default`/`.min`/`.max`/`.step` off the spec, not literals).

## 2. `src/view/settingsRows.ts` (`SETTINGS_GROUPS`)

- `SETTINGS_ROW_CONTROL_KINDS` (`as const` array, 9 kinds): `depth`, `sizing-metric`, `sizing-number`, `node-preview`, `outline-depth`, `force-layout`, `exclusion-enabled`, `exclusion-patterns`, `node-cap`. Backed by a completeness guard `_assertEveryRowControlKindListed` against the `SettingsRowControl` union.
- `SettingsRow = SettingsRowCopy & { control; disabledWhen? }`, a discriminated union so `disabledWhen` type-checks only on `DEPENDENCY_AWARE_CONTROL_KINDS` (today just `["exclusion-patterns"]`).
- `SettingsRowCopy { label; description? }` — `label` doubles as the accessible name (see `SettingsRowNames`).
- `SettingsGroup { heading; description?; openInPanel?; panelClass?; panelBodyClass?; panelReset?; blocks: SettingsRowBlock[] }`; `SettingsRowBlock { collapsedUnder?; panelClass?; rows: SettingsRow[] }` — blocks exist because force-layout tucks advanced knobs behind a collapsible and sizing separates the metric table from the range inputs.
- `SETTINGS_GROUPS: Record<SettingsSection, SettingsGroup>` — one entry per section from `SETTINGS_SECTIONS` (`src/view/settingsSectionFields.ts`): `depth-defaults`, `node-sizing`, `node-contents`, `force-layout`, `node-exclusion`, `performance`.
- `EVERY_SETTINGS_ROW: readonly SettingsRow[]` — flat, render-order list across all sections; `settingsRowsFor(kind)` filters it by control kind. **This is the enumeration surface a spec-iterating test should walk.**
- Rows are NOT strictly 1:1 with settings fields: `sizing-metric` produces 5 rows from ONE `sizing` field (derived from `SIZING_METRICS`, `src/view/sizingMetrics.ts`); `force-layout` produces 7 rows from ONE `forceLayout` field (from `FORCE_LAYOUT_MAIN_FIELDS`/`FORCE_LAYOUT_ADVANCED_FIELDS`, `src/view/forceLayoutFieldMeta.ts`). Every row IS control-kind-typed (no "non-field" rows like buttons or bare headings — restore-defaults buttons and card headings are presenter-level chrome derived from `SettingsGroup.heading`/`panelReset`, not `SettingsRow`s).
- `DEPENDENCY_AWARE_CONTROL_KINDS = ["exclusion-patterns"]`; `isSettingsRowDisabled(row, state)` — pure function, `state: SettingsRowState = SettingsWriteContext` (the same 3-slice shape: `globalDepths`, `globalView`, `nodeExclusion`).
- `unhandledRowControl(control: never): never` closes both presenters' switches (see §3).
- `SettingsRowNames.sole/role/action` — the one accessible-naming convention both presenters must apply.

## 3. The two presenters

- `src/view/VicinityGraphSettingTab.ts` — `PluginSettingTab` subclass; walks `SETTINGS_SECTIONS`/`SETTINGS_GROUPS` and switches on `row.control.kind` (search `switch (row.control.kind)` / the per-`case` `addRow`-style methods), closed with `default: return unhandledRowControl(row.control);` (a `void`-returning arm, so this default is load-bearing — see the long comment in `settingsRows.ts:97-109`).
- `src/view/SettingsRowView.tsx` (panel row renderer) — pure function component `SettingsRowView({ row, state })`, switches on `row.control.kind` (lines 69-90), same `default: return unhandledRowControl(row.control);`. `src/view/GraphToolbar.tsx` is the outer walker that iterates `SETTINGS_SECTIONS`/`SETTINGS_GROUPS` and hands each row to `SettingsRowView`.
- Shared helpers: `SettingsRowNames` (naming), `isSettingsRowDisabled` (disabled state), `parseSizingInput`/`sizingInput.ts`, `SIZING_RANGES`/`FORCE_LAYOUT_RANGES` from `src/engine/constants.ts`, `settingsWritePipeline.ts` (both presenters write through the SAME `SettingsWritePipeline` instance).
- **Test infra**: there is NO jsdom/@testing-library render harness (confirmed — no such deps wired into these tests) and no "Fake Obsidian `Setting`" shim. `docs-internal/notes/settings.md` records this explicitly as an open, undecided item: `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` ("decide: React component-test infra — jsdom + a light renderer"), raised by ticket 3's review, ordering vs. presenters (4) left to the owner. Because of this, the EXISTING parity test (`src/view/settingsRowParity.test.ts`, already landed by ticket 4) is a **source-scan** test, not a render test: it `readFileSync`s `VicinityGraphSettingTab.ts` / `SettingsRowView.tsx` / `GraphToolbar.tsx` and checks for literal substrings like `` `case "${kind}":` ``, `"return unhandledRowControl(row.control)"`, `"SETTINGS_GROUPS"`, `"SETTINGS_SECTIONS"`. A realistic parity test in the CURRENT infra can only assert structurally-scannable things: every declared control kind has a `case` in both presenter source files; both switches are closed by the shared guard; both walkers read `SETTINGS_GROUPS`/`SETTINGS_SECTIONS` rather than a hand-rolled list. It CANNOT (without new render infra) assert actual rendered accessible names, order, or disabled DOM state — those would need the undecided `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` work. Note this ticket-5 dir's name (`nid_x6hgehsu5il1d1shuraz3ufqy_e`) already has ONE parity test in place (`settingsRowParity.test.ts`) plus a companion structural test (`settingsRows.test.ts`); the implementation task is likely to EXTEND/harden these rather than start from zero — worth confirming with the requester whether ticket 5 is asking for more than what already exists (see PRIVATE notes for a gap list).

## 4. Existing settings tests that hand-enumerate literals (staleness-prone)

All under `src/engine/` and `src/view/` and `src/persistence/`, current line counts:

| File | Lines | What it pins | Staleness risk |
|---|---|---|---|
| `src/engine/SettingsSpec.test.ts` | 290 | Two giant hand-built object literals (`toEqual`) mirroring EVERY `SETTINGS_SPEC` default and EVERY limit, field by field, plus adapter projection tests (`EngineDefaults.*`, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`, `DEFAULT_*`, `MIN_*` aliasing) | **HIGH** — exactly the class of test the two staleness tickets are about (`collidePaddingPx`, `linkStrengthFactor.max` both went stale here twice). Has its own compile-time exhaustiveness guard (`EverySpecField<T>`/`SpecLimitsBaseline<T>` `satisfies` types) so a *missing* field is caught, but a *changed* value still needs manual re-pin. |
| `src/engine/forceLayoutSettings.test.ts` | 70 | `EngineDefaults.forceLayoutSettings()` exact literal (7 fields) + clamp behavior over `FORCE_LAYOUT_RANGES` (already structural: iterates `Object.entries(FORCE_LAYOUT_RANGES)`) | Medium — the defaults literal duplicates `SettingsSpec.test.ts`'s forceLayout defaults block; the clamp tests are already spec-iterating (good pattern to imitate). |
| `src/persistence/persistedShapes.test.ts` | 313 | Round-trip / parse-fallback / clamp behavior for every family (depths, view incl. sizing/forceLayout, nodeExclusion, pins); mostly BEHAVIOR (WHEN/THEN) not baseline literals, but the "all fields non-default round-trip" (`NON_DEFAULT_VIEW`) fixture is a hand-typed `ViewSettings` literal that is type-checked to be complete (`satisfies`-like via direct annotation) — good candidate to keep/model, not to genericize away. |
| `src/view/settingsResetPlan.test.ts` | 311 | Per-scope reset behavior (mostly structural: compares reset output to `EngineDefaults.*()`), plus copy-text literal assertions (scope labels, confirmation copy) — these are product-meaningful UX strings, not defaults, and should stay hand-asserted. |
| `src/view/settingsWritePlan.test.ts` | 151 | Not fully read in depth this pass — worth a look before authoring; likely per-interaction-kind switch behavior (exhaustive over `SettingsInteraction`/`SettingsCommand` kinds already, good pattern). |
| `src/view/settingsResetSequence.test.ts` | 110 | Sequencing/ordering behavior of restore-defaults draining the write queue — behavior, not literal defaults. |
| `src/view/engineDefaultsSingleSource.test.ts` | 81 | Source-scan guard (no view module besides an allowlist calls `EngineDefaults.*Settings()` directly) — a *pattern* worth reusing for a parity guard, not itself a defaults baseline. |
| `src/view/settingsValidation.test.ts` | 73 | Not read in depth this pass. |
| `src/view/sizingMetrics.test.ts` | 23 | Completeness/no-duplicate guard over `SIZING_METRICS` — already structural. |
| `src/view/settingsRows.test.ts` | 111 | **Already spec/model-iterating** (distinct labels, every control kind used, no empty section, `disabledWhen` scope) — good existing template. |
| `src/view/settingsRowParity.test.ts` | 102 | **Already the tab/panel parity test** (source-scan, see §3) — likely the base to extend, not a greenfield task. |

**Genuinely product-meaningful literals to KEEP** (per the owner decision recorded in `docs-internal/notes/settings.md`, "Tests" bullet: *"structural spec-iterating tests, but KEEP a small number of literal assertions for product-meaningful defaults (e.g. nodeCap 100)"*): e.g. `nodeCap: 100`, `outgoingDepth/incomingDepth: 1`, `outlineMaxDepth: 2`, `own-file-size` as the sole default-on metric, exclusion `enabled: false` — i.e. the handful of values with an explicit product rationale documented as a comment in `SettingsSpec.ts` (nodeCap 100 "step doc: default 100", depth 1 "mirrors Obsidian's local-graph default", etc.). The BULK of the `toEqual` blocks in `SettingsSpec.test.ts`/`forceLayoutSettings.test.ts` (every force-layout tuning constant, every bound) are the staleness-prone ones the ticket wants converted to structural per-field iteration (e.g., "every spec field with `min`/`max`/`step` clamps its own default inside its own range", "every spec default is inside `[min,max]`" etc.), with only the short explicitly-called-out list kept as `toBe(literal)`.

## 5. Parse / round-trip / reset / bounds machinery

- **Persistence parse**: `src/persistence/persistedShapes.ts` — `PersistedShapes.parsePluginData(raw)` (pure, no Obsidian import), `PersistedShapes.defaultPluginData()`. Per-family parse functions: `parseDepthFields`, `parseViewFields` (backed by `ParsedViewFields` mapped-type completeness guard), `parseSizing`, `parseForceLayout`, `parseMetricSetting`, `parseNodeExclusion`, `parsePins`. `PERSISTED_SHAPE_VERSION = 2`; version mismatch ⇒ full defaults (no migrations, by design — see CLAUDE.md "clean breaks").
- **Defaults**: `src/engine/constants.ts` `EngineDefaults.{depthSettings,viewSettings,sizingSettings,forceLayoutSettings,nodeExclusionSettings}()` — thin projections of `SETTINGS_SPEC.*.default`. Also exports `DEFAULT_*` named aliases, `MIN_*`/`MAX_*` bound aliases, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`.
- **Reset-to-defaults**: `src/view/settingsResetPlan.ts` — `planSettingsReset(scope, context)` returns `SettingsCommand[]`; `planSettingsResetConfirmation(scope, context)` decides whether a confirm dialog is needed (only when destroying stored exclusion patterns) and builds its copy; `SETTINGS_RESET_SCOPES` catalogue. Scopes derive from `src/view/settingsSectionFields.ts` (`SECTION_SETTINGS_FIELDS`, itself completeness-guarded). Sequencing (draining the write queue before applying a reset) lives in `src/view/settingsResetSequence.ts`.
- **Clamping/bounds**: `src/engine/constants.ts` exports `clampOutlineMaxDepth`, `clampSizingSettings`, `clampSizingNumber` (per sizing/style docs), `clampForceLayoutSettings`, `clampStepperDepth` (view-layer, `src/view/constants.ts`) — all pure functions reading bounds off `SETTINGS_SPEC`/`FORCE_LAYOUT_RANGES`/`SIZING_RANGES`.
- **What a spec-iterating test can call directly, no Obsidian**: `SETTINGS_SPEC` itself, every `EngineDefaults.*`, every `clamp*` function, `PersistedShapes.parsePluginData`/`defaultPluginData` (pure — takes/returns plain objects), `SETTINGS_GROUPS`/`EVERY_SETTINGS_ROW`/`settingsRowsFor`/`isSettingsRowDisabled`/`SettingsRowNames` from `settingsRows.ts` (pure, no React/Obsidian import — confirmed by its own doc comment and by `e2e/*.ts` importing it in the Node process), `planSettingsReset`/`planSettingsResetConfirmation` from `settingsResetPlan.ts`. None of these require Obsidian or a DOM.

## 6. Per-doc state removal

Confirmed **gone**: `src/adapters/CentralDepthRoundTrip.test.ts` does not exist in `src/` (only stale copies remain under `.tmp/planprobe/**` and `.tmp/planprobe/src.good/**`, which are scratch artifacts from a prior planning pass, not real source). It was removed by commit `347dc77` "refactor(persistence): delete the doc-data store — data.json is the only persisted file" (per-doc removal, ticket `nid_ez38gf1mrdgh5kxedzrdicwzl_e`, step 2.5 in the chain). `src/adapters/` today has no doc-data-round-trip test at all; `src/persistence/PluginDataStore.ts`/`.test.ts` and `persistedShapes.ts`/`.test.ts` are the sole persistence surface.

`npm test` on current HEAD: **87 files / 1139 tests, all passing** (`.tmp/explore-test.log`).

## 7. `docs-internal/notes/settings.md` — relevant parts for step 5

Full file read; key points for this ticket:

- The 6-ticket chain (table under "The chain — order and why"): step 5 = `nid_x6hgehsu5il1d1shuraz3ufqy_e`, **"Spec-driven tests: iterate the descriptor list instead of hand-enumerated literals; parity test tab-vs-panel — Needs the final shape of 2-4 to pin against."** It depends on steps 2 (descriptor model), 3 (write pipeline), 4 (dual presenters) — all marked done/closed in the doc.
- Under "Satellite tickets": **"Behind tests (5): `nid_ek3wrqoh1rsftk6ulg836mghf_e` (e2e types into a settings input)"** — a follow-up blocked on step 5 landing, not part of step 5 itself.
- Ticket 4's summary explicitly names `settingsRowParity.test.ts` as already delivered: *"`settingsRowParity.test.ts` additionally source-scans that neither surface has gone back to a hand-written row list and that both switches still carry that closing `default`. Ticket 5 iterates that model instead of literal lists."* — i.e. settings.md itself frames ticket 5's job as extending/formalizing the iteration pattern already prototyped by ticket 4's row-model tests (`settingsRows.test.ts`, `settingsRowParity.test.ts`), applying the same idea to the SPEC baseline tests (`SettingsSpec.test.ts`, `forceLayoutSettings.test.ts`) which still use hand-enumerated `toEqual` blocks.
- **Standing owner decisions (2026-07-29)** section — the directly load-bearing bullet: *"Tests: structural spec-iterating tests, but KEEP a small number of literal assertions for product-meaningful defaults (e.g. nodeCap 100)."* Also: *"Obsidian constraint: the Setting API cannot mount inside React, so there will always be two renderer implementations — parity is guarded by a test over the descriptor list, not by a single renderer."* — i.e. the parity test's job is explicitly scoped to a *descriptor-list-driven* check, matching what `settingsRowParity.test.ts` already does (source-scan against `SETTINGS_ROW_CONTROL_KINDS`/`SETTINGS_GROUPS`), not a full DOM-render comparison — DOM-level parity is out of scope until/unless `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` (React component-test infra) lands, which settings.md records as **undecided** whether it should block anything in this chain.
- The completeness-guard pattern used repeatedly (`Exclude<keyof A, keyof B> extends never ? true : ...`) is explicitly the project's preferred style for "N compile-forced declarations" rather than a single runtime-derived descriptor type (the owner explicitly declined deriving `ViewSettings` from a runtime array — see "Cost of adding one field AFTER ticket 2" section). A spec-iterating *test*, by contrast, is fully in scope and is exactly what ticket 5 asks for — it's the assertion style, not the type derivation, that should change.

## Key file pointers

- Spec: `src/engine/SettingsSpec.ts`, `src/engine/SettingsDefaults.ts`, `src/engine/constants.ts`, `src/engine/types.ts`
- Rows: `src/view/settingsRows.ts`, `src/view/settingsSectionFields.ts`, `src/view/sizingMetrics.ts`, `src/view/forceLayoutFieldMeta.ts`, `src/view/nodePreviewPreferenceMeta.ts`
- Presenters: `src/view/VicinityGraphSettingTab.ts`, `src/view/SettingsRowView.tsx`, `src/view/GraphToolbar.tsx`
- Write/reset: `src/view/settingsWritePipeline.ts`, `src/view/settingsWritePlan.ts`, `src/view/settingsResetPlan.ts`, `src/view/settingsResetSequence.ts`
- Persistence: `src/persistence/persistedShapes.ts`, `src/persistence/PluginDataStore.ts`
- Existing tests to extend: `src/engine/SettingsSpec.test.ts`, `src/engine/forceLayoutSettings.test.ts`, `src/view/settingsRows.test.ts`, `src/view/settingsRowParity.test.ts`
- Doc: `docs-internal/notes/settings.md`
