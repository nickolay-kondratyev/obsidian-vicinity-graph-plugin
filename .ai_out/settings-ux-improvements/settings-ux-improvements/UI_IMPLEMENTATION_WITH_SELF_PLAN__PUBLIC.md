# UI_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md — settings-ux-improvements

## Plan summary

One visual grammar per surface: the settings tab gets CSS-only framed section cards (no
collapsibles, per CLARIFICATION #2); the graph controls panel becomes a stack of uniform
disclosures (shared `<Disclosure>` component) where Depth is the only section open by default
(CLARIFICATION #3). Force-layout tuning gains full in-graph parity (6 sliders + Restore defaults)
with all copy sourced from ONE shared field-meta table (CLARIFICATION #4). Node exclusion in the
panel becomes an Obsidian-native toggle switch inside a disclosure, showing the read-only pattern
list + count when ON (CLARIFICATION #1). No engine changes; no new interaction kinds.

## What changed (files + why)

New:
- `src/view/forceLayoutFieldMeta.ts` — shared label/description table
  (`FORCE_LAYOUT_FIELD_META`, compile-time exhaustive over `keyof ForceLayoutSettings`) +
  `FORCE_LAYOUT_MAIN_FIELDS` / `FORCE_LAYOUT_ADVANCED_FIELDS` presentation partition with a
  type-level "no ungrouped field" assert. Single source of copy for both surfaces (DRY).
- `src/view/forceLayoutFieldMeta.test.ts` — BDD: partition covers every `FORCE_LAYOUT_RANGES`
  key exactly once (closes the runtime duplicate-field gap the type assert can't).
- `src/view/Disclosure.tsx` — shared collapsible (native `<details>`, existing
  `vicinity-graph-disclosure` CSS classes; `defaultOpen` applied on first render only — React
  never rewrites the DOM `open` property because the prop never changes, so user toggling
  survives snapshot re-renders). Replaces 5 hand-copied markup blocks.
- `src/view/ToggleSwitch.tsx` — Obsidian-native switch by reusing Obsidian's OWN
  `checkbox-container mod-small` / `is-enabled` markup contract around a real checkbox
  (zero plugin CSS, community themes included, keyboard focus on the native input).
- `src/view/ForceLayoutSection.tsx` — in-graph force-layout disclosure: 4 main sliders, nested
  "Advanced spacing" disclosure (2 sliders), Restore defaults →
  `EngineDefaults.forceLayoutSettings()`. Bounds from `FORCE_LAYOUT_RANGES`, copy from the shared
  meta table (long descriptions ride as native `title` tooltips — no room at 260px), writes via
  the existing `global-force-layout` interaction; live relayout comes free from
  `GraphStructureDiff.sameForceLayout`.
- `src/view/settings-tab.css` — settings-tab card styling, fully scoped under
  `.vicinity-graph-settings`, theme vars only.
- `e2e/settingsUxVisual.e2e.ts` — feature e2e (real Obsidian): default open/closed disclosure
  states, exclusion toggle round-trip + read-only pattern list + designed empty state, 6 sliders +
  persisted write + Restore defaults, settings tab renders 5 framed cards with plugin CSS
  provably applied (computed border style). Screenshots → `.out/settings-ux/` (gitignored).

Modified:
- `src/view/GraphToolbar.tsx` — Depth steppers wrapped in `<Disclosure defaultOpen>`; pinned
  centrals use `<Disclosure>`; `ForceLayoutSection` appended (existing section order preserved).
- `src/view/NodeExclusionSection.tsx` — rewritten: disclosure whose summary carries the
  excluded-count badge (still visible while collapsed — no affordance regression), body has the
  ToggleSwitch row; when ON, read-only monospace pattern chips + "edited in plugin settings" hint,
  designed empty state when no patterns.
- `src/view/SizingSection.tsx` — markup swapped to `<Disclosure>` (behavior identical,
  `vicinity-graph-sizing` class + `nowheel` body preserved for e2e/CSS contracts).
- `src/view/VicinityGraphSettingTab.ts` — each `renderX()` builds into its own
  `.vicinity-graph-settings-section` card div (`createSection()`); force-layout section now loops
  the shared meta fields (`addForceLayoutSlider(container, field)` — hardcoded copy deleted);
  container param threaded through `addDepthSlider`/`addSizingNumber`.
- `src/view/graph-view.css` — exclusion pill styles replaced by disclosure/toggle-row/pattern-list
  styles; new force-layout slider styles (muted label + tabular-nums value readout over a
  full-width `slider`-classed range input); all theme vars.
- `esbuild.config.mjs` — `AUTHORED_CSS_FILES` ordered list (graph-view.css + settings-tab.css)
  concatenated into generated `styles.css` (explicit list, not a glob: order is part of the
  output contract).

## Decisions taken

1. **ToggleSwitch via Obsidian's `checkbox-container` classes** rather than a hand-built switch:
   pixel-identical to the settings-tab toggle in every theme with zero plugin CSS. Verified
   working (click + `is-enabled` + persistence) in real Obsidian e2e. Trade-off: relies on
   Obsidian's stable-for-years toggle markup contract (widely used by plugins).
2. **Slider descriptions as `title` tooltips in the panel** (full text stays in settings tab):
   cognitive economy at 260px; copy still single-sourced so nothing can drift.
3. **Excluded-count badge moved into the disclosure SUMMARY** so it stays visible while
   collapsed — preserves the old always-visible count affordance.
4. **Panel section order kept** (Depth, Pinned, Exclusion, Sizing) with Force layout appended —
   no muscle-memory churn for existing controls.
5. **Kept `e2e/settingsUxVisual.e2e.ts` as a permanent spec** (originally scaffolding for visual
   QA) — it captures this feature's behavior contract at real-Obsidian level.
6. `field-meta` lives in `src/view/` (not engine): it is pure UI copy; engine purity untouched.

## Test / build results (all truthful, all green)

- `npm run check` — pass.
- `npm test` — 61 files, 730 tests, all pass (includes new `forceLayoutFieldMeta.test.ts`).
- `npm run build` — pass (styles.css regenerated with both authored CSS files).
- e2e vs REAL Obsidian (headless): `controlsRestart.e2e.ts` + `pinnedCentralScenario.e2e.ts`
  (the two toolbar-touching regression specs) — 3/3 pass. New `settingsUxVisual.e2e.ts` — 4/4
  pass. Screenshots reviewed in `.out/settings-ux/` (panel default state, exclusion ON with
  patterns, force-layout sliders at non-default value, settings cards).

## For reviewers to scrutinize

- `Disclosure` `defaultOpen` semantics (uncontrolled-after-mount via constant prop) — reasoning
  documented in the component doc comment.
- `ToggleSwitch`'s reuse of Obsidian's internal `checkbox-container` class names (decision #1).
- Settings-tab heading spacing override in `settings-tab.css` (`.setting-item-heading` margins)
  against third-party themes — theme vars are used everywhere, but heading spacing is a structural
  override.
- The e2e spec seeds exclusion patterns straight through `pluginDataStore` (throwaway vault copy;
  pattern EDITING via UI remains settings-tab-only by design).

## #QUESTION_FOR_HUMAN

None — all CLARIFICATION decisions were implementable as specified.
