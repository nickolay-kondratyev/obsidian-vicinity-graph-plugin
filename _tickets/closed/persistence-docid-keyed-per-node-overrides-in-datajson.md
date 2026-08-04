---
closed_iso: 2026-08-04T00:18:25Z
id: nid_lwionnvohw9k58jw7a2dybht2_e
title: 'persistence: docid-keyed per-node overrides in data.json'
status: closed
deps: [nid_o5hz7ilcauwe2acqdfh6pcuam_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_gbyqsuplz8b7pv0u5k34sdz1q_e, nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e]
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

**2026-08-04T00:32:39Z**

ADVERSARIAL REVIEW FOLLOW-UP (2026-08-04, separate commit on top of 36354cd):
- The live `vault.on('delete')` handler pruned only PINS, so a deleted doc's override survived until the next startup sweep. Both maps now drop through ONE `PluginDataStore.forgetDocs` call (also used by the sweep, one data.json write instead of two).
- The override write API was wholesale-replace (`saveNodeOverride(docid, completeOverride)`), which forces a consumer to compose an entry from the RENDERED graph and clobber the other field. Replaced by field-scoped `NodeOverrideChange` (`saveNodeOverrideField` / `clearNodeOverrideField`); the store merges over state read fresh, matching the settings-pipeline rule.
- Clearing a field no longer calls `ensureDocId`: an id-less doc owns no override, so the old empty-override path minted a frontmatter id to store nothing.
- The sweep completion log now reports overridesRemoved.
- Cold-docid-map window (pins AND overrides invisible until the 15s sweep) filed as nid_gbyqsuplz8b7pv0u5k34sdz1q_e.

**2026-08-04T00:45:09Z**

SECOND ADVERSARIAL REVIEW (2026-08-04, third commit on this branch). Four issues fixed:

1. PERSISTED_SHAPE_VERSION REVERTED 3 -> 2. **This overturns this ticket's own instruction ("Bump PERSISTED_SHAPE_VERSION") and the same line in node-sizing-rethink.md section 4 (also corrected) - HUMAN, overturn me with a one-line edit if you disagree.** WHY: nodeOverrides is a purely ADDITIVE key. An older data.json simply lacks it and gets {} per field, so nothing is stale to discard - while a version bump makes parsePluginData return defaults WHOLESALE, wiping every global setting AND the pinned set for zero benefit. That is the standing rule in this repo, stated twice in code (`edgeRoutingClearancePx`, the pinned depth fields: "Added WITHOUT a PERSISTED_SHAPE_VERSION bump") and decided twice in closed tickets: nid_8p0nn2g34d97finokwlz3u1dt_e ("must not be bumped for additive fields") and nid_fay1hu5sxcoygizopkkg0f0d7_e ("Do NOT bump ... that would discard globals wholesale, strictly worse") - that second one against a far stronger case, a KEY RENAME. Bumping is reserved for a REMOVED/renamed key. Consequence: the earlier release-note callout is void - there is no data loss to announce (and no RELEASE_CHECKLIST.md line was ever added for it).
2. PluginDataStore's override write hand-listed the two field names in TWO spots with no compile-time guard: putNodeOverride's emptiness test (`sizePx === undefined && content === undefined`) would DELETE an entry holding only a newly added third field, and withoutField rebuilt the entry from a literal pair, silently DROPPING a third field on any clear. Both are now field-agnostic (Object.keys emptiness, copy-minus-delete), and the written value goes through an exhaustive `storedForm` switch that fails to compile (noImplicitReturns) on a new NodeOverrideChange variant. Verified by temporarily adding a probe field: the store now fails the build in exactly those places instead of losing data.
3. This ticket's `links:` frontmatter was CORRUPTED by the previous note-writing pass ("links: [[a, b, c, d]\n  e, f]") - the tool reads the list line-wise, so link 1 came back as "[nid_..." (unresolvable) and two links were invisible. Repaired on ONE line; `ticket show` now resolves all six.
4. nid_gbyqsuplz8b7pv0u5k34sdz1q_e (cold docid map) restated a root cause and option list that already existed in docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md. The two now cross-reference: the _tickets one OWNS the fix, the docs-internal file stays as the write-up (and its stale `resolvePinPath` reference is fixed).

Also: PersistenceServices.saveNodeOverride RENAMED saveNodeOverrideField - both override entry points are field-scoped, so both are named for it (the consuming ticket's API note is updated).

Verified: npm run check clean, npm test 1509 passed, npm run test:e2e vicinityGraph.e2e.ts 25 passed.

**2026-08-04T00:56:48Z**

THIRD ADVERSARIAL REVIEW (2026-08-04, fourth commit on this branch). One behavioral fix, two stale docs; the rest of the round-1/2 work held up.

1. **Non-finite pixel box: REFUSED, not degraded.** `clampNodeSizeOverridePx` turned `NaN` into `NODE_OVERRIDE_HARD_MIN_PX`, so an unmeasurable box from a future drag-resize would have persisted a 24x24 dot and been indistinguishable from a deliberate tiny node. It also contradicted the load path (which drops an unusable `sizePx`) and the repo's own `clampSizingNumber` rule (`NaN` -> the field's spec DEFAULT; an override has NO default — ABSENCE is what "no override" means). Now returns `NodeSizeOverridePx | undefined`; `saveNodeOverrideField` writes NOTHING for a refused box (no `data.json` write, previously stored box survives) and `parseNodeSizeOverride` stopped re-testing finiteness, so load and write ask ONE rule. +3 tests.
2. `docs-internal/architecture-map.md` (the "orient here first" doc) still said `data.json` = "global settings + the pinned set" and `OrphanSweeper` "prunes stale pins" — rounds 1/2 updated CLAUDE.md and high-level-plan.md but missed it.
3. `SettingsRootSnapshot`'s contract comment ("`PluginData` minus `version`/`pins`") now also excludes `nodeOverrides` — it is the definition a future settings slice gets added against.

Reported but NOT fixed (deliberate, 80/20): a foreign docid of literally `__proto__` passes `DocPersistEligibility.isFilenameSafeDocId`, and `nodeOverrides` is the first docid-keyed OBJECT map here, so `map[docid] = entry` would mutate the prototype and silently lose that doc's override. Closing it properly means renaming `isFilenameSafeDocId` (behavior must match the name) plus caller/test ripple — out of proportion to a case no generated `docid_{24 base36}_e` can reach, and the blast radius is one entry.

Verified: `npm run check` clean, `npm test` 1512 passed. Pure engine/persistence — `npm test` is the gate per CLAUDE.md (no view surface touched).
