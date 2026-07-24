# EXPLORATION — Settings system, note-opening, docs & test infrastructure

> Produced by EXPLORE sub-agent (read-only). Paths repo-relative.

## 1. `SETTINGS_SPEC` centralization

Single source of truth: `src/engine/SettingsSpec.ts:105-222` (`SETTINGS_SPEC`), typed by `SettingsSpec` (80-84), nested to mirror persisted shapes: `globalDepths` / `globalView` (→ `sizing`, `forceLayout`) / `nodeExclusion`.

Leaf shapes (`SettingsSpec.ts:31-47`):
- `BoundedNumberSpec { default, min, max, step }` — sliders.
- `MinBoundedNumberSpec { default, min }` — e.g. `nodeCap`.
- `DefaultSpec<T> { default }` — booleans/enums (e.g. `groupByFolder: { default: true }`).

Thin adapters (no duplicated literals):
- `src/engine/SettingsDefaults.ts` — discoverability shim re-exporting `SETTINGS_SPEC`.
- `src/engine/constants.ts:17-43` — named constants, one-liners off the spec.
- `constants.ts:76-98` — `FORCE_LAYOUT_RANGES` + `clampForceLayoutSettings()`, shared by sliders and persistence parser.
- `constants.ts:105-156` — `EngineDefaults`: `depthSettings()`, `sizingSettings()` (114-127, defensive `{ ...metric.default }` copy from commit `e18545d`), `nodeExclusionSettings()`, `forceLayoutSettings()`, `viewSettings()`.

**Adding a new setting end-to-end** (pattern of `groupByFolder`):
1. Shape/default → `SETTINGS_SPEC` (`SettingsSpec.ts`, `ViewSpec` at 67-73).
2. Field → engine type `ViewSettings` (`src/engine/types.ts:226-233`); `ViewSettingsOverride = Partial<ViewSettings>` (240) follows automatically.
3. `EngineDefaults.viewSettings()` (`constants.ts:146-155`) reads `.default`.
4. Persistence parse branch in `parseViewOverride()` (`src/persistence/persistedShapes.ts:132-150`); boolean idiom at 139-142. Structured settings get a `parseX()` mirroring `parseForceLayout()` (184-197).
5. Resolver cascade: add field to `ViewSettingsResolver.resolve()` (`src/engine/ViewSettingsResolver.ts:46-52`; generic `field()` closure at 33-45 — MAIN override → pinned overrides via `NodePriorityChain` → global).
6. Write plan: `SettingsInteraction` union (`src/view/settingsWritePlan.ts:25-44`), `SettingsCommand` union (47-62), `case` in `planSettingsWrite()` (71-100).
7. Settings tab UI: `new Setting(section).addToggle(...)` in `src/view/VicinityGraphSettingTab.ts` (idiom at 130-139 / 193-203), calling `this.applyInteraction({...})` (339-360) → plan → `PluginDataStore` → `plugin.refreshOpenViews()`.
8. Consumption: resolved `ViewSettings` threaded to `FlowNodeData` / `GraphViewController`.

Global-only alternative (no per-doc override): follow `nodeExclusion` — own top-level spec (`SettingsSpec.ts:75-78, 217-221`), own command kind (`settingsWritePlan.ts:61-62`), own store method `saveNodeExclusion`.

**Sizing adapter**: `EngineDefaults.sizingSettings()` (`constants.ts:114-127`) builds `SizingSettings.metrics` via `Object.fromEntries(...)`, spreading each metric leaf ("never hand out the spec's own leaf object", 117-119). `SizingSpec` at `SettingsSpec.ts:58-63`; `SizingSettings` at `types.ts:186-192`.

## 2. Settings tab UI patterns (`src/view/VicinityGraphSettingTab.ts`)

- `PluginSettingTab`; `display()` (58) clears container, adds scope class `vicinity-graph-settings` (styled by `src/view/settings-tab.css`), then `renderDepthDefaults` / `renderSizing` / `renderForceLayout` / `renderExclusion` / `renderPerformance` (64-68).
- **Grouping**: `createSection()` (75-77) → framed `div.vicinity-graph-settings-section` per section ("CSS-only visual grouping, no collapsibles", 72-74); each begins with `.setHeading()`.
- **Toggles**: `.addToggle(t => t.setValue(x).onChange(async v => …))` (130-139, 193-203). Toggles that change visible controls call `this.display()` again (137, 202, 108).
- **Sliders**: `.addSlider(s => s.setLimits(min,max,step).setValue(cur).setDynamicTooltip().onChange(…))` (255-278, 308-323); ranges always from engine (`FORCE_LAYOUT_RANGES`, `MIN/MAX_STEPPER_DEPTH`).
- **Progressive disclosure**: native `<details>/<summary>` "Advanced spacing" (96-100) — Setting API has no collapsible group.
- **Numeric inputs**: `.addText(...)` with `inputEl.type = "number"` (280-300, 238-252).
- **Restore defaults**: `.addButton(...)` → `applyX(EngineDefaults.xSettings())` + `this.display()` (101-110).
- **Single write path**: `applyInteraction()` (339-360) is the only place that plans/persists/refreshes.
- An `obsidian-settings` **skill** exists in this environment for the UI design pass.

