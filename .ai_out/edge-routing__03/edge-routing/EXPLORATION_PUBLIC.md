# EXPLORATION_PUBLIC — edge-routing__03

Consolidated context for CLARIFICATION / PLANNING / IMPLEMENTATION / REVIEW. All paths relative to repo root.

## Routing pass integration
- Routing is orchestrated by **`GraphViewController`**, AFTER layout, BEFORE publish (NOT in `GraphLayoutRunner.ts`).
  - `src/view/GraphViewController.ts:214-219` — `resolveRoutes(...)` then `publish(..., withRoutedPoints(flow, routes))`.
  - `resolveRoutes` (`:230-266`): gated by `graph.viewSettings.edgeRouting` (`:237`, OFF ⇒ `EMPTY_ROUTES`, wasm never loads); caches by `routingSignature`; on any router/wasm failure warns ONCE → empty map = straight edges (`:258-265`).
  - `withRoutedPoints` (`:342-353`) attaches `routedPoints` to each `FlowEdge`; absent edges keep straight rendering.
  - Render: `src/view/VicinityEdge.tsx:53-57` — `routedPoints.length>=2 ? routedGeometryFor(...) : edgePathFor(...)`.
- **Routing pass is mode-agnostic**: consumes only post-layout absolute `positions` + `groupDimensions`. No layout-mode branch in routing code — this is exactly the surface __03 must VALIDATE across all 3 modes.

## Tuning constants (item 2)
- `EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2` = **17px** — `src/view/edgeRouting.ts:58`. Applied at `edgeRouting.ts:211` via `router.setRoutingParameter(avoid.shapeBufferDistance, ...)`.
- `segmentPenalty` / `crossingPenalty` — typed on `Avoid` interface (`src/view/libavoidLoader.ts:25-26`) but **NOT set anywhere yet**. These are the additional knobs to add (via `router.setRoutingParameter(avoid.segmentPenalty, ...)` etc.), as NAMED CONSTANTS next to `EDGE_ROUTING_SHAPE_BUFFER_PX`.
- Arrow inset constants (`edgeGeometry.ts:44-46`): `EDGE_ARROWHEAD_INSET_FRACTION=0.12`, `_MIN_PX=14`, `_MAX_PX=48`. `EDGE_PAIR_CURVATURE_PX=34` (`edgeGeometry.ts:58`). `ROUTED_CORNER_RADIUS_PX=10` (`edgeGeometry.ts:136`).
- WHY comments at `constants.ts:42-46`, `edgeRouting.ts:56`, `edgeGeometry.ts:135` all explicitly defer tuning to __03 — update them.

## Layout modes (item 1)
- `LayoutMode = "layered" | "radial" | "force"` (`src/engine/types.ts:139`); default `force` (`src/engine/constants.ts:40`).
- `ELK_ROOT_OPTIONS_BY_MODE` — `src/view/constants.ts:110-114`. `layered`→`INCLUDE_CHILDREN` (whole hierarchy one pass). `radial`/`force`→ default `SEPARATE_CHILDREN` (folder containers laid out internally as layered, then root algorithm arranges fixed boxes). `force`: elk pass is a SEED, then d3-force refine (`GraphLayoutRunner.ts:19-21`).
- `elkMapping.ts` mode branches: container opts (`:51-54`), root edges (`:72-75`) — `layered` raw cross-boundary edges; radial/force use `projectedRootEdges` (`:96-122`, projects grouped endpoint→folder container, dedupes, orients centre-outward).

## Default flag (item 4)
- Type: `ViewSettings.edgeRouting: boolean` (`src/engine/types.ts:202`).
- **`export const DEFAULT_EDGE_ROUTING = false;` — `src/engine/constants.ts:47`** → flip to `true`. Used at `constants.ts:82`.
- Persistence handles boolean already (`persistedShapes.ts:134`). Regression tests asserting `false` default at `persistedShapes.test.ts:53-61` and fixture default `graphFixtures.ts:45` — MUST update when flipping.
- Settings toggle: `src/view/VicinityGraphSettingTab.ts:49-61` (dispatches `global-edge-routing`).

