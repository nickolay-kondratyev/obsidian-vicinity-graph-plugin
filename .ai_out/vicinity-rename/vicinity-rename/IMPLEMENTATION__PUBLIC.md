# IMPLEMENTATION — `neighborhood` → `vicinity` rename (script-driven)

Role: IMPLEMENTATION. Branch: `vicinity-rename`. Executed the approved plan
(`DETAILED_PLANNING__PUBLIC.md`) with the reviewer's inline fixes. Changes are left in
the working tree (staged renames via `git mv` + unstaged content edits); TOP_LEVEL_AGENT
commits.

## Result: SUCCESS — all gates green, all acceptance criteria met.

---

## 1. What the script did

Script: `.tmp/vicinity-rename/rename.py` (throwaway, untracked, per plan §2/§7 — one-shot
migration, kept out of `scripts/`). Python, idempotent, two passes.

**Pass 1 — CONTENT** (ordered, case-sensitive literal replacements; id-special → plural →
singular; British forms included for robustness, 0 hits):

- files changed: **72**
- replacements applied:
  - `obsidian-neighborhood-graph` → `vicinity-graph`: 11
  - `neighborhoods` → `vicinities`: 4
  - `NEIGHBORHOOD` → `VICINITY`: 15
  - `Neighborhood` → `Vicinity`: 186
  - `neighborhood` → `vicinity`: 314

File selection = `git ls-files` minus `submodules/**`, `.ai_out/**`, `package-lock.json`,
`ask.dnc.md`. Non-UTF-8 (binary) files skipped. Writes only on change (re-run is a no-op).

**Pass 2 — RENAME** (`git mv`, basename run through the same rule fn): **12 files moved.**

## 2. Files renamed (all 12, tracked as git renames)

| Old | New |
|---|---|
| `src/adapters/NeighborhoodGraphBuilder.ts` | `src/adapters/VicinityGraphBuilder.ts` |
| `src/adapters/NeighborhoodGraphBuilder.test.ts` | `src/adapters/VicinityGraphBuilder.test.ts` |
| `src/engine/NeighborhoodEngine.ts` | `src/engine/VicinityEngine.ts` |
| `src/engine/NeighborhoodEngine.test.ts` | `src/engine/VicinityEngine.test.ts` |
| `src/engine/NeighborhoodEngine.denseFixtures.test.ts` | `src/engine/VicinityEngine.denseFixtures.test.ts` |
| `src/engine/NeighborhoodTraversal.ts` | `src/engine/VicinityTraversal.ts` |
| `src/engine/NeighborhoodTraversal.test.ts` | `src/engine/VicinityTraversal.test.ts` |
| `src/view/NeighborhoodEdge.tsx` | `src/view/VicinityEdge.tsx` |
| `src/view/NeighborhoodGraphFlow.tsx` | `src/view/VicinityGraphFlow.tsx` |
| `src/view/NeighborhoodGraphSettingTab.ts` | `src/view/VicinityGraphSettingTab.ts` |
| `src/view/NeighborhoodGraphView.tsx` | `src/view/VicinityGraphView.tsx` |
| `e2e/neighborhoodGraph.e2e.ts` | `e2e/vicinityGraph.e2e.ts` |

All import specifiers were already rewritten by Pass 1 before the physical move, so tsc
was the single convergence gate. Total working-tree changes: 72 (12 renames + content).

## 3. Manual edits (after Pass 1)

- **Descriptions** (`manifest.json` + `package.json`, kept in sync):
  `"A richer local graph that shows the nearby notes around your active note (an improved
  alternative to Obsidian's built-in local graph)."`
  — contains "local graph" AND "nearby notes"; contains NO "neighboring"/"neighborhood".
- **`docs-internal/RELEASE_CHECKLIST.md`** (§9 optional tidy): the deferred `obsidian-`-id
  bullet (previously "keep as-is for V1, do not rename now") was stale/contradictory after
  the rename. Marked done `[x]` and reworded to state the prefix was dropped during the
  vicinity rename. Worded to avoid the retired literal so acceptance grep stays at zero.

No test-assertion text needed manual fixing: `src/manifest.test.ts` (id expected value +
"approved 'vicinity-graph'" prose), `DocDataStore.test.ts`, `OrphanSweeper.test.ts`,
`e2e/obsidianHarness.ts` were all corrected mechanically by Pass 1. No test asserts on the
description string.

## 4. Verification results

| Gate | Command | Result |
|---|---|---|
| tsc compile | `npm run check` (`tsc -noEmit`) | **0 errors** |
| root tests | `npx vitest run` (via `npm test`) | **52 files / 559 tests passed** |
| sublib tests | `npm run test:sublib` (via `npm test`) | **6 files / 69 tests passed** |
| e2e typecheck | `npx tsc -p e2e/tsconfig.json` | **0 errors** |

Pre-rename baseline captured after `npm ci`: **559** root vitest tests / 52 files.
Post-rename: **559 / 52** — identical. Test count preserved (rename adds/removes no tests).
`npm ci` was required (node_modules absent in fresh checkout).

Sublib (submodule `obsidian-id-lib`) tests passed cleanly — no env issue to flag.

## 5. Acceptance criteria (plan §8)

| # | Criterion | Result |
|---|---|---|
| 1 | Zero `neighborhood`/`Neighborhood`/`NEIGHBORHOOD`/plural remaining (scoped grep) | **0** ✅ |
| 2 | Zero tracked basenames containing `neighborhood` | **0** ✅ |
| 3 | Graph term `neighbor(s)/neighboring` preserved | **57 hits present** ✅ |
| 4 | Identity: id `vicinity-graph`, name `Vicinity Graph`, package `vicinity-graph`, view-type `vicinity-graph-view`, version `0.1.0` (all three files) | all correct ✅ |
| 5 | Descriptions contain `local graph` + `nearby notes`, no `neighboring` | ✅ |
| 6 | `npm run check` clean | ✅ |
| 7 | `npm test` passes, count unchanged | ✅ (559 + 69) |
| 8 | e2e compiles | ✅ |

Scoped grep excludes `submodules/**`, `.ai_out/**`, `package-lock.json`, `ask.dnc.md`.

## 6. Deviations from plan

- **RELEASE_CHECKLIST tidy taken** (plan §9 marked it optional/implementer judgment). Done
  because the bullet became self-contradictory post-rename. First wording accidentally
  reintroduced the literal `neighborhood` (broke AC1 with 2 hits); caught by re-running the
  acceptance grep and reworded to avoid the retired vocabulary. Final AC1 = 0.
- No other deviations. Version left `0.1.0` everywhere; `esbuild.config.mjs` untouched
  (derives dir from `manifest.id` automatically); `submodules/**`, `.ai_out/**`,
  `ask.dnc.md` untouched; `ap_XXX_E` anchors and `[[wiki.links]]` unaffected (none intersect
  the rename family).

## 7. Not done (owned by TOP_LEVEL_AGENT)

- Final CHANGELOG entry for this rename (per task instructions).
- The commit itself (working tree left staged/unstaged; `git mv` renames are tracked).
