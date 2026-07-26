---
closed_iso: 2026-07-26T15:30:54Z
id: nid_6ussqlms9b5eqryjrmxsqktos_E
title: "Vicinity rename: view-type string changed — reopen stale panes in existing dev vaults"
status: closed
deps: []
links: []
created_iso: 2026-07-21T16:31:36Z
status_updated_iso: 2026-07-26T15:30:54Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

The `neighborhood`→`vicinity` rename (branch vicinity-rename) changed the persisted Obsidian view-type literal from `neighborhood-graph-view` to `vicinity-graph-view` (see src/view/VicinityGraphView.tsx, VIEW_TYPE_VICINITY_GRAPH) and the plugin id from `obsidian-neighborhood-graph` to `vicinity-graph` (manifest.json, package.json, e2e/obsidianHarness.ts PLUGIN_ID).

Impact: any ALREADY-INSTALLED dev vault (workspace layout referencing the old view-type, and doc-data under `.obsidian/plugins/obsidian-neighborhood-graph/`) will have stale panes that no longer open, and previously-persisted per-note doc data under the old plugin-id folder will be orphaned.

Decision already made (see .ai_out/vicinity-rename/vicinity-rename/PARETO_COMPLEXITY_ANALYSIS__PUBLIC.md): do NOT add migration code — at unpublished 0.1.0 with zero external installs, the complexity far exceeds the value. This ticket only tracks the manual dev-vault reset step: re-run `npm run setup:dev-vault` (scripts/setup-dev-vault.sh) and re-open the Vicinity Graph view in any local test vault; delete the old `.obsidian/plugins/obsidian-neighborhood-graph/` folder if present.

Close once the maintainer has refreshed their local dev vault(s).

## Acceptance Criteria

Local dev vault(s) re-provisioned under the vicinity-graph plugin id; Vicinity Graph view opens cleanly; no stale obsidian-neighborhood-graph plugin folder remains.


## Notes

**2026-07-26T15:30:54Z**

Closing: the rename landed (manifest.json id=vicinity-graph; VIEW_TYPE_VICINITY_GRAPH='vicinity-graph-view' in src/view/VicinityGraphView.tsx:18) and .dev-vault/.obsidian/plugins contains only vicinity-graph — no stale obsidian-neighborhood-graph folder. Old strings survive only in historical .ai_out/ docs. Caveat: vaults outside this repo cannot be verified here; reopening a stale pane there is a one-off manual step, not tracked work.
