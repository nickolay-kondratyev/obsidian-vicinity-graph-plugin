# PHASE 1 — per-doc removal (global-only settings) — PRIVATE state

STATUS: **COMPLETE**. `npm test` 1085/1085, `npm run check` clean, `npm run build` ok.
Authoritative outcome + PHASE 2 pointers: `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` (same dir).

## Commits (branch CC_nid_ez38gf1mrdgh5kxedzrdicwzl_e__settings-simplification-remove-per-doc-saved-state_opus)
- `2ee62a0` engine, `347dc77` persistence, `af8cc11` view/adapters (+ minimal e2e), `2a49713` comment scrub.
Base was `4edddb6`.

## Where things ended up (for a future clone)
- Depth UI: `src/view/GlobalDepthControls.tsx` → `planSettingsWrite({kind:"global-depth"})`.
  CSS hook is `.vicinity-graph-depth-controls` (was `.vicinity-graph-central[data-kind=…]`).
- `ControlsModel` = global slices + `mainPinned` + `excludedNodeCount`. `mainPinned` is still the only
  carrier of "MAIN is itself pinned" (assembler skips main-as-pin) and feeds `flowMapping`.
- Every settings write is global ⇒ `ControlsActions.applySettings` always calls
  `viewsRefresh.refreshAllViews()`. `OwningViewPort` is gone; `GraphViewController.handleSettingsChanged`
  survives because `VicinityGraphView.refresh()` (the fan-out target) calls it.
- Parse layer: `parseDepthFields` / `parseViewFields` in `persistedShapes.ts`, both returning
  `Partial<…>` merged over `PersistedShapes.defaultPluginData()`. `ParsedViewFields` mapped type is
  still THE completeness guard for view fields.
- `PERSISTED_SHAPE_VERSION` was NOT bumped: doc-data files are simply orphaned on disk and `data.json`
  keeps its shape (no removed keys inside it), so a bump would have needlessly discarded globals.

## Things a reviewer may push on (with the reasoning already made)
1. Deleting the two resolvers / `resolvePinnedDescriptors.ts` / `settingsWriteScope.ts` goes a step
   past the ticket's "collapse to constant" wording — all three would have been identity/one-value
   indirections. See PUBLIC.md §Decisions 1–3.
2. `DocPersistEligibility`'s filename rule now has a softer justification (documented in the file).
   If the owner wants pins for foreign unsafe docids, that is a NEW ticket.
3. `settingsSectionFields.test.ts` lost its `default:` throw arm — the switch over `SettingsCommand`
   is now exhaustive, so the arm's `command` was `never`.

## Not done here (PHASE 2)
Docs/README/plan/architecture-map/release-note/tickets, and the e2e rewrite adding a global-depth
spec + deleting `PINNED_CENTRALS_SUMMARY*` from `e2e/settingsBaseline.ts` and its use in
`e2e/settingsUxVisual.e2e.ts`. Exact line pointers are listed in PUBLIC.md.
