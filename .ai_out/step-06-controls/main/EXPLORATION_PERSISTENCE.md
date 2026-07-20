# Persistence & Settings-Write Layer — Exploration for step-06-controls

## 1. `src/persistence/*` — data shapes

**`src/persistence/persistedShapes.ts`** defines everything persisted, versioned (`PERSISTED_SHAPE_VERSION = 1`).

- `PluginData` (data.json shape, `persistedShapes.ts:35-40`):
  ```ts
  { version, globalDepths: DepthSettings, globalView: ViewSettings, pins: readonly PinnedDocEntry[] }
  ```
  `PinnedDocEntry = { docid, pinTimestamp }` (`:29-32`).
- `DocData` (one `doc-data/<docid>.json` file, `persistedShapes.ts:47-55`):
  ```ts
  { version, depths?: DepthOverride, view?: ViewSettingsOverride, centralDepths?: Record<docid, DepthOverride> }
  ```
  All three fields are **optional** — absence = inherit, presence = pinned (per-field, never whole-doc snapshots).
- **`centralDepths`**: on a doc that has served as MAIN, a map keyed by *pinned central's docid* → that central's depth override *as adjusted while this doc was MAIN* (`persistedShapes.ts:53`). It lives inside the MAIN doc's own `DocData`, not the central's. This is the field step-06's "adjust a pinned central's depth while at MAIN Y" writes into (Y's file).
- Storage locations: `data.json` via `saveData`/`loadData` (global + pins) vs. `.obsidian/plugins/<id>/doc-data/<docid>.json` per doc (`main.ts:93-97` builds dir path; NOT frontmatter — separate JSON file per doc, written with `vault.adapter`).
- Parsers never throw; unrecognized/foreign-version content silently degrades to defaults (`PluginData`) or `null` (`DocData`) — `persistedShapes.ts:77-102`.
- `sizing` is parsed/replaced as ONE whole field (`parseSizing`, `:146-162`); partial persisted sizing is repaired against `EngineDefaults.viewSettings().sizing`.

**`DocDataStore.ts`**: one file per docid, serialized read-modify-write queue per docid (`:99-106`); file deleted (not `{}`) when `DocDataMutations.isEmpty` (`:42-53`). Throws if handed a filename-unsafe docid — callers must pre-classify via `DocPersistEligibility` (`:77-82`).

**`DocDataMutations.ts`** — the pure per-field mutation contract:
- `setDepthField(doc, field, value|undefined)` — own depth override (`:11-13`).
- `setViewField(doc, field, value|undefined)` — own view override (`:15-21`).
- `setCentralDepthField(doc, centralDocid, field, value|undefined)` — writes into `centralDepths[centralDocid]`, deletes the per-central entry once its override object is empty (`:23-37`).
- `withoutCentralDepths(doc, staleCentralDocids)` — sweep cleanup only (`:40-46`).
- `isEmpty(doc)` — drives delete-file-instead-of-`{}` (`:49-51`).
- Internal `setOrRemove`/`normalized` implement "value → write field; `undefined` → delete field; empty sub-object → omit it" (`:54-74`). **This is exactly the pure, unit-testable "what field gets written where" layer** step-06 testing asks for — already exists, fully covered by `DocDataMutations.test.ts`.

**`PluginDataStore.ts`** — typed owner of `data.json`, in-memory state + serialized write chain (`:58-64`, last-write-wins). API: `globalDepths()`, `globalView()`, `pins()`, `hasPin(docid)`, `saveGlobalDepths`, `saveGlobalView`, `addPin(docid, pinTimestamp)` (re-pin refreshes timestamp, `:47-51`), `removePins(docids)`.

**`PersistenceServices.ts`** — the doc-scoped write-intent facade steps 04/06 should call (NOT `DocDataStore`/`PluginDataStore` directly for doc-scoped writes):
- `pinDoc(file)` → `addPin` (`:28-30`)
- `unpinDoc(docid)` → `removePins([docid])` (`:32-35`)
- `setDocDepthField(file, field, value)` (`:38-44`)
- `setDocViewField(file, field, value)` (`:46-53`)
- `setCentralDepthField(mainFile, centralDocid, field, value)` — per-central-depth-at-MAIN write step-06 needs (`:56-65`)
- Every entry point funnels through `withPersistableIdentity` (`:77-87`), the **only** call site of `ensureDocId` in this layer; returns a `PersistableIdentity` verdict. Global-settings calls (no doc) bypass this and go straight to `PluginDataStore`.

