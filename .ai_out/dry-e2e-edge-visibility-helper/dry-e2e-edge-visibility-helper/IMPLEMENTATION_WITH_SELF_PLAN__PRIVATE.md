# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration memory)

Ticket: `nid_xwfw86nqr8af7eygqod8lh5cp_e` — DRY the duplicated e2e `setAllEdgesVisibility`.
Branch: `dry-e2e-edge-visibility-helper`. Commits: `2abd131` (implementation) + one
doc-only iteration commit. **STATUS: DONE, reviewed READY, NIT incorporated, tree clean.**
Nothing outstanding.

## IMPLEMENTATION_ITERATION round (after review)

Review came back READY / 0 BLOCKING / 0 SHOULD-FIX / 2 NITs. Only NIT 1 was mine.

- **NIT 1 INCORPORATED** — reworded the `setEdgeVisibility` JSDoc so the WHY-NOT is framed as
  a PRECONDITION ("call BEFORE the graph view renders the central file … a caller that sets it
  against an already-rendered view must trigger an explicit rebuild itself"). Agreed with the
  reviewer: the old phrasing asserted something about the two current callers, so it would rot
  the moment a third appeared. Doc-only; no executable token changed.
- **NIT 2 NOT MINE** — ticket bookkeeping (fold the deferred settings-spec duplication into
  `nid_g4iae40tww9abtwrexdrvic0y_e`) belongs to TOP_LEVEL_AGENT. Touched no ticket files.
- Gate: `npm run check` exit 0 (`.tmp/iter-check.log`). **Did NOT re-run `test:e2e`** — a JSDoc
  body edit cannot change its outcome. Said so explicitly in the PUBLIC docs rather than
  implying coverage I did not produce.

## Plan (executed as written, no deviations)

1. Verify the exploration's claims against the real files (line numbers were unverified).
2. Add `ObsidianHarness.setEdgeVisibility(mode: EdgeVisibilityMode)` to `e2e/obsidianHarness.ts`.
3. Delete both local `setAllEdgesVisibility` free functions; call the harness method instead.
4. Drop the now-unused `PLUGIN_ID` import from both specs.
5. Gates: `npm run check`, `npm test`, real `npm run test:e2e`, sanity grep.

## Verified facts (re-read, not trusted from exploration)

- Duplicated helper was **byte-for-byte identical** in both specs — confirmed. It was at
  `e2e/edgeRouting.e2e.ts` ~107-115 (with a JSDoc line) and `e2e/edgeRoutingEval.e2e.ts`
  ~164-171 (no JSDoc). Each called once from `beforeAll`.
- `PLUGIN_ID` had **exactly one** other occurrence per spec — the import line itself. So both
  imports were safely narrowed to `import { ObsidianHarness } from "./obsidianHarness";`.
- `EdgeVisibilityMode = "walked-from-center" | "all-edges"` at `src/engine/types.ts:155`,
  re-exported type-only from `src/engine/index.ts:42`. `import type` from `../src/engine`
  compiles clean under `e2e/tsconfig.json`.
- The exploration's sketch bug (destructure `value`, pass `mode`) was real — avoided by
  passing `{ pluginId: PLUGIN_ID, value: mode }` and destructuring `{ pluginId, value }`,
  matching `setNodePreviewPreference`'s existing shape exactly.
- Harness sibling family confirmed at `e2e/obsidianHarness.ts`: `setGlobalNodeCap` (~313),
  `setMaxNodeSizePx` (~330), `setNodePreviewPreference` (~371 post-edit), `readGlobalView`.

## Deliberate decisions

- **No `refreshOpenViews()`** in the new method, unlike `setNodePreviewPreference`. The old
  duplicated helper did not call it, and behavior must be identical. Documented as a WHY-NOT
  in the JSDoc: both call sites set visibility BEFORE opening the central file, so the next
  rebuild picks it up.
- **`import type`, not a value import**, with an inline WHY comment. `obsidianHarness.ts`
  already carries a WHY-NOT about not importing `src/view/VicinityGraphView.tsx` because it
  would drag the `obsidian` package into the node-side test process. `import type` is fully
  erased at transpile, so the engine barrel never loads at runtime — that WHY-NOT does not
  apply, but the comment records why it is safe so nobody "helpfully" converts it.
- Kept the per-call-site WHY comment ("`all-edges` so sibling chords render …") at each
  `beforeAll` — the knowledge that got DRY'd is the STORE SHAPE, not the per-suite reason.

## Dead ends

None. No rework, no failed compile, no flaky e2e retry.

## Commands + results (verbatim tails)

```
npm run check > .tmp/check.log 2>&1      -> CHECK_EXIT=0   (tsc -noEmit && tsc -noEmit -p e2e/tsconfig.json)
npm test      > .tmp/test.log  2>&1      -> TEST_EXIT=0    Test Files 74 passed (74) / Tests 990 passed (990)
npm run setup:dev-vault > .tmp/setup-dev-vault.log 2>&1 -> SETUP_EXIT=0
npm run test:e2e -- edgeRouting.e2e.ts edgeRoutingEval.e2e.ts > .tmp/e2e.log 2>&1 -> E2E_EXIT=0
    7 passed (16.8s)   [REAL Obsidian, ran here, not skipped]
grep -n "pluginDataStore\|setAllEdgesVisibility" e2e/edgeRouting.e2e.ts e2e/edgeRoutingEval.e2e.ts
    -> no matches (exit 1)
```

The e2e gate genuinely executed in this environment: `.dev-vault/` and `.tmp/e2e/` already
existed from prior runs, and `setup:dev-vault` is idempotent. Eval readouts printed real
numbers (e.g. dense: `routingMs=145.8 layoutMs=1436.7 edges=292`), so Obsidian really booted
and rendered.

## Out-of-scope items noticed (for TOP_LEVEL_AGENT to ticket, NOT done here)

1. `settingsResetReview.e2e.ts` (~53, 62, 217, 252), `settingsResetVerify.e2e.ts` (~49, 79),
   `settingsUxVisual.e2e.ts` (~82, 89, 125, 162, 215, 243, 292, 303) all inline the same
   `pluginDataStore` shape, and use the sloppier `(window as any).app` instead of the house
   `(window as unknown as { app: any }).app` idiom. Worth a follow-up.
2. `setNodePreviewPreference` hand-repeats `"auto" | "outline" | "image"` instead of
   importing `NodePreviewPreference` — now inconsistent with the new sibling. Trivial fix,
   deliberately left alone.
