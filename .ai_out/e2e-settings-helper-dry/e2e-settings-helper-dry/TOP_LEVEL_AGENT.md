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

## Flow (straightforward-flow) — COMPLETE
- [x] EXPLORATION — `EXPLORATION_PUBLIC.md` (`a9c86fd`)
- [x] IMPLEMENTATION_WITH_SELF_PLAN — `967aade`, `457b708`
- [x] IMPLEMENTATION_REVIEW — `d43bfbb`; **VERDICT READY, 0 blocking**
- [x] IMPLEMENTATION_ITERATION (1 round) — `3f325d8`; 1 item incorporated, 4 NITs rejected
- [x] change_log `oixow5osqvi5udypyu613hrra` + ticket closed + merge to `main`

## Outcome
All four acceptance criteria met. Converged in ONE review round.

Gates (run by the implementer, `npm test`/`check` independently re-run by the reviewer):
| Gate | Baseline (clean tree) | After |
|---|---|---|
| `npm run test:e2e` | 79 passed / 1 skipped / exit 0 | 79 passed / 1 skipped / exit 0 |
| `npm test` | — | 990 passed / 74 files |
| `npm run check` | — | exit 0 |

Nothing was pre-failing; no test reordered, renamed, deleted, or weakened.

## Key judgement calls (for future readers)
- **Which `setTheme` survived** — the harness body-class toggle, NOT the real-API
  variant. Verified as not-a-weakening: neither theme-touching test asserts anything
  about the theme, and `e2e/vicinityGraph.e2e.ts` independently proves the lever
  restyles (arrowhead fill vs resolved `var(--text-faint)`). The deleted variant's
  only unique effect was persisting the theme id into the vault appearance config —
  unread, and a real-vault mutation under `VICINITY_E2E_VAULT`.
- **The ticket understated criterion 3.** The harness had no method for any
  `globalDepths`/`nodeExclusion` read-or-write, `forceLayout`, or the preview-preference
  *read*; and `readGlobalView()` was NOT a drop-in for the specs' `readGlobals()`
  (non-overlapping `sizing` shape). Migration required adding harness primitives,
  not just swapping call sites.
- **`seedPreviewPreference` kept its own side effect** (settings-tab `redisplay()`)
  rather than collapsing into `refreshOpenViews()` — different refresh, documented why-not.
