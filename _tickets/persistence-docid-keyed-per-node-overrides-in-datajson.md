---
closed_iso: 2026-08-04T00:18:25Z
id: nid_lwionnvohw9k58jw7a2dybht2_e
title: 'persistence: docid-keyed per-node overrides in data.json'
status: closed
deps: [nid_o5hz7ilcauwe2acqdfh6pcuam_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_qjsj5mth2phdqctbm0vfx9elw_e,
  nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e]
created_iso: '2026-08-03T23:48:47Z'
status_updated_iso: 2026-08-04T00:18:25Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, persistence]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part of the node-sizing rethink (docs-internal/plan/node-sizing-rethink.md section 4, origin nid_kyowb4v8v51nslbicl4szgcd5_e).

Add a docid-keyed nodeOverrides map to the persisted PluginData in src/persistence/persistedShapes.ts:
  nodeOverrides: { "<docid>": { sizePx?: {widthPx, heightPx}, content?: "outline"|"image" } }
(absent content = Inherit; an entry with neither field is deleted).

- Bump PERSISTED_SHAPE_VERSION (clean break, no migration - plugin unpublished; say so in release note).
- Write path lives in src/persistence/PersistenceServices.ts, the ONE ensureDocId caller: reuse the exact pin pattern - lazy ensureDocId (writes frontmatter id only when an override is actually saved), DocPersistEligibility.classify refusal with the existing notice path, runGuarded write policy from src/view/settingsWritePipeline.ts (no second failure policy).
- Read path: expose overrides to the graph build so they apply from ANY central (globally by docid).
- Precedence per decided Q3: user override vs global minPx/maxPx; override moves pixels only, never sizeScore (Q4), matching the thumbnail-floor precedent in NodeSizer.withImageSpace.

Tests: persistedShapes round-trip + parser degradation, PersistenceServices eligibility/refusal, orphan cleanup of empty entries. npm test sufficient (no view change).

## Acceptance Criteria

data.json round-trips nodeOverrides; id-less doc gets id lazily on first save; refused docs surface the existing notice; empty entries are removed.

## Notes

**2026-08-04T00:18:25Z**

RESOLVED (2026-08-04). Implemented exactly per ticket + node-sizing-rethink.md section 4:

- Shape: PluginData.nodeOverrides (docid-keyed {sizePx?: {widthPx,heightPx}, content?: "outline"|"image"}) in src/persistence/persistedShapes.ts; PERSISTED_SHAPE_VERSION 2 -> 3 (clean break, no migration; RELEASE-NOTE CALLOUT: an existing data.json re-parses as defaults - plugin unpublished). Defensive parser drops unusable fields per field and drops entries with NEITHER field; pixel boxes clamp into new hard sanity bounds NODE_OVERRIDE_HARD_MIN_PX=24 / MAX=1200 (clampNodeSizeOverridePx in src/engine/constants.ts - Q3: overrides may exceed the minPx/maxPx dials, so bounds are wider than the 1..400 dial range).
- Types live in the pure engine (src/engine/types.ts): NodeOverride, NodeSizeOverridePx, NodeContentOverride = Exclude<NodePreviewPreference,"auto"> with a completeness assert, so adding "title-only" (ticket nid_jcxzhexfaksge2arjzca3w7ff_e) is a compile error until the override list is updated.
- Write path: PersistenceServices.saveNodeOverride(file, override) - the ONE ensureDocId caller's withPersistableIdentity seam, exact pin pattern (lazy id mint on first save, DocPersistEligibility refusal verdict for the existing notice path); removeNodeOverride(docid) unconditional like unpinDoc. PluginDataStore.saveNodeOverride deletes the entry when neither field is present (reset = no orphan) and clamps sizePx at the store choke point. Wiring runGuarded around the VIEW call site belongs to the consuming tickets (no view change here).
- Read path: PluginDataStore.nodeOverrides() -> GraphRequestInputs.nodeOverrides -> GraphRequestAssembler translates docid->path (resolvePinPath RENAMED resolveDocPath - it now resolves overrides too) -> GraphBuildRequest.nodeOverrides (path-keyed Map) -> engine ECHOES onto GraphNode.override. Overrides resolve from ANY central; an override on MAIN is kept (only pins on MAIN are dropped). Q4 honored: sizeScore untouched (asserted by test). Pixel APPLICATION is deliberately left to the drag-to-resize view ticket (nid_qjsj5mth2phdqctbm0vfx9elw_e) / engine sizing ticket (nid_cx5zoz7ptucg9nxalibv0mbjb_e) - width/height boxes don't fit the current single sizePx model NodeSizer emits.
- Orphan cleanup: SweepPlanner/OrphanSweeper prune override entries whose docid no longer resolves (same confirmed-orphan re-check as pins); SweepSummary gains overridesRemoved.
- Docs: CLAUDE.md persistence bullet, high-level-plan.md Persistence section updated.
- Tests: npm test 1502 passed (round-trip, parser degradation, empty-entry drop, clamp, store save/replace/delete, services eligibility/refusal/lazy mint, sweep, assembler translation, engine echo). npm run check clean. Commit 36354cd.
