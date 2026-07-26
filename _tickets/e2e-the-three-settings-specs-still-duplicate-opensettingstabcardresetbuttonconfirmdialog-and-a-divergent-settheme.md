---
id: nid_g4iae40tww9abtwrexdrvic0y_e
title: "e2e: the three settings specs still duplicate openSettingsTab/card/resetButton/confirmDialog and a divergent setTheme"
status: open
deps: []
links: []
created_iso: 2026-07-26T05:23:30Z
status_updated_iso: 2026-07-26T05:23:30Z
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

