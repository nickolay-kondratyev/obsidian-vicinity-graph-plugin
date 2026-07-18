# EXPLORATION: Plan context + build/test conventions (Step 04)

## 1. Plan context: Phase 4 and neighbors
- **Phase 4 (View shell)** = "milestone where it feels real": ItemView + React 18, MAIN tracking, per-leaf getState/setState, rebuild pipeline `events → engine → structural diff → elkjs → React Flow`. Deliverable: first visible graph with plain nodes.
- **Phase 3 (DONE):** view consumes stable engine + adapters. Seam = `plugin.graphBuilder.build(mainPath): Promise<NeighborhoodGraph|null>`. Depth/sizing from persisted + global settings only (no UI controls).
- **Phase 5 (NEXT):** rich nodes, folder groups (RF subflows), directed/collapsed edges, theme vars.

**Compound-layout constraint (critical for elk options):**
- elkjs chosen *specifically* because it understands hierarchical containment so folder groups (step 5) lay out. "Dagre does not handle compound layout; do not spend time on it."
- step-04: "choose elk options now with compound layout in mind, even though this step renders flat plain nodes." step-05 confirms "options baseline chosen in step 04."
- Open item #1: pick elk algorithm/options baseline (`layered` vs `force`/`stress`) for compound future; spike on real fixture first.

**Layout-stability constraints:**
- Diff node/edge structure each rebuild; unchanged structure skips layout, only refreshes node data.
- Exception: surviving node whose `sizePx` grew beyond `SIZE_RELAYOUT_THRESHOLD` (named const, `1.0` = +100%) → full relayout.
- Structural changes accept layout jumps in V1 (position-seeding is V2).
- Debounce vault changes → debounced metadata resolve ~500ms (named const). Open item #2: active-file change during in-flight rebuild → cancel/replace, latest wins.

## 2. Step-04 must NOT do (but leave room for)
- NOT: rich node components, MAIN/pinned/regular styling tiers, folder groups/subflows, directed+collapsed edges w/ arrowheads/badges, theme CSS vars, hover previews, ctrl/cmd-click.
- Leave room for: compound/containment layout (elk options), RF subflow grouping, per-node `sizePx`.
- step-04 rendering: default RF nodes with titles, pan/zoom/fit-view, click-opens-note only.

## 3. Testing / build conventions
- `vitest.config.ts`: `include: ["src/**/*.test.{ts,tsx}"]` — **.tsx already included**. Submodule via `npm run test:sublib`.
- Scripts: `test`=`vitest run && test:sublib`; `check`=`tsc -noEmit`; `build`=`check && esbuild production`; `dev`=watch.
- **No DOM env** (no jsdom/happy-dom) — tests run in node. **.tsx tests must avoid real DOM**; test pure mapping functions, not React components.
- **BDD naming**: `describe("Subject")` + `it("WHEN ... THEN ...")`, ~one assert/test, GIVEN in fixture JSDoc. `import { describe, expect, it } from "vitest"`.
- **Fixture builders**: factory fns with `Partial` overrides; determinism tested (`toEqual` on repeat).
- **Fakes (no obsidian runtime mock)**: engine `FakeLinkProvider`; adapters `FakeObsidianPorts`/`FakeDocIdPort` (structural, declarative spec); persistence `FakeFileStorage`/`FakePluginDataPort`.
- **DIP via structural ports** (obsidianPorts.ts): real Obsidian objects satisfy interfaces structurally; tests pass plain fakes. **View layer must follow: extract Obsidian-touching logic behind narrow structural ports; keep .tsx thin.**
- Import guard: engine never imports obsidian/id-lib/react. View lives in `src/view/`, outside guard.
- **step-04 pure parts to extract & test**: structural diff (incl. size-growth exception), rebuild decision logic, engine→RF/elk mapping. ItemView stays thin, exercised manually in dev vault.
- **Testing elk mapping without DOM**: write `NeighborhoodGraph → {RF nodes, edges}` and `→ elk graph` as pure functions returning plain objects; assert JSON shape. **elkjs runs headless in node** (real ELK callable in tests); do NOT mount React Flow in tests.

## 4. Step-03 outputs step-04 depends on
- `plugin.graphBuilder.build(mainPath): Promise<NeighborhoodGraph|null>` — one async orchestration per rebuild; null = path unresolved (view handles as "no graph"). View calls this, does NOT re-wire engine.
- Plugin public fields (main.ts:25-30): `graphBuilder`, `persistenceServices` (step 06), `pluginDataStore` (globals+pins).
- Engine output `NeighborhoodGraph` maps to RF/elk. Node fields now: `path` (RF id), `title`, `folder`, `isCentral`/`isMain`, `sizePx` (diff-stable), `minDepth`, `depthTags`, `attachments`, `firstImagePath`. Edge: `{source,target}` deduped.
- View is READ path → getDocId only (enforced in builder); doc without docid still renders.
- main.ts already registers view (`VIEW_TYPE_NEIGHBORHOOD_GRAPH`), activateView() (right sidebar `getRightLeaf(false)`), debug log command. Existing NeighborhoodGraphView mounts placeholder via createRoot/unmount — step-04 replaces body, keeps lifecycle.

## 5. Changelog
- Location: **`docs-internal/CHANGELOG.md`** (single file, newest on top).
- Format: `## <YYYY-MM-DD> — <step-slug>: <short title>`, one-line lead referencing step doc + phase with `[[wikilinks]]` + binding CLARIFICATION Qs, bulleted module-anchored list, closing `Verified:` line stating `npm test` counts (root+sublib), `check`, `build` all green + any pending human smoke-run ticket link.

## 6. elkjs / react-flow install + esbuild bundling
- **Neither installed.** Must add as `dependencies`.
- npm reachable: `elkjs` 0.12.0; `reactflow` 11.11.4 (v11); `@xyflow/react` 12.11.2 (v12, renamed successor). React is `^18.3.1`.
- esbuild: `bundle:true`, cjs, es2021. Externals: obsidian, electron, @codemirror/*, @lezer/*, builtins. **elkjs/react/react-dom/react-flow bundle into main.js automatically — no esbuild change needed.** elkjs ships web-worker variant; worker bundling needs consideration only if worker used (likely inline-async V1, no worker).

## 7. Architecture notes for view layer
- docs-internal: `plan/high-level-plan.md`, `plan/steps/*`, `tickets/*`, `CHANGELOG.md`. No ADR file.
- Hexagonal ports convention documented in obsidianPorts.ts + engine/index.ts JSDoc. **View pushes all testable logic (diff, rebuild-decision, graph→RF/elk mapping) into pure modules; NeighborhoodGraphView.tsx is thin shell.**
- View placement: right sidebar default, draggable, follow active file, ignore non-eligible actives (isEligible md/canvas), per-leaf getState/setState. Open item #4: per-leaf state = view settings snapshot; scroll/zoom NOT persisted (confirm).
- **Named constants**: `SIZE_RELAYOUT_THRESHOLD = 1.0` and ~500ms debounce. Engine constants in engine/constants.ts (import-guarded); **view constants live near view (e.g. `src/view/` constants module)**.