**`PathDocIdMap.ts`** — in-memory bidirectional path↔docid map; warmed by sweep + lazily filled; kept fresh by `main.ts` rename/delete handlers (`main.ts:99-124`). `withPersistableIdentity` calls `pathDocIdMap.set(file.path, docid)` on every successful write (`PersistenceServices.ts:83`).

Persistence layer reuses engine types (`DepthOverride`, `ViewSettingsOverride`, `SizingSettings`, `SizeMetricId`, `EdgeVisibilityMode` from `src/engine/types.ts`) — no duplicate shapes.

## 2. Cascade resolvers — absence/presence semantics

**`TraversalSettingsResolver.ts`** (`:11-18`): single-layer per-root: `override?.field ?? global.field`. `0` is honored (`??` only falls through on `undefined`) — test `settingsResolvers.test.ts:38-40` ("presence = pinned" even for value `0`).

**`ViewSettingsResolver.ts`** (`:28-53`): 3-layer per-field cascade for `nodeCap`, `groupByFolder`, `edgeVisibility`, `sizing`: `mainOverride[key] ?? firstDefinedAmong(rankedPinnedOverrides)[key] ?? global[key]`. Pinned-doc conflicts broken by `NodePriorityChain` (minDepth 0, `CENTRAL_SIZE_SCORE`, pin recency, docid lexicographic — `:55-64`). `sizing` replaces wholesale when present at any layer (test `:91-94`).

**Absence-vs-presence mechanics**: TypeScript optional fields + `??`/find-first-defined. No separate "reset" flag — `DocDataMutations.setDepthField(doc, field, undefined)` deletes the key, so resolver `override?.field` becomes `undefined` and falls through to global. **Reset-to-global = calling `PersistenceServices.setDoc*Field`/`setCentralDepthField` with `value = undefined`.** No separate reset API needed.

**Per-direction depth shape**: `DepthSettings { outgoingDepth, incomingDepth }` (resolved) / `DepthOverride { outgoingDepth?, incomingDepth? }` (partial) — `types.ts:137-146`. Independent per direction at every layer.

## 3. `ensureDocId` / `DocIdPort` / write-intent moment

`DocIdPort` (`src/adapters/obsidianPorts.ts:63-69`): `ensureDocId(file)` (lock-guarded read-or-create, write-intent) vs `getDocId(file)` (read-only) vs `isEligible(file)`.

Only call site: `PersistenceServices.withPersistableIdentity` (`:77-87`):
```ts
const identity = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(file));
if (identity.kind === "persistable") { pathDocIdMap.set(...); await persist(identity.docid); }
return identity;
```
Step-06 UI calling `pinDoc`/`setDoc*Field`/`setCentralDepthField` IS the ensureDocId moment — never call `ensureDocId` directly.

**`null`/unusable case** — `DocPersistEligibility.classify` (`:32-40`) turns `null` → `{ kind:"not-persistable", reason:"no-docid" }`, filename-unsafe docid → `{ kind:"not-persistable", reason:"unsafe-docid" }`. **Step-06 must branch on `identity.kind` and surface a user-visible notice on `"not-persistable"`** (step-06 doc line 28). No such UI exists yet.

## 4. Pinned-set location

`PluginData.pins: readonly PinnedDocEntry[]` in `data.json` (`:39`), managed via `PluginDataStore.pins()/hasPin()/addPin()/removePins()`. Written on every `pinDoc`/`unpinDoc` and `main.ts:118-120` live-delete cleanup. Persists via `saveData` write chain; survives restart via `loadData`/`init()` (`main.ts:41-42`). Sweep (`OrphanSweeper.ts`) drops stale pins/`centralDepths` whose docs no longer resolve (`main.ts:126-148`).

