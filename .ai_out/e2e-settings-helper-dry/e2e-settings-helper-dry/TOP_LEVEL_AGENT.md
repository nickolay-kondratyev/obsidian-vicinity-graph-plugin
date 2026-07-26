# TOP_LEVEL_AGENT — e2e settings helper DRY

Ticket: `nid_g4iae40tww9abtwrexdrvic0y_e`

Branch: `e2e-settings-helper-dry` (off `main`)

## Scope
1. Extract one shared settings-e2e page-object module (openSettingsTab / card / resetButton / confirmDialog) consumed by the three settings specs.
2. Exactly ONE `setTheme` API across the suite (kill the local moonstone/obsidian variant in `settingsResetVerify.e2e.ts`).
3. Migrate ~14 inline `pluginDataStore` `page.evaluate` blocks onto typed `ObsidianHarness` methods.
4. `ObsidianHarness.setNodePreviewPreference` — type-only import `NodePreviewPreference` from `src/engine` barrel instead of the hand-repeated literal union (match `setEdgeVisibility`).

## Constraints (hard)
- `e2e/vaultTarget.test.ts` scans every `.ts` under `e2e/`: mutating `fs.*` destinations must root at a literal `OUT_DIR` / `VAULT_COPY_DIR` / `SANDBOX_CONFIG_DIR` identifier; `node:fs` import line must be exactly `import * as fs from "node:fs";`. => shared module must NOT take screenshot dir as a param for `fs.mkdirSync`; each spec keeps its own `OUT_DIR`.
- All three specs are `mode: "serial"` with cross-test state deps — DO NOT reorder tests.
- Gates: `npm test` and `npm run test:e2e` both green.

## Flow (straightforward-flow)
- [x] EXPLORATION
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] change_log + ticket close + merge to main

## Log
- EXPLORATION agent spawned.
