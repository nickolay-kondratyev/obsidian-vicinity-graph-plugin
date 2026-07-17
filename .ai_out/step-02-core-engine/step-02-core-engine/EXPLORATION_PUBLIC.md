# EXPLORATION — Step 02: Core Engine

Pure, fully-tested engine for the neighborhood-graph plugin. No `obsidian` imports, no persistence, no React. All paths relative to repo root.

## Repo conventions (build/test/TS)

- **tsconfig.json**: `strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, **`noUncheckedIndexedAccess`** (indexed access yields `T | undefined` — engine code must guard), `isolatedModules` (type-only re-exports must use `export type`), `module: ESNext`, `target: ES2021`, `moduleResolution: node`, `resolveJsonModule`, `jsx: react-jsx`, `noEmit`, `lib: ["ES2021","DOM"]`. `include: ["src/**/*.ts","src/**/*.tsx"]`.
- **vitest.config.ts**: `test.include: ["src/**/*.test.{ts,tsx}"]` — tests colocated with source under `src/`. Submodule suite runs separately via `npm run test:sublib`.
- **package.json** scripts: `dev` (esbuild watch), `build` = `npm run check && esbuild production`, `check` = `tsc -noEmit`, `test` = `vitest run && npm run test:sublib`, `test:watch` = `vitest`. `"type": "module"`. Deps: `obsidian-id-lib` (file:), react/react-dom ^18.3.1. Dev: esbuild ^0.25.5, obsidian latest (types-only), typescript ^5.8.3, vitest ^4.1.10.
- **esbuild.config.mjs**: `obsidian`/electron/@codemirror/@lezer/node-builtins are external; `obsidian-id-lib` is deliberately NOT external (raw TS bundled by us). Engine code has no bundling concerns since it avoids obsidian.
- **No ESLint yet** — open ticket `docs-internal/tickets/ticket-eslint-adoption.md` (adopt ESLint 9 flat + eslint-plugin-obsidianmd later). So the step-02 "zero obsidian imports" guard should be enforced by **a vitest test that greps imports** (lint rule not available yet). Step-02 exit criteria explicitly permits "a lint rule OR a test that greps imports."
- Env note (from step-01 public doc): bare `npm` wrapper intermittently exits 1 with no output; use `/usr/local/bin/npm` explicitly in Bash.

## Existing code map (`src/`)

- `src/main.ts` — Plugin; constructs `DocIdServices.createDefault(this.app.vault)` (smoke only), registers view + "Open neighborhood graph" command. `docIdService` private; real consumers in step-03.
- `src/view/NeighborhoodGraphView.tsx` — `ItemView`, view type const `VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view"`, createRoot/unmount lifecycle.
- `src/view/HelloGraph.tsx` — placeholder React component.
- `src/manifest.test.ts` — the only test; the BDD style template to mirror.
- No `src/engine/` (or similar) directory exists yet — step-02 creates it. Suggested convention: an engine directory (e.g. `src/engine/` or `src/core/`) so the import-guard test can target one path.

## obsidian-id-lib API (docid identity — for the traversal↔persistence mapping)