## 5. Settings types & defaults (`types.ts`, `constants.ts`)

- `SizingSettings` (`types.ts:162-168`): `metrics: Record<SizeMetricId, SizingMetricSetting>`, `depthDecayK`, `minPx`, `maxPx`. `SizeMetricId` = `"own-file-size" | "total-linker-size" | "backlink-count" | "outlink-count" | "depth-decay"`. `SizingMetricSetting = { enabled, weight }`.
- `ViewSettings` (`:171-177`): `{ nodeCap, groupByFolder, edgeVisibility, sizing }`. `ViewSettingsOverride = Partial<ViewSettings>`.
- **`EngineDefaults`** (`constants.ts:37-69`) single source of truth: `depthSettings()`→`{1,1}`; `sizingSettings()`→ only `own-file-size` enabled, weight 1, `depthDecayK=1`, `minPx=40`, `maxPx=160`; `viewSettings()`→ `nodeCap=100`, `groupByFolder=true`, `edgeVisibility="walked-from-center"`.
- Constants: `DEFAULT_NODE_CAP=100`, `DEFAULT_OUTGOING_DEPTH=DEFAULT_INCOMING_DEPTH=1`, `DEFAULT_MIN_NODE_PX=40`/`DEFAULT_MAX_NODE_PX=160`, `DEFAULT_DEPTH_DECAY_K=1`. No stepper min/max bound constants exist beyond these; depth 0 valid/honored, no explicit max enforced.
- No `PluginSettingTab` subclass exists anywhere in `src/` — step-06 greenfield for settings tab.

## 6. Existing pure write-contract functions vs missing

**Already exists + unit-tested**: `DocDataMutations`, `TraversalSettingsResolver`/`ViewSettingsResolver` (`settingsResolvers.test.ts`), `PersistenceServices`, `DocPersistEligibility.classify`, `GraphRequestAssembler` (read-side translator: merges `{...ownDepths, ...mainAdjusted}` where `mainAdjusted = mainDocData.centralDepths[pin.docid]` wins per-field, `:80-82`), `NeighborhoodGraphBuilder.ts` (`:46-68`, loads pins/mainDocData/docDataByDocid/globals per build).

**Missing / step-06's job** (confirmed none exist today):
- No UI in `src/view/` for pin/pinning, per-central depth steppers, sizing controls, settings tab.
- No `PluginSettingTab` subclass; `main.ts` has no `addSettingTab`.
- No node-level pin/unpin context-menu or hover button (pattern to mirror: `src/view/attachmentMenu.ts`).
- `GraphViewController.ts` has zero references to `PersistenceServices` — view layer calls no write API yet. Step-06 must wire controller/toolbar to `PersistenceServices.*` + `PluginDataStore.saveGlobalDepths/saveGlobalView`, then trigger rebuild via `GraphViewController`/`RebuildDecision.ts`.
- No pure "central selector list" builder (MAIN + pinned centrals with resolved per-direction depths + inherited-vs-pinned flag). `GraphNode.depthTags`/`isCentral`/`isMain` (`types.ts:73-96`) + `PinnedNodeDescriptor` (`:67-70`) are raw materials, but no function derives "was this field inherited or pinned" — the engine returns resolved `depthTags`, not override-presence. **Genuine gap step-06 must design**: either expose "was this field pinned" per central, or a small view-layer pure fn diffing loaded `DocData` against resolved settings.

## Summary
- Persistence write layer (`DocDataMutations`, `PersistenceServices`, `PluginDataStore`) already implements the per-field pin-on-toggle / absence-as-reset contract, fully tested. `PersistenceServices.setCentralDepthField(mainFile, centralDocid, field, value)` is the precise "adjust pinned central's depth while at MAIN Y" API.
- `ensureDocId` centralized in `PersistenceServices.withPersistableIdentity`; step-06 UI always goes through `PersistenceServices`, must handle `"not-persistable"` verdict with a notice (none exists yet).
- Step-06 is greenfield for all UI: no `PluginSettingTab`, no toolbar, no pin affordance, no "inherited vs pinned" display-flag derivation. Read-side + write-side plumbing complete and tested.
