# UI_IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE.md — settings-ux-improvements

## Design Plan (written before implementation)

**Goal**: Settings tab gets CSS-only boxed section cards; graph controls panel becomes fully
collapsible (shared `<Disclosure>`), gains force-layout sliders (full settings parity via a shared
field-meta table) and an Obsidian-native-looking exclusion toggle with read-only pattern list.

**Design Direction**:
- Tone: utilitarian, Obsidian-native. Zero plugin-owned colors; everything from theme vars.
- Density: the panel is 260px wide — sliders use label+value row above a full-width range input;
  long descriptions become `title` tooltips (cognitive economy), full text stays in settings tab.
- Key thesis: the panel is a stack of uniform disclosures — one visual grammar (chevron summary,
  primary-bg card) for every section; Depth is the only open-by-default one (most used).

**Visual Hierarchy** (panel): 1. Depth (open) 2. other disclosures collapsed 3. advanced spacing
nested inside Force layout.

**Component Plan**:
- `Disclosure.tsx` — shared `<details>` wrapper (summary: ReactNode, defaultOpen, className, bodyClassName).
  defaultOpen via `open={defaultOpen || undefined}`: React never rewrites the DOM prop after mount
  because the prop value never changes → user toggling survives snapshot re-renders.
- `ToggleSwitch.tsx` — Obsidian-native switch via Obsidian's own `checkbox-container mod-small is-enabled`
  classes + nested native checkbox (Obsidian CSS absolutely positions the input over the pill; themes restyle it).
- `forceLayoutFieldMeta.ts` — `FORCE_LAYOUT_FIELD_META: Record<keyof ForceLayoutSettings, {label, description}>`
  (compile-time exhaustive) + `FORCE_LAYOUT_MAIN_FIELDS` / `FORCE_LAYOUT_ADVANCED_FIELDS` partition with a
  type-level `MissingField extends never` assert + runtime BDD test vs `Object.keys(FORCE_LAYOUT_RANGES)`.
- `ForceLayoutSection.tsx` — Disclosure "Force layout": 4 main sliders, nested Disclosure "Advanced spacing"
  (2 sliders), Restore defaults button → `EngineDefaults.forceLayoutSettings()` through the existing
  `global-force-layout` interaction.
- `NodeExclusionSection.tsx` rewrite — Disclosure "Node exclusion", count badge in the SUMMARY (kept visible
  while collapsed — no affordance regression), toggle row + (when ON) read-only `<code>` pattern list,
  designed empty state, "edit in settings" hint.
- Settings tab: each renderX() creates its own `.vicinity-graph-settings-section` card div; force-layout
  render loops the shared meta fields.

**CSS**: new `src/view/settings-tab.css` (scoped under `.vicinity-graph-settings`), esbuild concatenates
an AUTHORED_CSS_FILES list. styles.css is injected app-wide by Obsidian → reaches settings DOM.
Panel additions in graph-view.css: forcelayout field/label/value/slider, exclusion patterns/hint.
Range inputs get class `slider` to inherit Obsidian's native slider styling.

**Files touched**: see PUBLIC.md.

## FINAL STATE (implementation complete, all gates green)

- All planned files landed exactly as in the plan; see PUBLIC.md for the authoritative file list.
- Gates: `npm run check` ✓, `npm test` 730/730 ✓, `npm run build` ✓,
  e2e (real headless Obsidian, auto-downloaded by scripts/run-e2e.sh): controlsRestart +
  pinnedCentralScenario 3/3 ✓, new settingsUxVisual 4/4 ✓.
- Screenshots reviewed at `.out/settings-ux/*.png` — panel + settings cards look native and clean.
- change_log entry created: id ag30t4zv30rjovpk28sn32krh.
- Committed on branch settings-ux-improvements.

### Rehydration notes / rationale a clone needs
- `Disclosure` uses `open={defaultOpen || undefined}`: React sets the DOM property once; since the
  prop value never changes across re-renders, React's props-diff never touches it again → user
  toggling is preserved. Do NOT convert to React state.
- `ToggleSwitch` = Obsidian's `checkbox-container mod-small` + `is-enabled` around a real
  checkbox. Obsidian's app CSS stretches the invisible input over the pill, so native click/focus
  works; verified in e2e (class assertion + persisted store read).
- e2e contracts that constrain markup: `.vicinity-graph-toolbar`, `.vicinity-graph-sizing`
  (className passthrough on Disclosure), `.vicinity-graph-disclosure__summary` hasText
  "Pinned centrals", `.vicinity-graph-central[data-kind=...]`, aria buttons
  "Increase incoming depth". Depth disclosure MUST stay defaultOpen or controlsRestart's
  mainRow interactions lose their visible-state premise.
- Settings tab: `createSection()` returns a card div; `display()` adds scope class
  `vicinity-graph-settings` (persists across `containerEl.empty()` — empty() keeps classes).
- esbuild `AUTHORED_CSS_FILES` is an explicit ordered list; add future CSS files there.
- forceLayout slider onChange dispatches on every drag tick → full rebuild each tick (same as
  settings tab / ticket-04 behavior; GraphViewController is latest-wins). If jank is ever
  reported, throttle at the component level, not in the write path.

### What I'd do next (not in scope)
- Consider migrating the settings-tab "Advanced spacing" `<details>` + the panel's nested one to
  one shared visual language (they differ: native marker vs chevron) — deliberate for now
  (settings tab uses Obsidian idioms, panel uses plugin disclosure grammar).

## Gotchas noted during planning (kept for context)
- e2e specs (`controlsRestart.e2e.ts`, `pinnedCentralScenario.e2e.ts`) select `.vicinity-graph-toolbar`,
  `.vicinity-graph-disclosure__summary` hasText "Pinned centrals", `.vicinity-graph-sizing`,
  `.vicinity-graph-central[data-kind=main]` — all preserved by Disclosure output (className passthrough).
  Depth disclosure must be OPEN by default so mainRow() stays reachable post-`ensureOpen(toolbar())`.
- `.vicinity-graph-exclusion` old label CSS replaced; count badge class reused in summary (margin-left:auto
  pushes it right in the summary flex row).
- esbuild `generateStylesCss` reads ONE authored file today — must become a list.