## wasm / bundle size (item 5)
- Loader `src/view/libavoidLoader.ts`: embeds base64 wasm (`libavoid-wasm` virtual module), `AvoidLib.load(data:...)` — zero network. Lazy singleton; only successful load memoized (retries on failure).
- Dynamic-imported by `LibavoidEdgeRouter.route` (`edgeRouting.ts:206`) — wasm loads on first route only.
- On-disk wasm ≈ 485 KB → base64-embedded. **main.js ≈ 2,609,836 B** currently. Phase-00 measured 1,877,709 → 2,607,082 B (+729,373 B / ~712 KiB). Measure via `ls -la main.js` (NOT auto-measured).

## Tests / fixtures / commands
- **e2e**: `e2e/edgeRouting.e2e.ts` (117 lines). Fixture `ROUTING_FIXTURES` = hub + 6-ring + 3 chords crossing hub (force layout guarantees crossing). Visibility `all-edges` in `beforeAll`. Selector `.vicinity-graph-flow .react-flow__edge-path`; `bentEdgeCount()` counts paths with `>=2` `L` commands (routed detour ≥2 L; straight=1 L; bow=0). OFF ⇒ 0 bends; ON ⇒ >0. Screenshot to `.out/edge-routing-force.png`.
  - **No `layoutMode` setter in harness yet** — add one mirroring `setEdgeRouting` (`obsidianHarness.ts:298-307`, same `saveGlobalView` spread). `layoutMode` is a persisted globalView field (`persistedShapes.ts:141-142`).
  - Settings change needs a file bounce to force pipeline re-run (`:107-109`).
- **unit**: `src/view/edgeRouting.test.ts` (extract input, asserts `EDGE_ROUTING_SHAPE_BUFFER_PX===17` at `:93-97`, real-wasm integration route-bends test). `src/view/edgeGeometry.test.ts` (OFF-path straight-edge regression, inset clamps, routed geometry, NaN hardening).
- **commands**: `npm run check` (tsc -noEmit); `npm test` (vitest run); `npm run test:e2e` (bash scripts/run-e2e.sh, auto-downloads Obsidian, supports `-- edgeRouting.e2e.ts`); `npm run build` (check + esbuild production); `npm run setup:dev-vault`; `npm run dev` (watch).
- **main.js**: repo root `main.js` (`esbuild.config.mjs:109`), copied to `.dev-vault/.obsidian/plugins/vicinity-graph/`.

## Dev-vault & fixtures (item 2/3)
- `.dev-vault/` — **gitignored**, generated by `scripts/setup-dev-vault.sh` (idempotent, never clobbers). Currently ~9 notes = **SPARSE only** + a 2-member folder group. Binary fixtures committed under `scripts/dev-vault-fixtures/`.
- **MISSING**: medium (folder-group heavy) and dense (~100+ node) fixtures — must be created for tuning + acceptance screenshot. e2e `CROWD_FIXTURES` (`obsidianHarness.ts:92-97`) is a small in-harness example to mirror.
- Screenshots → `/.out` (gitignored per CLAUDE.md).

## Docs (item 5)
- `docs-internal/vicinity-graph-specs/arrows.md` (123 lines, "Collapsing arrows to/from folder groups"). Add a **routing section** (when routes apply, straight-line fallback, bidirectional/`hasOpposite` × routing) after `### 4. Layout modes` (`:96`). `:88-94` is the deferred one-line-two-arrowheads note.
- **Project `CLAUDE.md` DOES NOT EXIST** anywhere in repo → item 5 CLAUDE.md line is moot; record that.
- **Release notes**: `docs-internal/CHANGELOG.md` (reverse-chron `## YYYY-MM-DD — headline`; phase 00/02 entries already flag main.js delta + "mobile not verified"). Version in `manifest.json` (`0.1.1`), `package.json` (`0.1.1`), `versions.json` — bump consistently for next release.
- `docs-internal/RELEASE_CHECKLIST.md` exists.

## Key gaps / risks for implementation
1. Default flip breaks `persistedShapes.test.ts:53-61` + `graphFixtures.ts:45` — update WITH the flip.
2. e2e needs a `setLayoutMode` harness helper; `layered`/`radial` may need own obstacle-crossing fixture (force crossing is fixture-guaranteed; other modes place nodes differently).
3. Medium + dense dev-vault fixtures must be created.
4. Mobile: no simulator expected → explicitly record "not verified on mobile" (ticket item 6 + release notes).
5. Perf: instrument routing pass wall-time on dense fixture (console.time); STOP for human if not well under elk+d3.
