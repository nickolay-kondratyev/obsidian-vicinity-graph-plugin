---
closed_iso: 2026-07-26T17:23:40Z
id: nid_g4iae40tww9abtwrexdrvic0y_e
title: "e2e: the three settings specs still duplicate openSettingsTab/card/resetButton/confirmDialog and a divergent setTheme"
status: closed
deps: []
links: []
created_iso: 2026-07-26T05:23:30Z
status_updated_iso: 2026-07-26T17:23:40Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

Follow-up spotted while closing nid_3399ajdcy5lq21lx5v0jxh9i4_e (settings e2e baseline DRY), deliberately left OUT of that ticket's scope.

The expected section/reset NAMES are now shared via `e2e/settingsBaseline.ts`, but the HELPERS around them are still copy-pasted across:
- `e2e/settingsResetReview.e2e.ts`
- `e2e/settingsResetVerify.e2e.ts`
- `e2e/settingsUxVisual.e2e.ts`

Duplicated in 2-3 places each: `openSettingsTab()`, `card(headingText)`, `resetButton(headingText)`, `confirmDialog()`, `readGlobals()`.

Also divergent, not just duplicated: `e2e/settingsResetVerify.e2e.ts` has a LOCAL `setTheme("moonstone"|"obsidian")` (raw Obsidian theme ids) while the other two call `harness.setTheme("light"|"dark")` (`e2e/obsidianHarness.ts`). Two APIs for one job.

Constraint for whoever picks this up: `e2e/vaultTarget.test.ts` scans EVERY `.ts` under `e2e/` and requires mutating `fs.*` destinations to root at a literal `OUT_DIR` / `VAULT_COPY_DIR` / `SANDBOX_CONFIG_DIR` identifier, and any `node:fs` import line to be exactly `import * as fs from "node:fs";`. So a shared helper module must NOT take the screenshot dir as a parameter for `fs.mkdirSync` — each spec keeps its own `OUT_DIR` const.

Also: all three specs are `test.describe.configure({ mode: "serial" })` and later tests depend on state left by earlier ones — do not reorder while extracting.

## Acceptance Criteria

One shared settings-e2e page-object/helper module (alongside `e2e/settingsBaseline.ts`) provides openSettingsTab / card / resetButton / confirmDialog; the three specs consume it. Exactly ONE setTheme API across the suite. `npm test` and `npm run test:e2e` both green, with no test reordered.


## Notes

**2026-07-26T16:35:41Z**

Scope addition (folded in while closing nid_xwfw86nqr8af7eygqod8lh5cp_e, the edge-visibility DRY chore):

Those same three specs also inline the plugin data-store shape ~14 times as `(window as any).app.plugins.plugins[PLUGIN_ID].pluginDataStore` inside `page.evaluate`, duplicating knowledge of the persisted global-view schema. `e2e/obsidianHarness.ts` now owns that shape behind typed methods (`setGlobalNodeCap`, `setMaxNodeSizePx`, `setNodePreviewPreference`, `readGlobalView`, and the new `setEdgeVisibility`) — migrate the three specs onto those instead of adding a fourth idiom.

Also noted, same file: `ObsidianHarness.setNodePreviewPreference` hand-repeats its literal union ("auto" | "outline" | "image") instead of importing `NodePreviewPreference` from the `src/engine` barrel. `setEdgeVisibility` establishes the better pattern (type-only import of `EdgeVisibilityMode`); align it while in here.

**2026-07-26T17:23:40Z**

RESOLVED.

All four acceptance criteria met on branch `e2e-settings-helper-dry` (commits 967aade, 3f325d8).

1. New `e2e/settingsTabPage.ts` page object (open/close/redisplay/card/resetButton/resetAllRow/resetAllButton/confirmDialog/dialogButton/openModals), consumed by all three settings specs. Imports no `fs`, so `e2e/vaultTarget.test.ts` has nothing to object to; each spec keeps its own literal OUT_DIR as the ticket required.
2. Exactly one setTheme: the harness body-class toggle. `settingsResetVerify`'s local `setTheme("moonstone"|"obsidian")` and its `waitForTimeout(200)` are deleted. WHY that one won: neither theme-touching test asserts anything about the theme (footer copy + screenshots only), the lever is independently proven to restyle by `e2e/vicinityGraph.e2e.ts` asserting arrowhead fill against the resolved `var(--text-faint)`, and the deleted variant's only unique effect was persisting the theme id into the vault appearance config — a real-vault mutation under VICINITY_E2E_VAULT that nothing reads.
3. All 14 inline `pluginDataStore` evaluate blocks migrated onto typed ObsidianHarness methods (readGlobals/saveGlobalView/saveGlobalDepths/saveNodeExclusion/refreshOpenViews/reloadPlugin); the pre-existing typed setters now compose them. `pluginDataStore` appears in `e2e/obsidianHarness.ts` ONLY.
4. `setNodePreviewPreference` now takes a type-only `NodePreviewPreference` from the `../src/engine` barrel, alongside ViewSettings/DepthSettings/NodeExclusionSettings — matching the EdgeVisibilityMode precedent.

Gates: `npm run test:e2e` 79 passed / 1 skipped / exit 0 BOTH on the pre-change baseline and after (nothing was pre-failing); `npm test` 990 passed; `npm run check` clean. No test reordered, renamed, deleted or weakened — titles and order byte-identical per spec. The serial-mode state chains flagged in this ticket were preserved deliberately: `settingsUxVisual`'s row-name test still re-enables exclusion itself, and the Preview-pill pair still consumes the "image" write left by its predecessor.

Independently reviewed: VERDICT READY, 0 blocking.
