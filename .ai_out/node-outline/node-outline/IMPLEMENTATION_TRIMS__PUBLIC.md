# IMPLEMENTATION_TRIMS__PUBLIC — node-outline final cleanup

Role: `IMPLEMENTATION_TRIMS`. Scope: the four human-approved trims from
`PARETO_COMPLEXITY_ANALYSIS__PUBLIC.md`. **Nothing else touched.**
One commit: `40a67de`. Tree clean.

## Status

| | |
|---|---|
| `npm run check` | **PASS** (clean) |
| `npm test` | **815 passed / 3 failed** — the SAME 3 pre-existing `collidePaddingPx` failures (`SettingsSpec.test.ts` ×2, `forceLayoutSettings.test.ts` ×1). Identical count to the pre-trim baseline. No test file was edited. |
| `npm run test:e2e` | **36 passed / 2 failed / 7 did not run** — identical to the documented pre-trim baseline. Both failures are the known, ticketed pre-existing ones (`edgeRoutingEval` radial routing gate, `vicinityGraph` gamma breadcrumb); the "7 did not run" are the serial-file remainders those two abort. **All 11 `nodeOutline` cases green.** |
| Mutation check | R3's guard re-verified after the move (below). |

## The four trims

### 1. R1 (CUT) — `DEFAULT_OUTLINE_MAX_DEPTH` — **DONE**

Verified zero consumers first (`grep -rn` over `src/`, `e2e/`, `docs-internal/`
returned only the definition and the re-export). Deleted from
`src/engine/constants.ts` and `src/engine/index.ts`; the `@see SETTINGS_SPEC`
comment on the surviving `MIN_/MAX_OUTLINE_DEPTH` pair narrowed from
`{default,min,max}` to `{min,max}`. `npm run check` is the whole verification, as
the analysis predicted.

### 2. R2 (SIMPLIFY) — `ResolvedReference` / `orderedMarkdownReferences` — **DONE**

Both removed from `src/adapters/ObsidianLinkProvider.ts`. The image rule already
read `ReferenceOrder.orderedReferences` directly, so the `offset` field had no
reader. Resolution now happens inline in the (renamed) outgoing-paths method.
One interface and one method fewer to explain.

### 3. R3 (SIMPLIFY) — one file owns the outline's visibility — **DONE**

`.vicinity-graph-outline { display: none }` moved out of
`src/view/node-outline.css` into `src/view/graph-view.css`, immediately above the
density-threshold blocks; the reveal inside `@container (min-height: 104px)` lost
its `.vicinity-graph-node ` specificity tie-breaker. Both `display` rules now sit
in one file where later-wins is visible on the page, so stylesheet concatenation
order cannot decide the outcome. The WHY comment at the moved rule says exactly
that, and names the bug it prevents. `node-outline.css`'s header comment was
rewritten to match (it is now purely about appearance).

**Guard re-verified, not assumed.** Deleting the reveal turned
`nodeOutline.e2e.ts` case 1 red with `expect(locator).toBeVisible() failed`
(1 failed), and only that case. Tree restored, then re-run green (11 passed).

### 4. Double-sort dedupe — **DONE**

`ReferenceOrder.orderedReferences` was allocated **and sorted twice** per
heading-bearing markdown file inside a single `getFileMetadata` call: once for
the image rule, once for attachment resolution. It is now derived **once** and
shared.

The sharing needed no awkward plumbing, because the "can the metadata cache order
this file's links?" question the two branches already asked collapses into the
shared value itself:

- New module-private `orderedReferencesOf(file, cache)` returns the ordered array,
  or `null` when the cache cannot answer (not markdown, or not indexed yet).
- `resolvedOutgoingPaths(path)` became `outgoingPathsOf(file, references)`. Its
  old middle branch (`isMarkdownPath(...) && cache !== null`) is now exactly
  `references !== null` — the same condition, not an approximation — so the
  canvas-fallback and `resolvedLinks` branches are untouched and in the same order.
- `getFileMetadata` derives `references` once beside the existing single
  `getFileCache` read and passes it to both `attachmentsOf` and `outlineOf`.
- `referencesImageAbove` keeps its early stop: it still resolves only the
  references above the first heading, and `attachments` stays the single full pass.

No cache, no memo, no new abstraction — one array threaded through parameters
that were already being passed.

## Behaviour notes (called out rather than buried)

- **One extra map lookup on the `getOutgoingLinks` path for canvas files.**
  `getOutgoingLinks` now calls `getFileCache(file)` before dispatching, where
  previously it only did so for markdown. The result is discarded for canvas
  (`orderedReferencesOf` returns `null` for non-markdown), so behaviour is
  identical; the alternative was repeating the `isMarkdownPath` test at the call
  site. Net work per file still went **down**, since a whole sort disappeared.
- **`outlineOf` now guards `references !== null` before the image check.** That
  state is unreachable today (outline-bearing ⊆ markdown, and `cache !== null` is
  already required above it), so this is a type-level guard, not a silent
  fallback — and the honest reading is "nothing is KNOWN to sit above the first
  heading", which is what the comment says.
- **No test was added, changed or weakened.** The trims are removals and a
  re-plumbing; the analysis named the existing guards
  (`npm run check` for R1, the ordered-attachments assertion for R2 and the
  dedupe, the `toBeVisible()` e2e case for R3) and all of them still hold.

## Not touched, on purpose

- The 3 pre-existing vitest failures and the 2 pre-existing e2e failures.
- `change_log` and `docs-internal/CHANGELOG.md` — TOP_LEVEL_AGENT owns them.
- `main.js` / `styles.css` (build artifacts, regenerated via
  `npm run setup:dev-vault`).
- R4 / R5 from the analysis (follow-up ticket / advice only — no work now).
- No `ap_XXX_E` anchor, no behaviour-capturing test, no persisted shape, no
  engine-purity rule (`importGuard` green).

## Questions for the human

None.
