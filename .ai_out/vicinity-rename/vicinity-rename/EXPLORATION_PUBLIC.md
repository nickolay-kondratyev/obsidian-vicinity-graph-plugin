# EXPLORATION — neighborhood → vicinity rename

## Task
Rename all `neighborhood` vocabulary to `vicinity` across the repo (repo already
moved to GitHub `obsidian-vicinity-graph-plugin`). Also align plugin/package
naming & version to Obsidian conventions: `obsidian-vicinity-graph-plugin` → `vicinity-graph`.
Human wants a **script-driven** rename (not manual per-file LLM edits). No regressions; full test suite must pass.

## Scope census (excludes .git, node_modules, .ai_out, submodules, package-lock.json)
- `neighborhood` (lower): 333
- `Neighborhood` (Cap): 186
- `NEIGHBORHOOD` (upper): 15
- `neighbourhood` (British): 0
- Total `neighborhood`-family: **534** across ~75 files.

### Separate word-family: `neighbor` / `neighboring` / `neighbors` / `neighbour(s)` (NON-`hood`)
Appears as **graph-adjacency domain vocabulary** and prose:
- `src/engine/GraphTruncator.ts` (comments + var names: `neighbors`, `Neighbor`)
- `src/engine/types.ts:75` (`neighbors`)
- `src/engine/testFixtures/denseVaultFixtures.ts` (fixture note titles: `Neighbors`, `NEIGHBOR`)
- `src/view/nodePinAction.ts:9`, `ElkLayout.test.ts`, `GraphViewController.test.ts` (British `neighbour(s)`)
- `package.json` / `manifest.json` description: "visualization of **neighboring** notes"
- 1 ticket file (British `neighbour`)
"neighbor(s)" is standard CS graph terminology (adjacent node). **Decision needed** whether these are in scope.

## Files to RENAME (path contains Neighborhood)
- `src/adapters/NeighborhoodGraphBuilder.ts` (+ `.test.ts`)
- `src/engine/NeighborhoodEngine.ts` (+ `.test.ts`, `.denseFixtures.test.ts`)
- `src/engine/NeighborhoodTraversal.ts` (+ `.test.ts`)
- `src/view/NeighborhoodEdge.tsx`
- `src/view/NeighborhoodGraphFlow.tsx`
- `src/view/NeighborhoodGraphSettingTab.ts`
- `src/view/NeighborhoodGraphView.tsx`
- `e2e/neighborhoodGraph.e2e.ts`

## Identifier hotspots (must stay internally consistent)
- `VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view"` (src/view/NeighborhoodGraphView.tsx; used in main.ts x5)
  → const → `VIEW_TYPE_VICINITY_GRAPH`, value `"vicinity-graph-view"` (⚠ persisted view-type string; new install so acceptable).
- Plugin **id** `obsidian-neighborhood-graph` (manifest.json, package.json name, e2e/obsidianHarness.ts `PLUGIN_ID`,
  src/manifest.test.ts assertion, DocDataStore.test.ts / OrphanSweeper.test.ts paths, README install path) → `vicinity-graph`.
- Display **name** `"Neighborhood Graph"` → `"Vicinity Graph"`.

## Config / naming targets (Obsidian conventions: no `obsidian-` prefix, no `-plugin` suffix on id)
- `manifest.json`: `id` `obsidian-neighborhood-graph` → `vicinity-graph`; `name` → `Vicinity Graph`.
- `package.json`: `name` `obsidian-neighborhood-graph` → `vicinity-graph`.
- `versions.json`: keyed by version string.
- Old repo slug refs `obsidian-neighborhood-graph`: README install-folder path (= plugin id → `vicinity-graph`),
  CHANGELOG/RELEASE_CHECKLIST/plan (historical prose).

## Test / build entrypoints
- `npm test` → `vitest run && npm run test:sublib` (sublib = submodule obsidian-id-lib; unrelated to rename).
- `npm run check` → `tsc -noEmit`.
- e2e is separate (`test:e2e`, playwright) — not part of `npm test`.
- Tests that HARDCODE the id/name and will need updating: `src/manifest.test.ts`, `DocDataStore.test.ts`, `OrphanSweeper.test.ts`, `e2e/obsidianHarness.ts`.

## Constraints / notes
- Submodule `submodules/obsidian-id-lib` is a DIFFERENT repo — do NOT rename inside it.
- `ask.dnc.md` itself contains "neighborhood" (the task prompt) — exclude from rename.
- `.ai_out/` historical docs — exclude from rename (agent scratch).
- Rename must preserve `[[wiki.links]]`, `ap_XXX_E` anchors, casing (snake/camel/Pascal/kebab/UPPER).
