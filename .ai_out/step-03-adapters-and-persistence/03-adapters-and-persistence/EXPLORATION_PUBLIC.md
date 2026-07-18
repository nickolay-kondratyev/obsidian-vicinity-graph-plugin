# EXPLORATION — Step 03: Obsidian Adapters + Persistence (PUBLIC)

Explored 2026-07-17 on branch `03-adapters-and-persistence` (clean). Sources: step-03 doc, high-level plan (Phases 2–3), `src/engine/*` public surface, `submodules/obsidian-id-lib`, `src/main.ts` + `src/view/*`, test/build config, step-02 public AI-out docs.

## 1. Step-03 requirements summary

From `docs-internal/plan/steps/step-03-adapters-and-persistence.md` (covers high-level-plan Phases 2 + 3):

**Link providers (Phase 2)**
- `ObsidianLinkProvider`: outgoing via `metadataCache.resolvedLinks`; incoming via `getBacklinksForFile` per visited node (cost bounded by node cap, not vault size).
- Canvas capability detection at graph build time: does `resolvedLinks` contain `.canvas` keys? Yes → canvas edges flow through the normal path, our parser never runs. No → fallback canvas provider parses `.canvas` JSON (file-type nodes only; text-node wikilinks skipped in V1).
- Devtools verification task: record in the step doc's planning notes what the user's install actually indexes (target install is on obsidian ≥ 1.12.4 where canvas is core-indexed — see `src/main.ts` comment and `manifest.json` `minAppVersion: "1.12.4"`).
- Fixtures: canvas JSON files for the fallback parser AND provider variants with canvas entries deliberately absent (exercise detection). Fallback path = known stale-data risk → dedicated coverage. Malformed canvas JSON must not throw (matches lib philosophy).

**Doc identity (submodule)**
- Wire via `DocIdServices.createDefault(app.vault)` (lock included, REQUIRED).
- `getDocId` (read-only, lock-free) on ALL bulk/read paths (graph builds, sweeps) — never trigger writes.
- `ensureDocId` (lock-guarded) ONLY on explicit write intent (pin, per-doc setting change). Never ensure vault-wide.
- `ensureDocId` may return `null` → doc cannot be pinned / carry per-doc settings; surface gracefully, don't throw.
- Filename safety: doc-data files are `<docid>.json`; foreign-format ids are honored as-is upstream → validate docid filename safety; define behavior for unsafe ids (hash-encode or refuse with a notice).
- Canvas ids live at `metadata.frontmatter.id` — handled entirely by the lib; we never parse for ids.

**Persistence (Phase 3)**
- All JSON; **every persisted shape carries `version` from day one**.
- `data.json` via `saveData`/`loadData`: global settings + pinned set (pinned docids + pin timestamps for recency tiebreaker).
- Per-doc settings: one file per doc at `.obsidian/plugins/<id>/doc-data/<docid>.json` via `vault.adapter.write` (sync-friendly).
- Per-doc shape: own depth settings + `centralDepths` map keyed by docid.
- Pin-on-toggle at this layer: explicit view change writes the per-doc field even when equal to global default; absence = inherit; per-field, never per-doc snapshots.
- Delete handling: `vault.on('delete')` + in-memory path→docid map.
- Orphan sweep: validates doc-data files, pinned docids, `centralDepths`; delayed start ~15s after plugin load; chunked with yields (batch, `await sleep(0)`, continue).

**Out of scope:** rebuild pipeline/debouncing (step-04), settings UI (step-06) — this step exposes typed load/save APIs only.

**Exit criteria:** engine renders correct graphs from a real vault through `ObsidianLinkProvider` (debug command / console harness); persistence round-trips in dev vault; sweep observed delayed + chunked; vitest coverage; adapters thin (branching logic extracted into pure tested functions).

**Step-doc open items for step-level planning:** (1) devtools canvas-indexing result; (2) path→docid map lifecycle (lazy vs warmed by sweep); (3) rename handling — `vault.on('rename')` for the in-memory path map (docids make renames a persistence non-event); (4) `centralDepths` cleanup on unpin: immediate vs leave-to-sweep (step doc lean: leave to sweep).

## 2. Engine interfaces to satisfy (exact TS, from `src/engine/`)

