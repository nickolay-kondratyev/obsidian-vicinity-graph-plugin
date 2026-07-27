# PRIVATE rehydration notes — canvas link regime unify

State: **COMPLETE through review ITERATION 1**. Nothing in flight.
Working tree clean at commit `bbdebf0`. Branch `canvas-link-regime-unify`, NOT merged.

## ITERATION 1 (review response) — read this first

Review `.ai_out/.../IMPLEMENTATION_REVIEW__PUBLIC.md`: APPROVE-WITH-FIXES, 1 should-fix
(regime still global) + 3 nice-to-haves. ALL four addressed; none deferred.

- Commits: `72ba519` (per-canvas fix + all 3 nice-to-haves), `bbdebf0` (e2e second canvas).
- **The should-fix was real** — reproduced with a failing test before fixing:
  `a.canvas` in resolvedLinks, `b.canvas` not ⇒ `b.canvas` returned `[]`.
- API changes this round (breaking, all call sites updated):
  - `CanvasCapabilityDetector.detect(keys)` → `detectFor(resolvedLinks, canvasPath)`.
    Vault-wide concept deleted; presence of the canvas's OWN key is the test (`{}` counts
    as indexed).
  - `ObsidianLinkProvider.canvasCapability` field → `fallbackServedCanvasPaths` getter.
    `main.ts` `logBacklinkProvenance` updated to name the served canvases.
  - `canvasOutgoingByPath` membership is now the per-canvas regime answer, so
    `getLinkCount`/`outgoingPathsOf` no longer test extension or capability.
  - `FakeObsidianSpec.resolutionsFrom` (source path → link text → target) added, checked
    before flat `resolutions`. Existing fixtures untouched.
- `create()` now always walks `vault.getFiles()` (previously skipped entirely when
  core-indexed). Still O(vault) per build, same as the old `Object.keys` sweep it replaced
  — measured routing time went slightly DOWN. Don't "optimize" this back into a global check.
- e2e: `test2.canvas` added to `scripts/setup-dev-vault.sh` (file node note3 + text node
  `[[note2]]`). Deliberately at depth 2 from note1 so no existing count moves. New test in
  `e2e/vicinityGraph.e2e.ts` sits BEFORE the truncation test, which must KEEP LAST (it
  mutates the global node cap without restoring it).
- The e2e guard is probabilistic pre-fix (we can't force a partial index), stable post-fix.
  The deterministic guard is the unit test. Said so in PUBLIC.md; don't overclaim it.
- Gates after iteration 1: `npm test` 1082 passed, `npm run check` exit 0,
  `vicinityGraph.e2e.ts` 21 passed, 5x sparse gate 11/11/11/11/11
  (`.tmp/e2e-final-{1..5}.log`).
- Two review conclusions the coordinator marked closed — ordering does not feed truncation,
  and the scan sits inside the mtime cache. Both left untouched. Do not reopen.

## Round 0 notes (still accurate unless contradicted above)

## What to know if resuming

- Commits: `621ece9` (src fix + tests), `42076cb` (docs/scripts/e2e). Both on branch.
- Deliberately NOT done (per task instructions): change_log entry (TOP_LEVEL_AGENT owns),
  closing ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`, merging.
- New follow-up ticket created and linked to the parent: `nid_ygo7h95ssgmunaqsprc1zlmfh_e`
  (markdown-style `[a](b.md)` links + code-span links in canvas text nodes).

## Key implementation facts

- `CanvasFallbackParser.parseFilePaths` → **renamed** `parseReferences`, returns
  `readonly CanvasReference[]` (union exported from the same file, declared at the
  BOTTOM of the file after the class).
- `CanvasParseCache.filePathsOf` → **renamed** `referencesOf`. Only callers were
  `ObsidianLinkProvider.create` and tests (verified by grep; `main.ts` only constructs
  the cache, `VicinityGraphBuilder` only holds it).
- Resolution: module function `resolvedCanvasTargetsOf(vault, metadataCache, canvasPath,
  references)` at the bottom of `ObsidianLinkProvider.ts`, called from `create()`.
  `canvasOutgoingByPath` now holds RESOLVED targets with duplicates kept (duplicates are
  what `getLinkCount` counts). `outgoingPathsOf`'s canvas branch is now just a dedupe.
- `src/shared/Wikilinks.ts`: `globalPattern()` returns a FRESH `/g` regex per call
  (shared `/g` instances leak `lastIndex` — there is a test for exactly this);
  `linkTargetsOf()` strips at the first `#` or `|` and trims.
- Layering respected: `shared` has no obsidian/react imports; importGuard tests pass.

## Verification evidence (already run, no need to redo)

- `npm test`: 1075 passed / 80 files. `npm run check`: exit 0.
- Mutation check: disabling the text-node branch in the parser fails 7 tests
  (`.tmp/mutation.log` shows "7 failed | 60 passed"). Backup trick used:
  `cp src/adapters/CanvasFallbackParser.ts .tmp/CFP.bak`, patch, run, restore.
- e2e gate `.tmp/e2e-run-{1..5}.log`: `[eval] force/sparse … edges=11` in all 5.
- e2e regime probe `.tmp/e2e-probe2-{1..4}.log`: canvasCoreIndexed true/false/false/true,
  edges=11 in all 4 → race still occurs, count no longer moves. Probe patch to
  `e2e/edgeRoutingEval.e2e.ts` was REVERTED (`.tmp/ERE.bak`).
- `npm run test:e2e -- vicinityGraph.e2e.ts`: 20 passed. Its constants are NODE counts and
  were unaffected (test.canvas was already a vicinity member).

## Gotchas encountered

- `.dev-vault/test.canvas` is seeded with `write_if_missing`, so the reworded text node did
  NOT take effect until the file was deleted and `npm run setup:dev-vault` re-run. Any future
  seed-text change needs the same dance.
- First probe attempt (a `console.debug` in `VicinityGraphBuilder`) produced NO output: the
  eval spec's `onConsole` filters page console lines to routing/layout only, and Playwright
  does not forward page console to stdout. The working probe was a `page.evaluate` in the
  spec's `beforeAll` printed via Node-side `console.log`.
- Writing a file with the `Write` tool requires having `Read` it in-session; reading it via
  `cat` in Bash does not count.
