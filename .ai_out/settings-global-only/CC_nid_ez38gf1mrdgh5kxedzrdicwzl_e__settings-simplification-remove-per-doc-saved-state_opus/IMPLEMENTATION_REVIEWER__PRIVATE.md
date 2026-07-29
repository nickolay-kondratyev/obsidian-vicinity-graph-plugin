# IMPLEMENTATION_REVIEWER — PRIVATE state (PHASE 1 of nid_ez38gf1mrdgh5kxedzrdicwzl_e)

Review COMPLETE. Public output: `IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir).
Verdict: APPROVE with 1 BLOCKING (B1) + 4 SHOULD-FIX (S1–S4) + 2 suggestions.

## Gates I actually ran (not trusted from the implementer)
- `npm test` → 82 files / 1085 tests pass, exit 0. Log: `.tmp/review-test.log`.
- `npm run check` → exit 0. Log: `.tmp/review-check.log`.
- `npm run test:e2e` NOT run (needs real Obsidian). Found by grep that it WILL fail — see B1.
- Ran both gates concurrently in ONE background bash call; ~2 min.

## The findings, with exact evidence (for a re-check)
- **B1** `e2e/settingsResetVerify.e2e.ts:128` asserts `"Per-note depth overrides and pinned notes are kept."`;
  `src/view/settingsResetPlan.ts:73` now says `"… Pinned notes are kept."`. Found via
  `grep -rn "Per-note\|Pinned notes are kept" e2e/ src/ docs-internal/ README.md`. Not in the
  implementer's PHASE 2 list → undisclosed red gate. Only ONE such stale e2e copy assertion exists.
- **S1** `GraphViewController.currentMainPath()` (`src/view/GraphViewController.ts:161`) — production
  callers: none (`grep -rn "currentMainPath()" src/ e2e/` → only the method + tests :300/:306 in
  `GraphViewController.test.ts`). `handleSettingsChanged` IS still used (`VicinityGraphView.tsx:96`).
  `RebuildDecision.ts:16` only has a *parameter* named currentMainPath — not a caller.
- **S2** `src/engine/VicinityEngine.test.ts` last test in "pinned-central depth exploration" compares
  two `?.depthTags` — vacuous if both undefined.
- **S3** missing PHASE 2 items: B1 file; `docs-internal/notes/settings.md:34-36,68,76` (+151-154)
  naming the now-deleted `ViewSettingsResolver.resolve()` as the guard AND the ratified chain bar;
  stale doc-data comments `e2e/vaultTarget.ts:90,120,129`, `e2e/obsidianHarness.ts:495,665`.
- **S4** `PersistenceServices.unpinDoc` lost its whole doc comment (the "always lands, no verdict"
  fact is what justifies `ControlsActions.unpinNode` skipping `persistOutcome`).

## Things I verified as OK (do not re-litigate)
- Global depth drives every root at runtime: `VicinityEngine.ts:108-111` (`toRoots` → one
  `request.globalDepths` for `[main, ...pinned]`). Write path: `GlobalDepthControls.tsx:27` →
  `planSettingsWrite("global-depth")` (`settingsWritePlan.ts:57-61`) → `ControlsActions.executeSettings`
  → `saveGlobalDepths` → `refreshAllViews()`.
- **EMPTY_CONTROLS hazard is NOT real**: `VicinityGraphFlow.tsx:64` early-returns on
  `status === "empty"`; `GraphToolbar` mounted only at `:120`. So `GraphToolbar` dropping its
  `centrals[0] === undefined → null` guard cannot expose engine-default steppers that would overwrite
  persisted globals. This was my main suspected bug; it does not exist.
- Residue grep clean: no `docData|doc-data|centralDepth|OwningViewPort|settingsWriteScope|FileStoragePort|`
  `depthOverridesByRoot|mainViewOverride|pinnedViewOverrides` left in `src/` except intentional
  "there is no per-doc layer" WHY comments (`VicinityEngine.ts:25`, `engine/index.ts:30`, `types.ts:181`).
- `NodePriorityChain` (freed by ViewSettingsResolver deletion) still used by `GraphTruncator.ts` → not dead.
- Surviving-behavior tests all present; enumerated in the PUBLIC doc. `DocPersistEligibility` behavior
  unchanged with an explicit WHY-NOT at `:7-12`.
- CSS diff is a clean rename `.vicinity-graph-central*` → `.vicinity-graph-depth-controls` plus removal
  of `data-pinned` / `__reset` / `data-disabled` rules; e2e locators retargeted accordingly.
- `e2e/settingsUxVisual.e2e.ts:103,142` + `settingsBaseline.ts:140,154` still reference
  PINNED_CENTRALS_SUMMARY — harmless (disclosure now unconditionally absent, so the absence test
  passes); implementer already disclosed these for PHASE 2.

## Method notes for a future clone
- The repo's bash wrapper prints ~15 lines of env noise before every command — pipe through
  `grep -v "^\[2m\|^\[1m\|^\[33m"` or you burn context.
- Big diffs overflow: prefer `git diff main...HEAD -- <paths>` per layer, and read the RESULTING files
  (they carry excellent doc comments) rather than the raw patch where possible.
- `git show main:<path>` is how I recovered the three deleted modules to judge the deviations.