Barrel: `src/engine/index.ts` — import everything from there. Engine is pure/sync; `importGuard.test.ts` greps `src/engine/` and FAILS on any `obsidian` / `obsidian-id-lib` / `react` import (incl. dynamic/require/side-effect). **Adapters must live OUTSIDE `src/engine/`** (suggest `src/adapters/`, `src/persistence/` or similar).

### LinkProvider (the sole seam) — `src/engine/LinkProvider.ts`
```ts
export interface FileMetadata {
	readonly folder: FolderPath;          // "" = vault root
	readonly sizeBytes: number;
	readonly isNodeBearing: boolean;      // adapter rule: .md + .canvas
	readonly attachments: readonly AttachmentRef[]; // non-node-bearing refs, in reference order
}
export interface LinkProvider {
	getOutgoingLinks(path: VaultPath): readonly VaultPath[]; // resolved targets, reference order; may include non-node-bearing
	getIncomingLinks(path: VaultPath): readonly VaultPath[];
	getFileMetadata(path: VaultPath): FileMetadata | undefined; // undefined = unknown to vault
}
```
**Synchronous by binding decision (step-02 CLARIFICATION Q2):** adapters index up-front (async construction), then answer sync. Q2 also pre-approved: fallback canvas parsing may cache parse results by mtime; the fallback parser is dormant on ≥ 1.12.4.

### Branded types — `src/engine/types.ts`
```ts
export type VaultPath = string & { readonly __brand: "VaultPath" };
export type DocId = string & { readonly __brand: "DocId" };     // opaque, NO format assumptions
export type FolderPath = string & { readonly __brand: "FolderPath" };
export function asVaultPath(path: string): VaultPath;
export function asDocId(docid: string): DocId;
export function asFolderPath(folder: string): FolderPath;
export interface AttachmentRef { readonly path: VaultPath; readonly isImage: boolean; }
```

### Descriptors & settings shapes (persisted by step-03, resolved by engine)
```ts
export interface CentralNodeDescriptor {
	readonly path: VaultPath;
	readonly docid?: DocId;
	readonly pinTimestamp?: number;       // epoch ms, pinned centrals only
}
export interface PinnedNodeDescriptor extends CentralNodeDescriptor {
	readonly docid: DocId;                // REQUIRED by contract (see §6, Q1)
	readonly pinTimestamp: number;
}
export interface DepthSettings  { readonly outgoingDepth: number; readonly incomingDepth: number; }
export interface DepthOverride  { readonly outgoingDepth?: number; readonly incomingDepth?: number; } // absence = inherit
export interface SizingMetricSetting { readonly enabled: boolean; readonly weight: number; }
export type SizeMetricId = "own-file-size" | "total-linker-size" | "backlink-count" | "outlink-count" | "depth-decay";
export interface SizingSettings {
	readonly metrics: Readonly<Record<SizeMetricId, SizingMetricSetting>>;
	readonly depthDecayK: number; readonly minPx: number; readonly maxPx: number;
}
export type EdgeVisibilityMode = "walked-from-center" | "all-edges";
export interface ViewSettings {
	readonly nodeCap: number; readonly groupByFolder: boolean;
	readonly edgeVisibility: EdgeVisibilityMode; readonly sizing: SizingSettings;
}
export type ViewSettingsOverride = Partial<ViewSettings>; // sizing is ONE field in V1 (per-field pinning of metrics deferred)
```

### Engine entry point — `src/engine/NeighborhoodEngine.ts`
```ts
export interface GraphBuildRequest {
	readonly main: CentralNodeDescriptor;
	readonly pinned?: readonly PinnedNodeDescriptor[];
	readonly globalDepths: DepthSettings;
	readonly depthOverridesByRoot?: ReadonlyMap<VaultPath, DepthOverride>; // PATH-keyed!
	readonly globalView: ViewSettings;
	readonly mainViewOverride?: ViewSettingsOverride;
	readonly pinnedViewOverrides?: readonly PinnedViewOverride[];
}
export class NeighborhoodEngine {
	constructor(provider: LinkProvider);
	build(request: GraphBuildRequest): NeighborhoodGraph; // sync
}
// ViewSettingsResolver.ts
export interface PinnedViewOverride { readonly descriptor: PinnedNodeDescriptor; readonly override: ViewSettingsOverride; }
```
Output `NeighborhoodGraph` = `{ nodes: GraphNode[], edges: GraphEdge[], hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>, viewSettings: ViewSettings }`. `GraphNode` echoes `docid` untouched, so step-03/04 never re-map identities.

