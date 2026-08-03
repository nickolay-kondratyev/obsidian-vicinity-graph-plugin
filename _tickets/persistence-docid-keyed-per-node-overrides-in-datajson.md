---
id: nid_lwionnvohw9k58jw7a2dybht2_e
title: "persistence: docid-keyed per-node overrides in data.json"
status: open
deps: [nid_o5hz7ilcauwe2acqdfh6pcuam_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e]
created_iso: 2026-08-03T23:48:47Z
status_updated_iso: 2026-08-03T23:48:47Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, persistence]
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

