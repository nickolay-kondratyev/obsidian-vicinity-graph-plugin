---
closed_iso: 2026-07-26T16:35:41Z
id: nid_xwfw86nqr8af7eygqod8lh5cp_e
title: "DRY: lift the duplicated e2e setAllEdgesVisibility helper into a shared module"
status: closed
deps: []
links: []
created_iso: 2026-07-26T06:25:29Z
status_updated_iso: 2026-07-26T16:35:41Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

`setAllEdgesVisibility` is copy-pasted in two specs:
- `e2e/edgeRoutingEval.e2e.ts` (`setAllEdgesVisibility`)
- `e2e/edgeRouting.e2e.ts`

Both `page.evaluate` into `app.plugins.plugins[PLUGIN_ID].pluginDataStore` and save `edgeVisibility: "all-edges"`. That is duplicated KNOWLEDGE of the plugin data-store shape: if the persisted global-view schema changes, both copies must change together.

Pre-existing (NOT introduced by the `sparse-eval-edge-flake` work; noted by the reviewer of that branch as a NIT explicitly out of that chore's scope).

## Acceptance Criteria

One shared e2e helper (e.g. an exported function in `e2e/obsidianHarness.ts` or a small `e2e/pluginSettings.ts`) used by both specs; no `pluginDataStore` literal remains in either spec; `npm run check` green and `npm run test:e2e -- edgeRouting.e2e.ts edgeRoutingEval.e2e.ts` still passes.


## Notes

**2026-07-26T16:35:41Z**

RESOLVED on branch dry-e2e-edge-visibility-helper (merged to main).

`ObsidianHarness.setEdgeVisibility(mode: EdgeVisibilityMode)` in `e2e/obsidianHarness.ts` now owns the data-store shape; the two copy-pasted `setAllEdgesVisibility` free functions and their now-unused `PLUGIN_ID` imports are gone from `e2e/edgeRouting.e2e.ts` and `e2e/edgeRoutingEval.e2e.ts`. Typed against `EdgeVisibilityMode` (type-only import from the `src/engine` barrel) rather than a bare string literal. Placement chosen as a sibling of the existing `setGlobalNodeCap` / `setMaxNodeSizePx` / `setNodePreviewPreference` family rather than a new `e2e/pluginSettings.ts`, which would have fragmented one cohesive concern.

Behavior identical — no assertions, ordering, or timing changed; deliberately does NOT call `refreshOpenViews()`, matching the old helpers (documented as a precondition in its JSDoc).

Gates (run independently by both the implementer and the reviewer): `npm run check` green; `npm test` 990/990; `npm run test:e2e -- edgeRouting.e2e.ts edgeRoutingEval.e2e.ts` 7/7 against a real Obsidian. No `pluginDataStore` literal remains in either spec.

Deferred (out of scope, folded into nid_g4iae40tww9abtwrexdrvic0y_e): the ~14 remaining inline `pluginDataStore` sites in the three settings specs, and `setNodePreviewPreference`'s hand-repeated union.
