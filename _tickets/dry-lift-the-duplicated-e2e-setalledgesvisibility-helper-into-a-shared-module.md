---
id: nid_xwfw86nqr8af7eygqod8lh5cp_e
title: "DRY: lift the duplicated e2e setAllEdgesVisibility helper into a shared module"
status: open
deps: []
links: []
created_iso: 2026-07-26T06:25:29Z
status_updated_iso: 2026-07-26T06:25:29Z
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

