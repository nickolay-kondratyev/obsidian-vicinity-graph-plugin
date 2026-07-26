# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_xwfw86nqr8af7eygqod8lh5cp_e`. Branch `dry-e2e-edge-visibility-helper`,
single commit `2abd131`. Verdict: **READY** — 0 BLOCKING, 0 SHOULD-FIX, 2 NITs.

## Summary

The byte-identical `setAllEdgesVisibility` free function in `e2e/edgeRouting.e2e.ts` and
`e2e/edgeRoutingEval.e2e.ts` was replaced by `ObsidianHarness.setEdgeVisibility(mode)`
(`e2e/obsidianHarness.ts:351`). What was actually DRY'd is the *knowledge* of the persisted
store shape (`app.plugins.plugins[id].pluginDataStore` → `saveGlobalView({...globalView(), …})`),
which is the right unit of duplication to attack. Diff is 28 insertions / 21 deletions across
exactly the three expected files. No `src/` production code touched. No scope creep in either
direction.

## Verification I ran MYSELF (not taken on trust)

| Gate | Result |
|---|---|
| `npm run check` | exit 0 (`.tmp/rev-check.log`) |
| `npm test` | exit 0 — 74 files / 990 tests passed (`.tmp/rev-test.log`) |
| `npm run test:e2e -- edgeRouting.e2e.ts edgeRoutingEval.e2e.ts` | exit 0 — **7 passed (16.2s)**, real Obsidian (`.tmp/rev-e2e.log`) |
| `grep pluginDataStore\|PLUGIN_ID\|setAllEdgesVisibility` in the two specs | zero matches |

No `sanity_check.sh` exists in this repo. All four acceptance criteria are met.

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

None. Specifically checked and found **correct**:

1. **`page.evaluate` argument passing** — the sketch's destructuring bug did NOT land.
   `e2e/obsidianHarness.ts:352-359` destructures `{ pluginId, value }` and passes
   `{ pluginId: PLUGIN_ID, value: mode }`. Names match; `tsc` would have caught it anyway
   (`noUncheckedIndexedAccess`/strict is on and `check:e2e` is green).

2. **`refreshOpenViews()` omission is genuinely behavior-preserving.** I re-read the deleted
   helpers in the `main` version of both specs: neither called it. Adding it would have been the
   silent behavior change; omitting it is correct for a pure refactor, and the WHY-NOT JSDoc at
   `obsidianHarness.ts:345-346` records the precondition.

3. **Timing/ordering unchanged.**
   - `edgeRouting.e2e.ts:84-90`: `launch → openGraphView → setEdgeVisibility → openFile(HUB_PATH)`
     — same slot the old call occupied, still before any file open.
   - `edgeRoutingEval.e2e.ts:100-109`: `launch → openGraphView → ensureCanvasFixtureIsIndexed →
     setEdgeVisibility → mkdir`. `ensureCanvasFixtureIsIndexed` only writes/indexes `test.canvas`;
     it opens no file and renders no graph, so the JSDoc's "callers set this BEFORE opening the
     central file" claim holds for both call sites. Central files are opened per-test later.

4. **Typing + layering.** `import type { EdgeVisibilityMode } from "../src/engine"`
   (`obsidianHarness.ts:16`) hits the pure barrel (exported at `src/engine/index.ts:42`), not a
   deep path, and is type-only so nothing loads in the node-side Playwright process — the inline
   comment on line 15 records exactly that WHY. This is strictly better than the sibling
   `setNodePreviewPreference`, which hand-repeats its union. `src/engine/importGuard.test.ts`
   constrains what engine imports, not who imports engine, so no guard is bypassed.

5. **No dead code / stale comments.** `PLUGIN_ID` import dropped from both specs (verified it has
   no other use in either). The old helper's rationale was not lost: it survives as a one-line
   WHY at each call site (`edgeRouting.e2e.ts:87`, `edgeRoutingEval.e2e.ts:106`), which is the
   right split — the store shape is shared, the per-suite reason is not.

6. **Placement is defensible.** The method sits between `setMaxNodeSizePx` and
   `setNodePreviewPreference`, inside an existing cohesive family of global-view writers. A new
   `e2e/pluginSettings.ts` would have fragmented that family for no isolation gain; the separate
   e2e modules that do exist (`settingsBaseline.ts`, `vaultTarget.ts`) earn their files by staying
   free of the `app` global, which this helper cannot. SRP/OCP respected — additive, no existing
   seam edited.

7. **No behavior-capturing tests or `ap_XXX_E` anchors removed.** Only two private free functions
   deleted, both fully superseded. `git diff main...HEAD` touches no `*.test.ts`.

## 💡 NITs (optional, do not gate)

- **NIT** `e2e/obsidianHarness.ts:345-346` — the WHY-NOT is phrased as a statement about today's
  callers ("callers set this BEFORE opening the central file"). It would age better phrased as a
  precondition of the method ("PRECONDITION: call before the view renders; there is no fan-out, so
  a later call needs an explicit rebuild"). Same information, but it stays true when a third caller
  appears. Cosmetic.
- **NIT** The implementer correctly declined to migrate `settingsResetReview/Verify/UxVisual.e2e.ts`
  (~14 more inline `pluginDataStore` sites, using the sloppier `(window as any).app`) and declined
  to fix `setNodePreviewPreference`'s hand-repeated union. Both are the right calls for scope. An
  open ticket already covers the neighbouring duplication —
  `nid_g4iae40tww9abtwrexdrvic0y_e` ("e2e: the three settings specs still duplicate
  openSettingsTab/card/resetButton/confirmDialog…"). Suggest TOP_LEVEL append these two items to
  that ticket rather than opening a new one.

## Documentation Updates Needed

None. This is below the altitude of `CLAUDE.md` / `architecture-map.md` (no new module, no layering
change). Ticket `nid_xwfw86nqr8af7eygqod8lh5cp_e` is still **open** — close it on merge.