Source of truth: `submodules/obsidian-id-lib/README.md` and `src/DocIdService.ts`. Public API is `src/index.ts`. **Relevant note for step-02: the engine is pure and must NOT import obsidian-id-lib** (it imports `obsidian`'s `TFile`). The engine defines its own id/path types; step-03 wires the lib. Key facts that constrain the engine's identity types:

- `interface DocIdService` methods (all take `TFile`): `ensureDocId(file): Promise<string | null>` (lock-guarded, write intent only), `getDocId(file): Promise<string | null>` (read-only, lock-free — used on bulk/graph-build/sweep paths), `isEligible(file): boolean` (md/canvas only).
- **docid is a `string`** of form `docid_{24 base36 lowercase}_e`; but **existing foreign-format ids are honored as-is** (incl. legacy uppercase `docid_{21 base62}_E`) — so a docid is an opaque string, NOT guaranteed to match the canonical regex, and NOT guaranteed filename-safe (step-03's problem, but the engine's docid type should be a plain opaque `string`/branded type, no format assumptions).
- `ensureDocId` can return `null` → a doc without an id cannot be pinned / carry per-doc settings. Engine's central-node/pin descriptors should tolerate that docids are supplied by the adapter layer.
- Eligibility: only `md` and `canvas` extensions carry ids (matches "non-markdown files are never nodes"; canvas is a node-bearing doc). Raw `.excalidraw` unsupported; `.excalidraw.md` counts as md.
- Other exports (not needed by engine): `DocIdServiceDefault`, `DocIdServices.createDefault`, stores, generator, `CrossPluginPathLock`, `ID_LOCK_REGISTRY_KEY`.

**Identity mapping decision for step-02 (open item #3 in the step doc):** traversal keys on **file path** (what Obsidian's `resolvedLinks`/backlinks give); persistence keys on **docid**. Define a node-identity type here that carries path as the traversal key and lets the adapter attach a docid. The engine should treat "node id" as path-based during BFS and expose a mapping so step-03/04 can associate docids.

## What steps 03/04 expect from the engine (OCP seam requirements)

From `step-03-adapters-and-persistence.md`:
- The engine's **`LinkProvider` interface is the sole Obsidian seam**. Step-03 implements `ObsidianLinkProvider` (outgoing via `resolvedLinks`, incoming via `getBacklinksForFile` per node) AND a fallback canvas provider — both must satisfy the SAME `LinkProvider` interface **with no interface change** (step-02 open item #1: "design so the canvas-fallback provider composes without interface change (OCP)"). So `LinkProvider` methods must be shaped around what Obsidian actually returns (path-keyed link maps; per-file metadata: folder, byte size, attachment list).
- Persistence layer supplies: global settings + pinned set (pinned **docids with pin timestamps** for the recency tiebreaker), per-doc settings (own depth + `centralDepths` map keyed by docid). The engine's **settings resolver** and **truncation comparator** consume these — so the engine must define the settings shapes (depth settings, view settings: sizing/grouping/cap) and the central-node descriptor (docid + pin timestamp + per-root depth).
- Every persisted shape carries a `version` field — but versioning lives in the persistence layer; engine types should be plain domain types.

From `step-04-view-shell.md`:
- Consumes a **stable, tested engine** producing nodes+edges to map into React Flow / elkjs. Needs: node data (title, size score, folder identity, attachments/first-image, depth tags, minDepth), edge data (direction, collapsed count). Step-04 does **structural diff** and `SIZE_RELAYOUT_THRESHOLD` (named const, 1.0) checks against the engine's computed node sizes — so node size must be a stable computed field the view can diff.
- `isEligible` (from the lib) gates MAIN tracking (md/canvas only) — engine's central-node concept must align.

**Engine public API must be documented succinctly (step-02 exit criteria)** so 03/04 consume it without reading implementations.

## Step-01 decisions that constrain step-02

- **Test style: BDD GIVEN/WHEN/THEN, one assert per test where practical** (established in `manifest.test.ts`, reaffirmed in step-02 doc).
- Colocated `*.test.ts` under `src/`, run by root vitest.
- Strict TS incl. `noUncheckedIndexedAccess` — engine map/array access needs undefined-guards.
- Tabs for indentation (see existing files), double-quote imports.
- React pinned to ^18 (irrelevant to pure engine, but don't pull React into engine).
- `minAppVersion` 1.12.4 (canvas link indexing core) — informs that on modern installs canvas edges flow through `resolvedLinks` (fallback parser dormant); the `LinkProvider` seam must not assume canvas-specialness.
- Engine directory should be import-guard-clean: no `obsidian`, no `obsidian-id-lib`, no react.

## Test-style example (existing BDD, mirror this)

From `src/manifest.test.ts`:
```ts
import { describe, expect, it } from "vitest";
describe("manifest.json", () => {
  it("WHEN read THEN the plugin id is the approved 'obsidian-neighborhood-graph'", () => {
    expect(manifest.id).toBe("obsidian-neighborhood-graph");
  });
});
```
`describe` = subject/GIVEN context (often with a `// GIVEN ...` comment above), `it("WHEN ... THEN ...")`, single `expect`. Fixtures for the engine expressed as `FakeLinkProvider` data (diamonds, cycles, bidirectional, disconnected pinned neighborhoods, attachment-heavy notes).

## Change-log & ticket conventions

- **CHANGELOG** (`docs-internal/CHANGELOG.md`): reverse-chronological; entry header `## YYYY-MM-DD — <step-slug>: <short title>`; body links the step + phase via wiki-links (`[[plan/steps/step-02-core-engine]]`, `[[plan/high-level-plan]]`), bulleted summary, a "Verified:" line, and follow-up ticket links. Add a step-02 entry on completion.
- **Tickets** (`docs-internal/tickets/*.md`): filename `ticket-<slug>.md`; fields `**Status:** OPEN`, `**Origin:** <step>`, body describing the follow-up, `Related:` cross-refs. No dedicated `tk` CLI convention is documented anywhere in the repo (searched docs-internal — none found); tickets are plain markdown files.
- Wiki-link style (`[[...]]`) used throughout plan/changelog docs (Obsidian vault convention).
- Git: feature branch per step (`step-01-scaffold`), commits prefixed `step-NN-slug:`, merged to main. This step: `step-02-core-engine` branch.

## Open questions / risks

1. **Depth-tag storage** (step-02 open item #2): full per-root×per-direction maps vs. just minDepth + the per-root values the UI steppers need. Memory vs. UI: step-06 needs per-central depth steppers, so at least per-root depth must survive; minDepth drives sizing/truncation. Lean: store per-root/per-direction depth AND precompute minDepth.
2. **LinkProvider signature** must be future-proof for the canvas fallback (OCP) — shape around path-keyed maps + per-file metadata (folder, byte size, attachment paths). Avoid canvas-specific methods.
3. **Node identity type**: path is the traversal key (Obsidian-provided), docid is the persistence key. The engine likely shouldn't resolve docids itself (that needs obsidian-id-lib/TFile) — it should key on path and let adapters map path→docid. Confirm whether pinned-set/centralDepths (docid-keyed) should be translated to path before entering the engine, or the engine holds both. This is the central design decision of the step.
4. **Truncation comparator reuse**: same priority chain used for truncation AND multi-pin settings-cascade conflict resolution — must be one exported comparator (DRY, per step doc). Pin-recency tiebreaker needs pin timestamps → engine central descriptor must carry them.
5. **Sizing normalization** edge cases to test: single-node graph, zero-byte notes, one huge note (log/sqrt). `depth-decay` = `1/(1 + k*depth)`; `SIZE_RELAYOUT_THRESHOLD`=1.0 is a step-04 concern but the engine's size output must be diff-stable.
6. **Named constants**: default cap `100`, `SIZE_RELAYOUT_THRESHOLD` 1.0 (step-04), debounce ~500ms (step-04). Cap default belongs in the engine.
