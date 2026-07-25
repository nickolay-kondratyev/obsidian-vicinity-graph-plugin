# EXPLORATION_PUBLIC — node-content-preference

Index of exploration artifacts for the outline-vs-image preference pill.
**Read both companion docs before planning/reviewing.**

| Doc | Covers |
|---|---|
| [`EXPLORATION__CONTENT_RULES__PUBLIC.md`](./EXPLORATION__CONTENT_RULES__PUBLIC.md) | Where the outline-vs-image decision lives today, the "fits" logic, engine→view content flow, behavior-capturing tests, plan/README quotes |
| [`EXPLORATION__SETTINGS_CONTROLS__PUBLIC.md`](./EXPLORATION__SETTINGS_CONTROLS__PUBLIC.md) | Settings spec/defaults/persistence/resolver, shared write plan, settings-tab + controls-panel mechanics, restore-defaults registration points, enumeration-test traps, tickets |

## The five facts that shape this feature

1. **The current rule DELETES data, it does not deprioritize it.**
   `ObsidianLinkProvider.outlineOf()` (`src/adapters/ObsidianLinkProvider.ts:145-166`)
   returns `[]` when `referencesImageAbove()` says an image precedes the first heading
   ("the image wins", `:162`). The heading text/levels are never materialized
   downstream. ⇒ A user preference cannot merely *gate* the rule; the adapter must
   always extract the outline and the precedence decision must MOVE downstream
   (view layer, pure + unit-testable). This is the core architecture change.

2. **`firstImagePath` is already unconditional.** Derived from `metadata.attachments`
   independent of the outline rule (`VicinityTraversal.ts:157,168`; pinned by
   `flowMapping.test.ts:509-520`). ⇒ The *image* side of the pill already has the data
   it needs at the view layer; only the *outline* side is currently starved.

3. **"Fits" is NOT computed in JS — it is a static 104px CSS container-query gate**
   (`src/view/graph-view.css:237-256`); outline overflow scrolls
   (`node-outline.css:17-30`). ⇒ "when present and fits" should reuse that existing
   threshold as its definition of "fits"; nothing measures rendered outline height,
   and inventing such a measurement would be new complexity for little value.

4. **No pill/segmented control exists anywhere in the repo.** The only 2-value enum
   (`edgeVisibility`) has zero UI. The repo's mirroring contract (force-layout) is:
   **share bounds + copy modules and the `planSettingsWrite` command; duplicate the
   markup** (tab uses Obsidian's native `Setting` API, panel hand-rolls JSX reusing
   Obsidian CSS classes — cf. `ToggleSwitch.tsx` for native theming with zero new CSS).
   ⚠ "Pill" already means the node-exclusion count **chip** in this codebase.

5. **No relayout is needed.** `GraphStructureDiff.decideLayout()` is insensitive to
   node content; a preference flip is a data-only refresh, exactly like
   `outlineMaxDepth`. ⚠ Unless the implementation makes `sizePx` depend on the
   preference — that would force a relayout on every toggle. Avoid.

## Traps that will bite the implementation

- **Enumeration tests with no shared constant**: `.vicinity-graph-settings-section`
  `toHaveCount(6)` is hardcoded in **three** e2e files, two of which also assert exact
  ordered reset-button name lists.
- **`SettingsSpec.test.ts:28-79` already omits `outlineMaxDepth`** from its
  "exact shipped baseline" `toEqual` — a live gap; do not copy that mistake.
- **`TUNED_VIEW` in `settingsResetPlan.test.ts`** must get a non-default value for any
  new field or restore-defaults assertions pass vacuously.
- **Four+ registration points for restore-defaults** (`settingsResetPlan.ts` scope union,
  `SETTINGS_RESET_SCOPES`, `SECTION_RESET_SCOPES`, `ALL_SCOPE_DESCRIPTION`) — the
  last is now test-enforced.
- **Known-RED pre-existing failure**: `linkStrengthFactor.max` in `SettingsSpec.test.ts`
  (author-only per its ticket). Do not attribute to this work; do not fix in passing.
- **Docs assert the opposite of this feature today** and must be reconciled explicitly,
  not silently contradicted: `docs-internal/plan/high-level-plan.md:93`,
  `README.md:59-66,137-146`, `SettingsSpec.ts:118-124`,
  `VicinityGraphSettingTab.ts:313-319` ("No enable/disable toggle by design
  (CLARIFICATION Q2)").
- **No React component tests** exist for `NoteNode.tsx` / `NodeOutline.tsx` ⇒ keep the
  new precedence logic in a pure function (extend `nodePreviewChoice.ts`) so it is
  unit-testable per repo convention.
