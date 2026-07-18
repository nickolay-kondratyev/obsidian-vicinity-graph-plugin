# EXPLORATION_PUBLIC — step-04-view-shell

Consolidated exploration index. Detailed findings in sibling files:
- `EXPLORATION_view.md` — view/plugin plumbing, build config, dev-vault, install gaps.
- `EXPLORATION_engine.md` — engine + adapter API, exact call path, node/edge shapes, sizePx, isEligible.
- `EXPLORATION_build_test_plan.md` — plan context, compound-layout constraint, testing conventions, changelog, esbuild.

## The essentials (for CLARIFICATION / PLANNING / REVIEW)

**Call path (view → graph):** `plugin.graphBuilder.build(activeFile.path): Promise<NeighborhoodGraph|null>`. View does NOT touch the engine; it calls the already-wired builder. `null` = path unresolved → render "no graph". Reference impl: `main.ts:141-173` (`logNeighborhoodGraph`).

**Output shape:** `NeighborhoodGraph { nodes, edges, hiddenNodeCountsByFolder, viewSettings }`.
- `GraphNode`: `path` (RF/elk node id), `title` (label), `folder` ("" = root; elk groups later), `isCentral`/`isMain`, **`sizePx`** (diff-stable field), `minDepth`, `depthTags`, `attachments`, `firstImagePath`.
- `GraphEdge`: `{ source, target }` directed/deduped, no id → synthesize `${source}->${target}`.

**Current state / gaps:**
- View scaffolding exists (`NeighborhoodGraphView extends ItemView` mounting placeholder `HelloGraph` via createRoot/unmount). Keeps lifecycle; step-04 replaces body.
- View NOT given plugin/graphBuilder yet — wire via `registerView` closure (main.ts:63).
- No `getState`/`setState` yet — step-04 adds first.
- **react-flow + elkjs NOT installed** — add as deps (`@xyflow/react` 12.x or `reactflow` 11.x; `elkjs` 0.12). Both bundle into main.js automatically (esbuild).
- React Flow base CSS absent — must import/add to styles.css.

**MAIN tracking:** gate rebuild on `FileKinds.isNodeBearingPath(file.path)` (pure, sync, md/canvas) — ignore active attachments/images.

**Pure modules to extract & vitest-cover (keep .tsx thin):**
1. Structural diff (node/edge structure + size-growth `SIZE_RELAYOUT_THRESHOLD=1.0` exception on `sizePx`).
2. Rebuild decision logic (skip-layout vs relayout).
3. Engine `NeighborhoodGraph` → React Flow nodes/edges mapping.
4. Engine `NeighborhoodGraph` → elk graph mapping (elkjs runs headless in node — real ELK callable in tests).

**Constraints:**
- elk options must anticipate compound/containment layout (folder groups in step 5). Spike algorithm baseline (layered vs force/stress) on real fixture. Dagre explicitly rejected.
- Debounce vault changes ~500ms (named const). Active-file change mid-rebuild → latest-wins.
- No DOM test env — never mount React Flow in tests; test pure transforms only.
- Named constants (`SIZE_RELAYOUT_THRESHOLD`, debounce ms) live in a `src/view/` constants module (engine is import-guarded).

**Testing conventions:** BDD `describe`/`it("WHEN...THEN...")`, ~1 assert/test, structural fakes, `Partial` override fixtures, determinism checks.

**Changelog:** `docs-internal/CHANGELOG.md`, newest on top, `## <date> — <slug>: <title>` + `Verified:` line. TOP_LEVEL_AGENT writes ONE entry.

## Open items requiring human decision (see CLARIFICATION)
1. elk algorithm baseline (layered recommended for compound future).
2. Active-file-change-mid-rebuild policy (latest-wins — spec already implies).
3. elk web worker now vs later (inline-async at ≤100 nodes likely fine).
4. Per-leaf V1 state content (view settings snapshot; scroll/zoom NOT persisted — confirm).
5. React Flow package choice: `@xyflow/react` v12 (current) vs `reactflow` v11.
