# Exploration: settings & controls mechanics for a node-content (outline/image) pill

> Captured by TOP_LEVEL_AGENT from the EXPLORATION_SETTINGS_CONTROLS agent
> (that agent ran read-only and could not write files itself). Content is its
> report verbatim in substance. Companion doc:
> `EXPLORATION__CONTENT_RULES__PUBLIC.md` (where the outline-vs-image decision
> lives today).

## 1. Settings model

- **Spec (single source of truth for defaults + limits)**: `src/engine/SettingsSpec.ts`.
  `ViewSpec` interface (`SettingsSpec.ts:67-74`) has `nodeCap, outlineMaxDepth,
  groupByFolder, edgeVisibility, sizing, forceLayout`. Spec object is
  `SETTINGS_SPEC.globalView` (`:112-227`); `outlineMaxDepth: { default: 2, min: 1,
  max: 6, step: 1 }` at `:125`.
- **Resolved runtime shape**: `ViewSettings` (`src/engine/types.ts:246-258`).
  `ViewSettingsOverride = Partial<ViewSettings>` (`types.ts:265`) is the
  per-doc/pinned override shape (absent field = inherit).
- **Defaults factory**: `EngineDefaults.viewSettings()` (`src/engine/constants.ts:160-170`)
  projects `SETTINGS_SPEC.globalView` field-by-field into `ViewSettings`.
  `MIN_OUTLINE_DEPTH`/`MAX_OUTLINE_DEPTH`/`clampOutlineMaxDepth` at `constants.ts:37-49`.
  **A new field must be added to this projection or it is silently omitted** —
  exactly the bug class `c5583d5` fixed.
- **"Node contents" section today** = exactly one field, `outlineMaxDepth` (slider 1–6).
  **No on/off toggle by design**: README (`README.md:59-66,135-148`) and code comments
  (`SettingsSpec.ts:118-124`, `VicinityGraphSettingTab.ts:312-320`) all state the
  outline-vs-image choice is decided by *document structure*, citing the
  CLARIFICATION Q2 decision. **A user-facing pill is a genuine behavior change from
  this documented model**, not merely a new row.
- **Persistence + versioning**: `src/persistence/persistedShapes.ts`.
  `PERSISTED_SHAPE_VERSION = 2` (`:33`); `PluginData.globalView: ViewSettings` (`:42-49`).
  Per-field parser `parseViewOverride()` (`:132-157`) — each field independently
  recognized/clamped/defaulted; malformed falls back to `EngineDefaults`.
  Enum idiom = `edgeVisibility` (`find` against an allowed-values array, `:66,150-153`);
  boolean idiom = `groupByFolder` (`:146-149`).
  **Additive fields with a spec default do NOT bump `PERSISTED_SHAPE_VERSION`**
  (confirmed precedent for `outlineMaxDepth`).
- **Resolver cascade** (main-doc override → pinned override → global):
  `src/engine/ViewSettingsResolver.ts:33-54`. **Every `ViewSettings` key must be listed
  explicitly in the return object at `:46-53`** — omission ⇒ resolves `undefined`.

## 2. Propagation to the graph view — no relayout needed

- **Shared write path for BOTH surfaces**: `SettingsInteraction` (user intent) →
  `planSettingsWrite()` → `SettingsCommand`, all in `src/view/settingsWritePlan.ts:25-104`.
  `outlineMaxDepth`'s interaction is `"global-outline-depth"` (`:40,95-96`). A new
  preference adds one interaction variant + one `planSettingsWrite` case returning
  `{ kind: "global-view", view: { ...ctx.globalView, <field>: value } }`.
- **Execution**:
  - Settings tab: `VicinityGraphSettingTab.applyInteraction()` (`:449-452`) → `persist()`
    switch (`:484-499`) → `plugin.refreshOpenViews()` (`main.ts:95-102`).
  - Controls panel: `ControlsActions.applySettings()` (`ControlsActions.ts:37-40`) →
    `executeSettings()` switch (`:56-94`) → `controller.handleSettingsChanged()`.
- **Rebuild trigger**: `GraphViewController.handleSettingsChanged()` (`:152-155`) clears
  debounce, calls `runRebuild()` (latest-wins via monotonic `rebuildToken`).
