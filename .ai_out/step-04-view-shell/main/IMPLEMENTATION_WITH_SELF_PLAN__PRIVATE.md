# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory (step-04-view-shell)

Role: IMPLEMENTATION_WITH_SELF_PLAN. First run. Repo root:
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph`

## Goal
Replace HelloGraph placeholder with a real ItemView that shows the active file's
neighborhood as plain React Flow nodes, laid out by elkjs, rebuilding on navigate /
metadata-resolve (debounced), with structural-diff layout reuse + latest-wins guard.

## Binding decisions (CLARIFICATION, human-approved)
- elk `layered` + `hierarchyHandling: INCLUDE_CHILDREN`, `elk.direction` via constant. Spike on dev-vault.
- Inline async layout, NO worker. Use `elkjs/lib/elk.bundled.js` (self-contained, node+browser).
- Latest-wins via monotonic rebuild token. No sleeps.
- getState/setState thin; do NOT persist scroll/zoom/view snapshot.
- `@xyflow/react` v12 (12.11.2) + `elkjs` (0.12.0) as deps. INSTALLED.
- Constants: SIZE_RELAYOUT_THRESHOLD=1.0, REBUILD_DEBOUNCE_MS=500 in src/view/constants.ts.

## Architecture (keep .tsx thin; push logic to pure node-testable modules)
Pure (no obsidian/react/elkjs-runtime imports; type-only ok):
- src/view/graphIdentity.ts — edgeIdOf(edge)=`${source}->${target}`; nodeSideLengthPx(node)=sizePx.
- src/view/constants.ts — thresholds/debounce/elk options/ELK_ROOT_ID.
- src/view/flowMapping.ts — FlowNode/FlowEdge/FlowNodeData/XY; neighborhoodGraphToFlow; withPositions.
- src/view/elkMapping.ts — neighborhoodGraphToElk (compound-ready root+children+edges); extractElkPositions (recursive, offset-accumulating for compound future). type-only import of ElkNode.
- src/view/GraphStructureDiff.ts — LayoutDecision "relayout"|"reuse-layout"; decideLayout(prev,next,threshold).
- src/view/RebuildDecision.ts — ActiveFileOutcome; decideActiveFileRebuild(activePath,currentMain). Uses shared/FileKinds.isNodeBearingPath.
Glue:
- src/view/ElkLayoutRunner.ts — wraps ELK (elk.bundled). imports elkjs runtime only (node-testable! used in real-ELK test).
- src/view/GraphViewController.ts — imports obsidian+builder+pure+runner. Holds prevGraph, positions, rebuildToken, mainPath, debounceTimer, snapshot + subscribers (external store). Pipeline: build→decideLayout→map→(reuse positions | elk layout)→snapshot. openNode(path).
- src/view/NeighborhoodGraphFlow.tsx — React component; useSyncExternalStore(controller); renders ReactFlow+Background+Controls; toReactFlowNode adapter (RF types confined here); onNodeClick→controller.openNode.
- src/view/NeighborhoodGraphView.tsx — ItemView rewrite: createRoot/unmount lifecycle kept; builds controller from plugin.graphBuilder+app; registers workspace active-leaf-change/file-open + metadataCache "resolved" via this.registerEvent; controller.start()/dispose(); thin getState/setState.

main.ts: pass plugin (app + graphBuilder) into view via registerView closure.
Delete src/view/HelloGraph.tsx.

## CSS approach (robust, not hacky)
esbuild bundles JS only. Generate root styles.css at build = @xyflow/react/dist/style.css
(vendor) + src/view/graph-view.css (authored). esbuild plugin regenerates on each build
(onStart) so no drift; existing copy step ships it to dev vault. styles.css becomes a
generated-but-committed artifact (banner comment). Authored rules live in src/view/graph-view.css.

## Pipeline detail (controller.runRebuild)
token=++rebuildToken; if mainPath null→EMPTY. graph=await build(mainPath); if token stale return.
if graph null/empty→reset prev+positions→EMPTY. decision=decideLayout(prev,graph,THRESHOLD).
reuse-layout: withPositions(flow.nodes, this.positions) [data refreshed, positions kept]; log skip. 
relayout: elkGraph=toElk; laidOut=await runner.layout; if token stale return; positions=extract;
apply; store. Always prev=graph. setSnapshot notifies subscribers.
Debounce metadata resolved via window.setTimeout(REBUILD_DEBOUNCE_MS). ActiveFile via decideActiveFileRebuild.

## Tests
src/view/GraphStructureDiff.test.ts (incl. size-growth boundary at exactly +100% → reuse; >100% → relayout; node-set change → relayout; edge-set change → relayout; identical → reuse).
src/view/RebuildDecision.test.ts (null/non-eligible/same-path→ignore; new md→rebuild).
src/view/flowMapping.test.ts (node id=path, edge id synth, data fields, withPositions).
src/view/elkMapping.test.ts (root options, children dims, edges shape, extractElkPositions).
src/view/ElkLayout.test.ts (REAL elk: layout fixture → distinct positions; determinism).
Fixtures: src/view/testFixtures/graphFixtures.ts (makeGraph/makeNode Partial builders).

## Commands
- npx vitest run > .tmp/step04-vitest.log 2>&1
- npm run check > .tmp/step04-check.log 2>&1
- npm run build > .tmp/step04-build.log 2>&1

## Status: COMPLETE
- vitest: 325 passed / 35 files (root suite). Log: .tmp/step04-vitest.log
- npm run check (tsc -noEmit): PASS. Log: .tmp/step04-check.log
- npm run build (production esbuild): PASS. main.js 1.84MB (elkjs+react+react-flow bundled),
  styles.css 19KB generated+copied to dev vault. Log: .tmp/step04-build.log
- Deps added to package.json dependencies: @xyflow/react ^12.11.2, elkjs ^0.12.0.

## Gotchas / notes for a clone
- elkjs imported from `elkjs/lib/elk.bundled.js` (default export) = in-thread, no worker; runs
  headless in node (ElkLayout.test.ts proves it). Types via `import type { ElkNode } from "elkjs"`.
- styles.css is now GENERATED (esbuild onStart) and added to .gitignore, but it was previously
  git-TRACKED. It still shows as tracked+modified until untracked. TOP_LEVEL must run
  `git rm --cached styles.css` when committing so the generated artifact stops being tracked
  (consistent with main.js). Non-destructive: I only edited .gitignore + banner.
- Controller is the only view module importing obsidian+builder; NOT node-tested by design
  (thin glue; decisions delegated to tested pure modules). Manual dev-vault test covers integration.
- FlowNode/FlowEdge are our own types (no @xyflow/react import in pure modules); RF types are
  confined to NeighborhoodGraphFlow.tsx via toReactFlowNode/toReactFlowEdge adapters.
- Skip-layout dev signal: console.debug in GraphViewController.runRebuild on reuse-layout path;
  unit-proven by GraphStructureDiff.test.ts ("structure unchanged -> reuse-layout").
- Size-growth boundary: growthRatio > threshold (strictly). Exactly +100% (ratio 1.0) => reuse.

## Iteration 1 (review response) — DONE
Reviewer verdict was READY; addressed the essential feedback.
- Port seam: NEW `src/view/viewPorts.ts` (GraphSourcePort/GraphLayoutPort/NoteNavigatorPort, types-only)
  + NEW `src/view/ObsidianNoteNavigator.ts` (App→NoteNavigatorPort adapter, holds getFileByPath/getLeaf).
  Controller now imports NO obsidian; constructor = (navigator, graphBuilder, layoutRunner) as ports.
  Builder/Runner satisfy ports structurally → main.ts/ItemView wiring unchanged except ItemView builds
  the navigator and passes it (also reuses it for event wiring; removed duplicated activeFilePath).
- clearDebounce() added at top of handleActiveFileChanged REBUILD branch (not on ignore).
- console.debug reuse-layout log KEPT (debug level = hidden-by-default; gating needs esbuild define, not
  worth it). getState/setState KEPT per CLARIFICATION Q4.
- NEW test `src/view/GraphViewController.test.ts` — 10 tests, structural fakes, deferred builds resolved
  out-of-order (NO sleeps; `flush()` = setImmediate to drain microtasks). Covers latest-wins (stale
  discarded / never reaches layout / latest wins), null+empty→empty, non-node-bearing→no build,
  reuse-layout skips elk + preserves positions, node-set change relayouts, openNode delegates.
- Controller tests run in vitest's default NODE env (no `window`); safe because they never hit the
  debounce path and clearDebounce guards on null timer.

## Gate status after Iteration 1 (all green)
- vitest: 335 passed / 36 files (was 325/35). Log: .tmp/step04-iter-vitest.log
- npm run check: exit 0. Log: .tmp/step04-iter-check.log
- npm run build: exit 0, main.js 1.84MB, styles.css 19KB copied. Log: .tmp/step04-iter-build.log

## Gotcha for a future clone
- noUncheckedIndexedAccess is ON: index accesses (deferreds[i], paths[0]) need guards/destructuring
  or tsc fails even when vitest passes. Hit this in the controller test; fixed.

## If pending work resumes
Nothing pending for step-04 scope. Manual dev-vault smoke is the human's (see PUBLIC smoke steps).
