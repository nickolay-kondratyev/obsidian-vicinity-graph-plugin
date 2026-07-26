# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration memory)

Review of commit `2abd131` on `dry-e2e-edge-visibility-helper`. Verdict **READY**,
0 BLOCKING / 0 SHOULD-FIX / 2 NITs. Public review written to
`IMPLEMENTATION_REVIEW__PUBLIC.md` in the same dir.

## Commands I ran (all from repo root, logs in `.tmp/`)

| Command | Exit | Note |
|---|---|---|
| `git show 2abd131 --stat` + `git diff main...HEAD -- e2e/ src/` | 0 | 3 files, +28/-21, no `src/` changes |
| `npm run check` | 0 | `.tmp/rev-check.log` |
| `npm test` | 0 | 74 files / 990 tests — `.tmp/rev-test.log` |
| `npm run test:e2e -- edgeRouting.e2e.ts edgeRoutingEval.e2e.ts` | 0 | **7 passed (16.2s)**, real Obsidian — `.tmp/rev-e2e.log` |
| grep `pluginDataStore\|PLUGIN_ID\|setAllEdgesVisibility` in both specs | — | zero matches |
| `ls sanity_check.sh` | 2 | file does not exist in this repo |

## What I checked and concluded

- **evaluate arg passing**: `obsidianHarness.ts:352-359` destructures `{ pluginId, value }`,
  passes `{ pluginId: PLUGIN_ID, value: mode }`. Sketch bug did NOT land.
- **refreshOpenViews omission**: read the pre-refactor helpers in the diff's `-` side; neither
  called it. Omission is behavior-preserving; JSDoc WHY-NOT at `:345-346`.
- **ordering**: routing spec `:84-90` (setEdgeVisibility before `openFile(HUB_PATH)`); eval spec
  `:100-109` (after `ensureCanvasFixtureIsIndexed`, which only writes/indexes `test.canvas` and
  opens no file). Both identical to pre-refactor slot.
- **typing/layering**: `import type { EdgeVisibilityMode } from "../src/engine"` at `:16`, barrel
  export at `src/engine/index.ts:42`. Type-only → erased. `src/engine/importGuard.test.ts` guards
  outbound engine imports only, so nothing bypassed.
- **dead code**: `PLUGIN_ID` import removed from both specs, no other use. Per-suite WHY comments
  retained at call sites (`edgeRouting.e2e.ts:87`, `edgeRoutingEval.e2e.ts:106`).
- **no test/anchor removal**: diff touches no `*.test.ts`, no `ap_XXX_E`.
- **placement**: sibling of `setGlobalNodeCap` / `setMaxNodeSizePx` / `setNodePreviewPreference` /
  `readGlobalView` family — defensible per SRP/OCP; a new module would fragment it.

## NITs raised (non-gating)

1. `obsidianHarness.ts:345-346` — rephrase WHY-NOT as a method PRECONDITION rather than a claim
   about current callers.
2. Deferred work (settings specs' ~14 inline `pluginDataStore` sites;
   `setNodePreviewPreference`'s hand-repeated union) — suggest appending to existing open ticket
   `nid_g4iae40tww9abtwrexdrvic0y_e` instead of a new ticket.

## Open loop for TOP_LEVEL

Ticket `nid_xwfw86nqr8af7eygqod8lh5cp_e` is still **open** — close on merge.