**Everything entering the engine is PATH-keyed** (binding, Q1): the step-03 adapter translates docid-keyed persisted data (pins, `centralDepths`, per-doc depth overrides) → paths BEFORE building `GraphBuildRequest`.

### Defaults — `src/engine/constants.ts`
`EngineDefaults.depthSettings() / .sizingSettings() / .viewSettings()` — the intended seed for step-03 persistence defaults. Constants: `DEFAULT_NODE_CAP=100`, `DEFAULT_OUTGOING_DEPTH=1`, `DEFAULT_INCOMING_DEPTH=1`, `DEFAULT_MIN_NODE_PX=40`, `DEFAULT_MAX_NODE_PX=160`, `DEFAULT_DEPTH_DECAY_K=1`, `DEFAULT_EDGE_VISIBILITY="walked-from-center"` (human-confirmed final), `CENTRAL_SIZE_SCORE=1`, `NEUTRAL_NORMALIZED_VALUE=0.5`.

### FakeLinkProvider (test reference) — `src/engine/FakeLinkProvider.ts`
`new FakeLinkProvider({ files: FakeFileSpec[], links?: Record<string, string[]> })`; node-bearing derived from extension (`md`,`canvas`), images from (`png,jpg,jpeg,gif,svg,webp`); attachments = outgoing refs to non-node-bearing files in link order; links to undeclared paths throw at construction. `ObsidianLinkProvider` must mirror these semantics (it is documented as "the test-side stand-in for step-03's Obsidian adapters"). `NodeEligibility` (exported) is the SRP owner of the node-bearing rule per CLARIFICATION Q4 — reuse it, do not re-hardcode extensions.

## 3. obsidian-id-lib integration contract (exact API)

Source of truth: `submodules/obsidian-id-lib/README.md` + `src/index.ts`. Consumed as raw TS via `"obsidian-id-lib": "file:submodules/obsidian-id-lib"` (already in package.json; bundled by our esbuild; `obsidian` external).

```ts
import { DocIdServices } from "obsidian-id-lib";
import type { DocIdService } from "obsidian-id-lib";

DocIdServices.createDefault(vault: Vault): DocIdService  // static factory; construction does NO IO

interface DocIdService {
	ensureDocId(file: TFile): Promise<string | null>; // lock-guarded read-or-create; null = unsupported format / unreadable / occupied-unusable slot
	getDocId(file: TFile): Promise<string | null>;    // READ-ONLY, lock-free, never writes — the bulk-path call
	isEligible(file: TFile): boolean;                 // 'md' (incl. .excalidraw.md) or 'canvas'
}
```
Also exported (not normally needed): `DocIdServiceDefault`, `FrontmatterDocIdStore`, `CanvasDocIdStore`, `DocIdGeneratorDefault` (+`DOC_ID_PREFIX/SUFFIX/RANDOM_LENGTH`), `VaultFileContentAccess` / `FileContentAccess`, `CrossPluginPathLock` / `PathLock` / `ID_LOCK_REGISTRY_KEY`, `DocIdValues` / `ExistingIdState`, `DocIdStore`.

Key contract facts:
- Both `getDocId`/`ensureDocId` take an Obsidian **`TFile`** (not a path) — adapter must resolve `vault.getFileByPath(...)`/`getAbstractFileByPath` first.
- Both are **async** (Promise) — while the engine is sync. Docid resolution therefore happens OUTSIDE the build (at pin time / persist time / map warm-up), never inline in `LinkProvider` queries.
- Generated id format `docid_{24 base36 lowercase}_e`, BUT **existing ids of ANY foreign format are honored as-is** (README explicitly: "Consumers that use ids as filenames should validate filename safety themselves").
- Malformed canvas JSON → `console.error` + `null`, never throws. Empty canvas = new canvas, gets an id.
- Cross-plugin lock rides `window[ID_LOCK_REGISTRY_KEY]` (`__obsidian_id_lib_path_lock_registry_v1__`); already wired inside `createDefault` — nothing extra needed, just never bypass `ensureDocId`.
- `main.ts` already constructs `DocIdServices.createDefault(this.app.vault)` into `private docIdService` (step-01 smoke wiring, comment says "step-03 decides final visibility").

