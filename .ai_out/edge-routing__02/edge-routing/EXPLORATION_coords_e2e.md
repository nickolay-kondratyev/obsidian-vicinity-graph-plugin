# Exploration: coordinate space + e2e (edge-routing__02)

## 1. Coordinate space — flowMapping.ts / subflow children
- `FlowNodeBase.position` (flowMapping.ts:77-89): "relative to parentId's origin when present, absolute otherwise (RF subflow convention)".
- `withPositions` (flowMapping.ts:312-333): subflow child position = `{x: absolute.x - parentOrigin.x, y: absolute.y - parentOrigin.y}` (parent-relative). That's the RF `Node.position` prop — NOT what edges see.
- RF always computes `sourceX/sourceY/targetX/targetY` for custom edges in ABSOLUTE flow coords regardless of parentId nesting. Documented at VicinityEdge.tsx:31-34 and edgeRouting.ts:16 ("ABSOLUTE layout coordinates").
- `extractEdgeRoutingInput` (edgeRouting.ts:80-103, called GraphViewController.ts:241-246) fed PRE-`withPositions` absolute maps (from extractElkPositions/extractElkDimensionsById, GraphViewController.ts:211-212). Comment edgeRouting.ts:61-64 confirms intentional shared absolute space.
- **CONCLUSION**: routedPoints (absolute) and RF sourceX/Y (absolute, even subflow children) are already same space. No offset/transform needed. Ticket item 3 → just add a verifying test/comment; nothing to fix. (Still worth an assertion/test.)

## 2. d3ForceRefinement.ts — deterministic seeding
- `refineForceRootLayout` (:35-91) static d3-force sim on elk root children.
- Seed positions from elk (deterministic) via child.x/y (:41-49), recentre() (:94-101) pure arithmetic.
- `.randomSource(seededRandom())` (:58). `seededRandom` (:108-115): LCG, MODULUS=2**32, state starts at 1, constants 1664525/1013904223. No external entropy.
- Runs synchronously to precomputed tick count (:76-78). => node positions byte-for-byte deterministic across runs/machines. E2e can rely on a reproducible A→B-crosses-C layout.

## 3. e2e/ directory
Files: controlsRestart.e2e.ts, obsidianHarness.ts, pinnedCentralScenario.e2e.ts, playwright.config.ts, tsconfig.json, vicinityGraph.e2e.ts.
- Harness launches real Obsidian (Electron) via CDP `chromium.connectOverCDP` (WHY at :15-19).
- `ObsidianHarness.launch({extraFixtures?})` (:130-134) — seeds throwaway `.tmp/e2e/vault` copy of `.dev-vault` + optional fixture files.
- `openFile(vaultPath)` (:215-225); `openGraphView()` (:228-266) runs `vicinity-graph:open-vicinity-graph`, waits `.vicinity-graph-flow, .vicinity-graph-empty`; `remountGraphView()` (:275-283) fresh fitView.
- **Setting-toggle pattern** `setGlobalNodeCap` (:286-295): `store.saveGlobalView({...store.globalView(), nodeCap})`. Mirror as `setEdgeRouting(enabled)` swapping `edgeRouting: enabled`.
- `readGlobalView()` (:302-307); `setTheme` (:310-315); `close()` (:181-190).
- NO existing setEdgeRouting helper, NO screenshot call anywhere in e2e/ — must add both.
- Fixture idiom: `launch({extraFixtures})` layers `vaultRelativePath→content` markdown onto built-in `crowd/` fixtures (pinnedCentralScenario.e2e.ts:28-35), [[wikilinks]], docid frontmatter when needed.
- playwright.config.ts: testDir ".", testMatch "**/*.e2e.ts", timeout 120_000, expect.timeout 15_000, workers 1, fullyParallel false, retries 0, outputDir "../.tmp/e2e-artifacts" (gitignored trace dir, NOT .out/).
- `.out/` is separate gitignored path (.gitignore:15). Screenshot must be explicit `page.screenshot({path: "<repo-root>/.out/edge-routing-<name>.png"})`; construct explicit path (REPO_ROOT idiom obsidianHarness.ts:51).
- Representative test (vicinityGraph.e2e.ts): `test.describe.configure({mode:"serial"})`, beforeAll launches harness+openGraphView, afterAll close. Locators `.vicinity-graph-node[data-path=...]`, `expect(...).toHaveCount/Text/Attribute`, `expect.poll(...)`. data-* contract. Import badge copy from src (no drift).
- Edge path locator likely `.vicinity-graph-flow .react-flow__edge-path`; assert `d` has >2 points (bends).
- Default layout `force`: `src/engine/constants.ts:40` DEFAULT_LAYOUT_MODE="force".

## 4. edgeRouting setting
- Type: `src/engine/types.ts:202` `readonly edgeRouting: boolean`.
- Default: `src/engine/constants.ts:82` `edgeRouting: DEFAULT_EDGE_ROUTING`.
- Resolver: `src/engine/ViewSettingsResolver.ts:51` `edgeRouting: field("edgeRouting")`.
- Persistence: `src/persistence/persistedShapes.ts:133-134` parses boolean (tested persistedShapes.test.ts:53-60).
- Settings UI: `src/view/VicinityGraphSettingTab.ts:57-58` toggle → `{kind:"global-edge-routing", edgeRouting}`.
- Write plan: `src/view/settingsWritePlan.ts:36,87`.
- Runtime gate: `GraphViewController.ts:237` `if (!graph.viewSettings.edgeRouting) { this.routeCache=null; return EMPTY_ROUTES; }` in resolveRoutes (:230-265). ON → routes computed, cached by signature, merged via withRoutedPoints (:342-350).
- E2e toggle: `store.saveGlobalView({...store.globalView(), edgeRouting:true})`.

## 5. Commands (package.json)
- `npm run check` = `tsc -noEmit`.
- `npm run test` = `vitest run` (unit; e2e excluded).
- `npm run test:e2e` = `bash scripts/run-e2e.sh` (resolves OBSIDIAN_PATH, headless Ozone flags if no display, setup:dev-vault, tsc -p e2e/tsconfig.json, then `npx playwright test --config e2e/playwright.config.ts "$@"`; single spec via `npm run test:e2e -- vicinityGraph.e2e.ts`).