- **Relayout decision — the important part**: `runRebuild()` (`GraphViewController.ts:182-228`)
  always calls `decideLayout(previous, next, SIZE_RELAYOUT_THRESHOLD)`
  (`GraphStructureDiff.ts:26-45`), which forces a full elk+d3 relayout ONLY on:
  first build, `groupByFolder` flip, any `forceLayout` change, node/edge **id** set
  change, or a surviving node's `sizePx` growing past threshold.
  **None are sensitive to node-content changes** ⇒ a content-preference toggle is a
  data-only refresh (positions kept, only `vicinityGraphToFlow()` recomputed), exactly
  like `outlineMaxDepth` behaves today.
- **Trap**: if the implementation makes `sizePx` depend on the preference, every toggle
  would cross `SIZE_RELAYOUT_THRESHOLD` and force relayouts. Flagged, not decided.

## 3. Settings-tab UI — **no pill/segmented pattern exists in the repo**

- **File**: `src/view/VicinityGraphSettingTab.ts`, plain `PluginSettingTab` (docblock `:32-43`).
  `display()` (`:76-90`) renders six section cards in fixed order via
  `renderDepthDefaults / renderSizing / renderNodeContents / renderForceLayout /
  renderExclusion / renderPerformance`, then `renderRestoreAll()`.
- **Current card**: `renderNodeContents()` (`:321-342`) — one `Setting` with
  `.addSlider(...)` for `outlineMaxDepth` + `this.addSectionReset(section, "node-contents")`.
- **Row idiom**: `new Setting(section).setName().setDesc().addX()` — `.addSlider`,
  `.addToggle`, `.addText`, `.addTextArea`, `.addButton` used. **Obsidian's `Setting` API
  has no `.addPill`/segmented equivalent, and none has been built here.**
- Repo-wide grep found **no** `radio`, `<select>`, `addDropdown`, `role="radiogroup"`,
  or "segmented" anywhere in `src/`. Closest analogues:
  - Tab boolean: `Setting(...).addToggle(...)` (`:198-210`, `:269-279`).
  - Controls-panel boolean: custom `ToggleSwitch` (`src/view/ToggleSwitch.tsx:1-32`) —
    reuses Obsidian's `checkbox-container`/`is-enabled` markup + native checkbox so it
    themes identically with zero plugin CSS. **Good precedent for how to get native
    theming without inventing CSS.**
  - `edgeVisibility` (`types.ts:149`) is the only existing 2-value enum in `ViewSettings`
    — referenced only in engine/persistence/tests, **zero UI anywhere**. A cautionary
    tale, not a template.
  - ⚠ "Pill" in this codebase currently means the node-exclusion **badge/count chip**
    (`NodeExclusionSection.tsx:18-20,44-54`; `ControlsModel.ts:62-69`, `types.ts:275`,
    `VicinityGraphSettingTab.ts:187`) — a rounded label, NOT a segmented control.
    Do not conflate when searching.
- **CSS**: `src/view/settings-tab.css` has the framed-card look
  (`.vicinity-graph-settings-section`) and reset-row style
  (`.vicinity-graph-settings-reset`); nothing segmented-shaped. A pill needs new CSS.

## 4. Restore-defaults wiring — exact registration points (per `c5583d5`)

A new settings row/section must touch **all** of these:

1. **`SettingsResetScope` union** — `src/view/settingsResetPlan.ts:22-29` (add scope, or
   reuse existing `"node-contents"` if the pill lives in that card).
2. **`SETTINGS_RESET_SCOPES` entry** — `settingsResetPlan.ts:79-160`; `plan` emits
   `{ kind: "global-view", view: {...ctx.globalView, <field>: SETTINGS_SPEC.globalView.<field>.default} }`
   (idiom identical to `"node-contents"` `:93-102`, `"performance"` `:135-141`).
   Confirmation rule (`:114-120`): **only scopes destroying user-authored content
   confirm** (today `node-exclusion`, `all`) ⇒ a preference knob applies instantly.
3. **`SECTION_RESET_SCOPES` array** — `settingsResetPlan.ts:167-174`, in settings-tab
   render order (documented contract; iterated by tests/e2e for "one reset row per section").
4. **`ALL_SCOPE_DESCRIPTION`** — `settingsResetPlan.ts:68-69`, used twice (tab-wide footer
   row description AND the confirm-modal body, `VicinityGraphSettingTab.ts:144-157`).
   Must enumerate the new section's noun — **now test-enforced** (see §6).