## 4. Current plugin lifecycle & hook points

- `src/main.ts` — `NeighborhoodGraphPlugin extends Plugin`; `onload()`: creates `docIdService`, `registerView(VIEW_TYPE_NEIGHBORHOOD_GRAPH, ...)`, adds `open-neighborhood-graph` command with `activateView()` (right leaf). **No `saveData`/`loadData` usage anywhere yet; no `vault.on` handlers; no settings tab.** All step-03 hooks (loadData at onload, delete/rename listeners via `this.registerEvent`, delayed sweep timer via `this.registerInterval`/`setTimeout`) attach here.
- `src/view/NeighborhoodGraphView.tsx` — thin `ItemView` mounting React 18 `HelloGraph` (placeholder); untouched by step-03 except possibly a debug harness.
- Plugin id `obsidian-neighborhood-graph` (asserted by `src/manifest.test.ts`) → doc-data dir is `.obsidian/plugins/obsidian-neighborhood-graph/doc-data/`. `this.manifest.id`/`this.manifest.dir` available at runtime; esbuild copies artifacts into `.dev-vault/.obsidian/plugins/<id>/` (dev vault at `.dev-vault/` with note1.md/note2.md — the real-vault exit-criteria testbed).
- `minAppVersion` 1.12.4 = first public release with core canvas link indexing (WHY comment in main.ts) — the canvas-capability detection should usually take the "yes" branch on target installs.

## 5. Test infrastructure & patterns

- Root `vitest.config.ts`: `include: ["src/**/*.test.{ts,tsx}"]`, colocated tests, **NO obsidian alias/mock at root** — all current root tests are pure. Step-03 tests that touch obsidian types need either (a) a root-level `test.alias` for `obsidian` → a runtime mock (pattern exists in the sublib: `submodules/obsidian-id-lib/vitest.config.ts` aliases to `src/testSupport/obsidianMock.ts` with minimal `TAbstractFile`/`TFile` classes), or (b) adapters designed so tested logic never imports `obsidian` (pure functions fed plain data — the step doc mandates "anything with branching logic gets extracted to a pure, tested function", which mostly enables (b)).
- Scripts: `test` = `vitest run && npm run test:sublib`; `check` = `tsc -noEmit` (strict, `noUncheckedIndexedAccess`, `isolatedModules` → use `export type` for type re-exports). Env note from step-02: use `/usr/local/bin/npm` explicitly (bare `npm` wrapper intermittently exits 1).
- Style: BDD GIVEN/WHEN/THEN — GIVEN as a comment above/inside `describe`, test names `"WHEN ... THEN ..."`, mostly one assert per test; declarative fixtures via `FakeLinkProvider` spec objects; helper factory functions in-file (e.g. `pinned(...)` in `settingsResolvers.test.ts`).
- Current counts: root 136 tests / 10 files, sublib 69 / 6 files — all green at branch start.

## 6. Prior step-02 decisions binding on step-03 (from CLARIFICATION__PUBLIC / ITERATION__PUBLIC)

- **Q1 (identity):** engine path-keyed; docids opaque, echoed through. Adapter translates docid-keyed persistence → paths pre-build. **Contract: a doc receiving a pin or ANY per-doc override MUST have a docid — `await ensureDocId(...)` BEFORE persisting; `null` → cannot pin / cannot carry per-doc settings** (engine types enforce via `PinnedNodeDescriptor.docid` being required).
- **Q2 (sync LinkProvider):** async construction/indexing, sync queries. Canvas-fallback upfront parse cost accepted; mitigate by caching parse results by mtime.
- **Q4 (eligibility):** node-bearing = `.md` + `.canvas`; adapter owns the real rule; SRP class `NodeEligibility` exists in the engine exports.
- **Q5 (edge visibility):** `walked-from-center` default (final, human). Persistence must round-trip `edgeVisibility` as part of `ViewSettings`/overrides; UI toggle is step-06.
- ITERATION note (finding 4): path-parsing duplication (`titleOf` vs `extensionOf`/`folderOf`) was left in place with "revisit when step-03 adds real path handling" — if step-03 introduces a third path-parsing consumer, extract a shared helper.

## 7. Open questions / ambiguities spotted

