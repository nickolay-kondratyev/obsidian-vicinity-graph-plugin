# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_xwfw86nqr8af7eygqod8lh5cp_e` — **DONE**, reviewed **READY**.
Branch `dry-e2e-edge-visibility-helper`: commit `2abd131` (implementation) plus one doc-only
iteration commit incorporating the reviewer's single in-scope NIT. `git status` clean.
Per-item review disposition lives in `IMPLEMENTATION_ITERATION__PUBLIC.md`.

## What changed and WHY

`setAllEdgesVisibility` was copy-pasted byte-for-byte into `e2e/edgeRouting.e2e.ts` and
`e2e/edgeRoutingEval.e2e.ts`. The duplication was not the four lines of code — it was the
**knowledge of the persisted global-view shape** (`app.plugins.plugins[id].pluginDataStore`
→ `saveGlobalView({ ...globalView(), edgeVisibility })`). A schema change had to land in two
places or one spec would silently drift.

That knowledge already has an owner: `ObsidianHarness` holds a cohesive family of
"write one global-view field through the plugin's own persistence API" methods
(`setGlobalNodeCap`, `setMaxNodeSizePx`, `setNodePreviewPreference`, `readGlobalView`).
The new helper is a drop-in sibling there — no new module, no fragmenting of that family.

### Helper signature and location

`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/e2e/obsidianHarness.ts`,
placed between `setMaxNodeSizePx` and `setNodePreviewPreference`:

```ts
async setEdgeVisibility(mode: EdgeVisibilityMode): Promise<void>
```

Typed against the real engine union (`src/engine/types.ts:155`), imported as
`import type { EdgeVisibilityMode } from "../src/engine";` — a type-only import, erased at
transpile, so the engine barrel never loads in the node-side test process (an inline comment
records that, because the file already carries a WHY-NOT about value-importing `src/view`).
Uses the house `(window as unknown as { app: any }).app` cast and a WHY-oriented JSDoc.

Both specs now call `await harness.setEdgeVisibility("all-edges");` in `beforeAll`, keeping
their per-suite WHY comment ("so sibling chords render and load the router") at the call site —
what got DRY'd is the store shape, not the per-suite rationale. The now-unused `PLUGIN_ID`
import was dropped from both (verified it had no other use in either file).

### Behavior-identical, deliberately

The new method does **not** call `plugin.refreshOpenViews()`, even though its neighbour
`setNodePreviewPreference` does. The old duplicated helper did not call it, and this is a pure
refactor. The JSDoc states this as a PRECONDITION of the method — call it before the graph view
renders the central file; a caller that sets it against an already-rendered view must trigger an
explicit rebuild. No assertions, timings, or semantics changed.

## Verification — all green, e2e really ran

| Gate | Result |
|---|---|
| `npm run check` | exit 0 (`tsc -noEmit` + `tsc -noEmit -p e2e/tsconfig.json`) |
| `npm test` | exit 0 — **74 files / 990 tests passed** |
| `npm run setup:dev-vault` | exit 0 |
| `npm run test:e2e -- edgeRouting.e2e.ts edgeRoutingEval.e2e.ts` | exit 0 — **7 passed (16.8s)** |
| grep `pluginDataStore` / `setAllEdgesVisibility` in the two specs | **no matches** |

The e2e gate **actually executed against a real Obsidian in this environment** — it was not
skipped or hand-waved. Evidence: real per-fixture readouts printed, e.g.
`[eval] force/dense: routingMs=145.8 layoutMs=1436.7 obstacles=101 edges=292 maxDetourRatio=1.244`,
and both bend/facing assertions in `edgeRouting.e2e.ts` passed — those only pass if `all-edges`
was genuinely persisted, which is the exact behavior this refactor moved. Logs in `.tmp/`
(`check.log`, `test.log`, `setup-dev-vault.log`, `e2e.log`).

## Scope decisions

- **Rejected (as instructed):** migrating `settingsResetReview.e2e.ts`,
  `settingsResetVerify.e2e.ts`, `settingsUxVisual.e2e.ts`. They inline the same
  `pluginDataStore` shape in ~14 places and additionally use the sloppier `(window as any).app`
  instead of the house cast idiom. **Recommend TOP_LEVEL_AGENT file a follow-up ticket** —
  `settingsUxVisual.e2e.ts` is the heaviest user and would benefit most, but it is a larger,
  riskier change than this one and deserves its own red/green cycle.
- **Rejected:** fixing `setNodePreviewPreference`'s hand-repeated `"auto" | "outline" | "image"`
  union (should import `NodePreviewPreference`). It is now mildly inconsistent with its new
  sibling. One-line fix, worth folding into the follow-up ticket above.

## What a reviewer must check

1. The `refreshOpenViews()` omission is intentional (see above). If a future caller sets edge
   visibility *after* the graph is already rendered, it will need a rebuild trigger — the JSDoc
   flags this, but it is the one behavioral sharp edge in the new API.
2. The `import type` must stay type-only. Converting it to a value import would pull the engine
   barrel into the Playwright node process.