## 3. Note-opening path + heading-positioned opening

**Current chain**:
- `src/view/VicinityGraphFlow.tsx:43-48` — `onNodeClick` → `controller.openNode(node.id, { newTab: event.ctrlKey || event.metaKey })`; wired at 67.
- `src/view/GraphViewController.ts:171-178` — `openNode(path, options)` guards folder-group ids then `navigator.openNote(...)`.
- `src/view/viewPorts.ts:56-67` — `OpenNoteOptions { readonly newTab: boolean }`, `NoteNavigatorPort { activeFilePath(); openNote(path, options?) }`.
- `src/view/ObsidianNoteNavigator.ts:11-25`:
  ```ts
  const file = this.app.vault.getFileByPath(path);
  if (file === null) return;
  void this.app.workspace.getLeaf(options?.newTab === true).openFile(file);
  ```
  No heading/eState today — opens at top of note.

**Options to open at a heading** (not yet used in repo):
- `workspace.openLinkText("Note#Heading", sourcePath, newLeaf?, openViewState?)` — Obsidian resolves heading internally; needs source path + linktext string.
- Stay with current shape: `getLeaf(newTab).openFile(file, { eState: { line: headingLine } })` — `MarkdownView` reads `eState.line` and scrolls/sets cursor. Fits existing call shape better.
- Both need heading line number or exact heading text — neither computed anywhere today.
- Clean threading: extend `OpenNoteOptions` (`viewPorts.ts:57-60`) with optional heading target (additive, non-breaking), implement in `ObsidianNoteNavigator.openNote()`.

**No existing heading/outline code** repo-wide. Source seam: `MetadataCachePort` (`src/adapters/obsidianPorts.ts:54-60`) → `CachedMetadataPort` (45-52) needs `headings?: readonly HeadingCachePort[]` (`{ heading, level, position: { start: { line }, end: { line } } }`) to keep `src/engine/` obsidian-free.

## 4. Docs to update + CLI tooling

- **`docs-internal/architecture-map.md`** (62 lines; Layering / Key seams / Layout stack / Build note): "Key seams" (36-42) if `MetadataCachePort` gains `headings`; `src/view/` bullet (28-32) if a navigation port changes.
- **`docs-internal/plan/high-level-plan.md`**: "Rendering and interaction" (90-98) and "Sizing" (54-62) are the homes for an outline-rendering decision; "Deferred to V2+" (131-140) should be checked.
- **`README.md`** (230 lines): "Settings model" (54-122), esp. "Global defaults" (59-71) for a new toggle bullet; navigation description if click-to-heading changes behavior; "V1 scope / limits" (124-131) and "V2 roadmap" (133-140).
- **`docs-internal/CHANGELOG.md`** (442 lines): newest-first `## YYYY-MM-DD — <title> (ticket N)` entries with mechanism + defaults + no-behavior-change bullets.
- **CLIs confirmed working**: `change_log` (entries in `./_change_log/`; `create --impact N`, `ls`, `show`, `query`; query before starting, TOP_LEVEL_AGENT writes one entry after completion) and `ticket` (`./_tickets/`; `create -d -t -p`, `start/close/status`, `dep`, `ls/ready/blocked`).
  ⚠ Two ticket conventions coexist: `ticket` CLI (`_tickets/`) vs legacy `docs-internal/tickets/*.md` (commit messages say "(ticket 04)"). Needs a human decision for new tickets.

## 5. Test infrastructure

- **Vitest** (`vitest.config.ts`): `include: ["src/**/*.test.{ts,tsx}"]`; `npm test` = `vitest run`. Comment references `npm run test:sublib`, which does not exist in `package.json` — possibly stale.
- **No RTL / jsdom component tests**: zero `.test.tsx` files repo-wide; no `@testing-library/*` dependency. All `src/view/*.test.ts` files test pure logic extracted into plain `.ts` modules (`flowMapping.test.ts`, `nodePinAction.test.ts`, `badgeText.test.ts`, `settingsWritePlan.test.ts`, `GraphViewController.test.ts`). **Implication**: new interactive UI logic (which heading/line a click targets, whether outline is shown) must be extracted into pure colocated modules following the `nodePinAction.ts` + `.test.ts` pattern; DOM wiring covered by e2e only.
- **Playwright e2e** (`e2e/playwright.config.ts`): `testMatch **/*.e2e.ts`, one real Obsidian Electron on a throwaway `.dev-vault` copy (`obsidianHarness.ts`), `workers: 1`, serial, 120s timeout. `npm run test:e2e` (needs `OBSIDIAN_PATH`). **Release gate, not part of `npm test`.**
- Existing note-open e2e: `e2e/vicinityGraph.e2e.ts:195-238` — "clicking a node opens that note in the current tab" (209), ctrl/cmd-click new tab (218). Known flakiness documented in `docs-internal/tickets/ticket-e2e-node-click-flaky-headless.md`.
- Other e2e patterns: `controlsRestart.e2e.ts`, `edgeRouting.e2e.ts`, `pinnedCentralScenario.e2e.ts`, `settingsUxVisual.e2e.ts` (screenshot-based visual verification — closest analog for verifying outline-in-node visuals).