5. **`VicinityGraphSettingTab.ts`** — `addSectionReset(section, <scope>)` as the card's
   literal last row (`renderNodeContents()` does this at `:341`). A brand-new card also
   needs a `renderX()` + a `display()` call site (`:76-90`) + bumping the "six/seven
   cards" prose in three doc-comments at `:100-121`.
6. **Guard that exists but is insufficient**: `_assertEveryResetScopePlaced`
   (`settingsResetPlan.ts:183-185`) catches an *orphaned* scope but NOT a *missing* one —
   the node-contents card shipping with zero reset row compiled fine (that's `c5583d5`).

## 5. In-graph controls panel

- **Root**: `src/view/GraphToolbar.tsx` — React-Flow `<Panel position="top-left">`,
  collapsed `<details>`, each section behind a `<Disclosure>` (`:36-58`). Sections today:
  `CentralDepthControls`, `NodeExclusionSection`, `SizingSection`, `ForceLayoutSection`.
  **`outlineMaxDepth` has NO controls-panel counterpart** — a precedent gap this
  feature's "expose in both" requirement must not repeat.
- **Mirroring pattern (best example: force-layout)**:
  - **Shared**: numeric bounds in engine `FORCE_LAYOUT_RANGES`; UI copy (label +
    one-sentence description) in `src/view/forceLayoutFieldMeta.ts`
    (`FORCE_LAYOUT_FIELD_META`, `:16-41`), consumed by BOTH
    `VicinityGraphSettingTab.addForceLayoutSlider()` (`:418-433`) and
    `ForceLayoutSection.tsx`'s `ForceLayoutSlider` (`:66-100`). Same
    `SettingsInteraction`/`planSettingsWrite` write path from both surfaces.
  - **NOT shared**: the markup. Tab uses Obsidian's native `Setting().addSlider(...)`
    (cannot mount inside React); panel hand-rolls
    `<label><input type="range" className="slider" …/></label>` (`ForceLayoutSection.tsx:84-97`)
    reusing Obsidian's `slider` class for native theming.
    ⇒ **The repo's contract is: share DATA (bounds + copy) + the write plan; duplicate
    the markup.** A pill needs one shared `*FieldMeta`-style module (option labels)
    consumed by two independently-built markup blocks.
  - `SizingSection.tsx` / `NodeExclusionSection.tsx` follow the same shape.
- **Panel write path**: sections call `useControlsActions()` (`ControlsActionsContext.ts`)
  then `void actions.applySettings(planSettingsWrite({kind: …}, ctx))`.
  `ctx: SettingsWriteContext` (`{ globalDepths, globalView, nodeExclusion }`) assembled
  once in `GraphToolbar.tsx:29-33` from the `ControlsModel` snapshot, threaded as a prop.
  Note: tab and panel read "current value" from two different objects
  (`PluginDataStore` reads vs. `ControlsModel` snapshot) though they write the identical command.
- **All panel writes go to plugin settings (global), never view-local state.**
  `ControlsModel` (`:43-72`) is a pure per-rebuild read-model off `GraphRequestInputs`;
  every mutation round-trips persistence → `handleSettingsChanged()` → rebuild.
  There is no local-only control. A per-doc override IS supported by the
  `ViewSettings`/`ViewSettingsOverride` split if wanted (mirrors depth's
  `"main-depth"`/`"central-depth"` interactions in `settingsWritePlan.ts`).
- **Where the decision happens today** — see `EXPLORATION__CONTENT_RULES__PUBLIC.md`.
  Summary: `ObsidianLinkProvider.outlineOf()` (`:145-166`) returns `[]` when
  `referencesImageAbove()` (`:179-190`) ⇒ "the image wins" at adapter/engine-input time,
  **discarding** the outline rather than deprioritizing it; `flowMapping.toFlowNodeData()`
  (`:290-310`) then filters by `outlineMaxDepth`; `nodePreviewChoice.nodePreviewKind()`
  (`:20-25`) mechanically reflects upstream data with no agency.
  ⇒ Forcing "outline" when an image currently wins needs either a view-layer override
  with new inputs, or the preference plumbed so `node.outline` is always populated.
  **Genuine architecture question spanning three layers — flagged, not decided.**

## 6. Existing tests — the enumeration traps

- **`src/engine/SettingsSpec.test.ts`** (201 lines) — two `toEqual`s hand-enumerate every
  `ViewSpec` field:
  - `"…default values equal the exact shipped baseline"` (`:28-79`) —
    **already missing `outlineMaxDepth`**: a live pre-existing enumeration gap proving
    this test shape is easy to under-populate.
  - `"EngineDefaults.viewSettings is built"` (`:111-120`) DOES include `outlineMaxDepth` (`:114`).
  - ⇒ A new field must join **both** literals or they fail (extra actual key) / silently under-assert.
  - **Known-RED baseline**: `linkStrengthFactor.max` (do-not-touch per
    `ticket-settings-baseline-tests-stale-after-spacing-change.md`) ⇒ expect 1
    pre-existing failure; **do not attribute to new work, do not "fix" in passing.**
- **`src/view/settingsResetPlan.test.ts`** — `TUNED_VIEW` (`:17-…`) is a hand-built
  "every field off default" fixture (already carries `outlineMaxDepth: 5` from `c5583d5`).
  A new field needs a non-default tuned value or reset assertions pass **vacuously**.
  Also holds the enumeration guard from `c5583d5`:
  `"tab-wide description enumerates every section"` — derives each section's noun from
  `SETTINGS_RESET_SCOPES[scope].label` and asserts `ALL_SCOPE_DESCRIPTION` contains it,
  for every `SECTION_RESET_SCOPES` entry ⇒ §4 point 4 is enforced, not just documented.
- **`src/engine/settingsResolvers.test.ts`** — per-field cascade cases
  (main-override / pinned-fallback / global-fallback). New field needs its own case.
- **`src/persistence/persistedShapes.test.ts`** — absent/malformed/clamped parsing per field.
- **e2e section/row-count baselines — the explicit trap, spread across THREE files with
  no shared constant:**
  - `e2e/settingsResetReview.e2e.ts` — `.vicinity-graph-settings-section`
    `toHaveCount(6)` (~`:62`); `dirtyEverySection()` helper (must be extended for a new
    field to keep the isolation matrix meaningful); exact ordered `toEqual` array of
    reset-button accessible names (`"Restore depth defaults"`, `"Restore node sizing
    defaults"`, `"Restore node contents defaults"`, …).
  - `e2e/settingsResetVerify.e2e.ts` — same `toHaveCount(6)`.
  - `e2e/settingsUxVisual.e2e.ts` — same `toHaveCount(6)` (+ comment listing all six card
    names) AND `.vicinity-graph-settings-reset` count + exact `toHaveText([...])` list.
  - A ticket already flags this triplication as a deliberately-deferred DRY target.
- **`src/view/ControlsModel.test.ts`** — read-model tests incl. exclusion "pill write ctx" (`:150`).
- **No test enumerates "every `ViewSettings` field has a controls-panel row"** (several
  don't: `outlineMaxDepth`, `edgeVisibility`) ⇒ **no existing guard forces controls-panel
  parity**; such a guard would have to be newly authored.

## 7. Relevant tickets

| Ticket | State | Relevance |
|---|---|---|
| `ticket-node-outline-live-refresh.md` | OPEN | How fast an outline refreshes after a heading edit (`metadataCache.on("resolved")` → debounced rebuild). Adjacent background. |
| `ticket-node-outline-heading-jump-smoke-run.md` | OPEN | Manual GUI smoke for outline click-to-heading. Same feature family. |
| `ticket-settings-baseline-tests-stale-after-spacing-change.md` | OPEN | The one stale baseline (`linkStrengthFactor.max`). **Author-only; don't touch.** |
| `ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md` | CLOSED | Historical sibling of the above. |
| `ticket-dev-vault-recognizable-thumbnail.md` | OPEN | Image/thumbnail dev-vault fixtures — useful if e2e needs a note with BOTH an image and headings. |

**No ticket proposes an outline/image user preference.** Closest prior art is the
CLARIFICATION-Q2 decision (documented in `SettingsSpec.ts`, `VicinityGraphSettingTab.ts`,
README) that explicitly **rejected** an on/off toggle in favor of document-position
control — which this feature reverses or supplements.
