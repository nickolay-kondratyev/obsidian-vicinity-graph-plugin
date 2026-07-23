# EXPLORATION_PUBLIC — Global Node Exclusion

Consolidated from two Explore agents (data/engine layer + settings/UI/persistence). All refs are `file:line`.

## Feature (from task)
Exclude notes from the graph globally by vault-relative file name, using a **regex-lite** scheme:
- `rel/` should match `rel/some-relationship.md` (unanchored / substring-ish convenience).
- `^rel/` lets regex-savvy users anchor precisely.
- Applied at the **data layer BEFORE visualization processing** (performance win).
- UI: a **pill in the graph controls dropdown** to enable/disable exclusion; when enabled, show **how many nodes were excluded** for that graph (if any).

## Pipeline (data/engine)
- Engine facade: `src/engine/VicinityEngine.ts:44-104` — `build(request)`: resolve view settings → `VicinityTraversal.traverse()` → `NodeSizer` → `GraphTruncator` → assemble `VicinityGraph`.
- **Earliest choke point with a candidate vault-relative path, pre-expansion** = inside BFS right after `neighborsOf()`: `src/engine/VicinityTraversal.ts:93-104`. Sibling to existing per-node filter `if (!this.eligibility.isNodeBearing(neighbor)) continue;` at `:94`. Rejecting here means excluded nodes are never enqueued, never expanded through, never fetch `getFileMetadata` → this is the requested performance win. `GraphTruncator` (`GraphTruncator.ts:29-54`) is **too late** (post-traversal).
- Root gate (centrals/pinned roots): `VicinityTraversal.ts:66-70` — question whether exclusion applies to explicit MAIN/pinned roots.
- SRP owner of "may this path be a node": `src/engine/NodeEligibility.ts:10-17` — natural place to pair an exclusion gate.
- Identity: `VaultPath` (`src/engine/types.ts:11-33`) is the primary traversal key everywhere; vault-relative path is available at every step with **no adapter round-trip**. docIds attach later and only to centrals — patterns must be **path-based**, which fits.
- Pure string utils home (import-guarded, no obsidian/react): `src/shared/VaultPathFacts.ts`, `src/shared/FileKinds.ts`. **Natural home for a new pure regex-lite matcher** (e.g. `PathExclusionMatcher`). Guarded by `src/engine/importGuard.test.ts`.

## Settings threading (existing precedent to mirror)
- Persisted shape: `PluginData` (`src/persistence/persistedShapes.ts:34-40`): `version`, `globalDepths`, `globalView`, `pins`. Defensive non-throwing parser `parsePluginData` (`:77-88`); list/field parse precedent `parseSizing`/`parseViewOverride` (`:121-178`). Version stays v1 (additive).
- Store: `src/persistence/PluginDataStore.ts:23-64` — getters/setters (`globalView()`/`saveGlobalView()`) serialized last-write-wins. Add `nodeExclusion()`/`saveNodeExclusion()`.
- Engine request assembly: `src/adapters/GraphRequestAssembler.ts:51-66` builds `GraphBuildRequest` (`VicinityEngine.ts:27-37`) from inputs; `src/adapters/VicinityGraphBuilder.ts:54-65` loads global settings then builds. Exclusion patterns should reach the engine as a **top-level `GraphBuildRequest` field** (NOT inside `ViewSettings`, which is resolved only *after* traversal).
- Engine defaults: `src/engine/constants.ts` `EngineDefaults` (`:78-87`).

## Settings tab + controls UI
- Global settings tab: `src/view/VicinityGraphSettingTab.ts` — toggle pattern `renderLayout()` (`:49-61`, `addToggle`), free-text pattern node-cap `addText` (`:133-150`); write path `applyInteraction()` (`:202-219`) → `refreshOpenViews()`.
- Toolbar "Graph controls" disclosure: `src/view/GraphToolbar.tsx:31-54` (native `<details>/<summary>` in a React-Flow `<Panel top-left>`). New pill goes here.
- Toggle/pill pattern to copy: `src/view/SizingSection.tsx:46-53` (labelled checkbox); global-write mirror wiring `src/view/LayoutSection.tsx:21-49`.
- CSS (authored): `src/view/graph-view.css` — pill/badge precedent `.vicinity-graph-edge__count-badge` (`:358-367`), toolbar chrome (`:400-461`, `:603-685`). `styles.css` at repo root is generated — never edit.
- Write contract: `src/view/settingsWritePlan.ts:17-89` (`SettingsInteraction`/`SettingsCommand` unions + pure `planSettingsWrite`). Executor `src/view/ControlsActions.ts:37-91`.

## Rebuild propagation (no new wiring needed)
- Toolbar action → `ControlsActions.applySettings()` persists then `controller.handleSettingsChanged()` (`ControlsActions.ts:39`).
- Settings tab → `refreshOpenViews()` (`main.ts:95-102`) → `VicinityGraphView.refresh()` → `controller.handleSettingsChanged()`.
- `GraphViewController.handleSettingsChanged()` (`:150-153`) → `runRebuild()` (`:180-229`) re-runs the whole pipeline. Changing the node-id set auto-triggers relayout via `GraphStructureDiff.decideLayout()` (`:22-46`) — **excludes just work at layout layer**.

## "N excluded" telemetry surfacing
- Precedent: truncation count `VicinityGraph.hiddenNodeCountsByFolder` (`types.ts:213-221`, populated `GraphTruncator.ts:45-48`) → `truncationBadges.ts:33-53` → `FlowSnapshot`/overlay badge `VicinityGraphFlow.tsx:103-112` (text helpers `badgeText.ts`).
- **Idiomatic path for exclusion count next to the pill**: compute `excludedNodeCount` in the engine, thread onto `VicinityGraph`, and/or surface via the toolbar read-model `ControlsModel` (`src/view/ControlsModel.ts:43-92`, built at `VicinityGraphBuilder.ts:66` from same inputs). Rendering it inline next to the pill in `GraphToolbar.tsx` is most idiomatic (distinct from the corner truncation overlay).

## Testing patterns
- Engine: pure `FakeLinkProvider` fixtures — `src/engine/VicinityEngine.test.ts:1-46`, `VicinityTraversal.test.ts`, `settingsResolvers.test.ts`, dense fixtures `testFixtures/denseVaultFixtures.ts`. Purity enforced by `importGuard.test.ts`.
- Adapter/integration: `src/adapters/VicinityGraphBuilder.test.ts` + `FakeObsidianPorts.ts` (end-to-end over fakes — template for "global pattern suppresses nodes end-to-end").
- Persistence: `Fake*` ports, round-trip reload — `PluginDataStore.test.ts`, `DocDataStore.test.ts`.
- View pure logic: plain-function tests (`settingsWritePlan.test.ts`, `ControlsModel.test.ts`, `truncationBadges.test.ts`). No React-render unit tests; pill DOM/click covered by e2e (`e2e/*.e2e.ts`) — release gate, not `npm test`.

## Open design questions for CLARIFICATION
1. **Pill scope**: global-only (vault-wide on/off, simplest, mirrors `edgeRouting`) vs per-doc-overridable enabled flag over a global pattern list ("for that graph" wording). Pattern list is global either way.
2. **Roots**: does exclusion apply to the MAIN/central/pinned root nodes too, or only discovered neighbors?
3. **Regex-lite exact semantics**: precise rule for unanchored `rel/` vs anchored `^rel/`; case sensitivity; whether pattern matches against the full vault-relative path incl. `.md`.
4. **Invalid regex** handling (a user types a broken pattern) — ignore that pattern, or surface an error?