1. **`getBacklinksForFile` is NOT in the public obsidian type declarations** (checked `node_modules/obsidian/obsidian.d.ts`, v1.13.1 — no `Backlink`/`getBacklinksForFile` symbol; `MetadataCache.resolvedLinks: Record<string, Record<string, number>>` IS public). The step doc and high-level plan both mandate `getBacklinksForFile` for incoming links. Implementation will need a narrow typed wrapper over the untyped API (its known runtime shape returns a structure whose `.data` maps source path → link references) isolated in one adapter file. Alternative: derive incoming links by inverting `resolvedLinks` (public API, O(vault) per build). `#QUESTION_FOR_HUMAN:` OK to call the undocumented `metadataCache.getBacklinksForFile` through a single typed cast (per plan), with a fallback/behavior decision if it's absent at runtime — or prefer inverting the public `resolvedLinks` despite O(vault) cost?
2. **Reference order vs `resolvedLinks`:** `LinkProvider.getOutgoingLinks` and `FileMetadata.attachments` are contractually "in reference order", but `resolvedLinks` is a `Record<target, count>` — key insertion order is not a documented ordering guarantee, and counts collapse duplicates. `metadataCache.getFileCache(file).links/embeds` gives true reference order for markdown. Implementer should decide: treat `resolvedLinks` key order as good enough (thin adapter) or use `getFileCache` for ordering (esp. for `firstImagePath` correctness, which drives thumbnails). Not human-blocking; note the tradeoff in the plan.
3. **Async boundary for docid maps:** `getDocId` is async and per-`TFile`; the sweep and pin/persist paths are async anyway, but building the path→docid map "warmed by the sweep" vs "lazily as docs are visited" is step-doc open item #2 — needs a decision in planning (the delayed chunked sweep is a natural warm-up point).
4. **Unsafe-docid filename policy** left open by the step doc ("hash-encode or refuse per-doc persistence with a notice") — planning must pick one; refusal-with-notice is simpler (80/20) but hash-encoding keeps foreign-id vaults fully functional.
5. **Where step-03 code lives:** no prescribed directory; `src/engine/` is off-limits (import guard). Suggest `src/adapters/` + `src/persistence/` (or one `src/obsidian/`), mirroring the engine's class-per-file SRP layout.
6. **Root vitest obsidian mock:** adding a root-level `obsidian` alias (copying the sublib's minimal-mock pattern) is likely needed the moment any tested step-03 file imports `TFile`/`Vault` types with runtime checks; type-only imports need no mock. Decide in planning; not human-blocking.

## 8. Key file paths (all absolute)

- Step doc: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/docs-internal/plan/steps/step-03-adapters-and-persistence.md`
- High-level plan: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/docs-internal/plan/high-level-plan.md`
- Engine barrel (import surface): `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/src/engine/index.ts`
- Seam + types + defaults: `.../src/engine/LinkProvider.ts`, `.../src/engine/types.ts`, `.../src/engine/constants.ts`, `.../src/engine/NeighborhoodEngine.ts`, `.../src/engine/NodeEligibility.ts`
- Fake provider (semantics to mirror): `.../src/engine/FakeLinkProvider.ts`
- Import guard (keeps adapters out of engine dir): `.../src/engine/importGuard.test.ts`
- Plugin shell: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/src/main.ts`; view: `.../src/view/NeighborhoodGraphView.tsx`
- id-lib: `.../submodules/obsidian-id-lib/README.md`, `.../src/index.ts`, `.../src/DocIdService.ts`, `.../src/DocIdServices.ts`; obsidian mock pattern: `.../src/testSupport/obsidianMock.ts` + `.../submodules/obsidian-id-lib/vitest.config.ts`
- Config: `.../vitest.config.ts`, `.../package.json`, `.../esbuild.config.mjs`, `.../manifest.json` (+ `.../src/manifest.test.ts`)
- Step-02 AI-out (public): `.../.ai_out/step-02-core-engine/step-02-core-engine/{CLARIFICATION__PUBLIC.md,IMPLEMENTATION_ITERATION__PUBLIC.md,EXPLORATION_PUBLIC.md}`
- Dev vault: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/.dev-vault/`
- Follow-up ticket context: `.../docs-internal/tickets/ticket-eslint-adoption.md` (no ESLint yet — import guard is a test); `.../docs-internal/CHANGELOG.md` (steps add entries during ITERATION phase)
