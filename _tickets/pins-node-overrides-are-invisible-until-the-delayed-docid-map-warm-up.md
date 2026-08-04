---
id: nid_gbyqsuplz8b7pv0u5k34sdz1q_e
title: "pins & node overrides are invisible until the delayed docid-map warm-up"
status: open
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_lwionnvohw9k58jw7a2dybht2_e]
created_iso: 2026-08-04T00:32:28Z
status_updated_iso: 2026-08-04T00:32:28Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [persistence, sizing]
---

Both docid-keyed maps (pins, `nodeOverrides` in `data.json`) are translated to paths through `PathDocIdMap` in `src/adapters/GraphRequestAssembler.ts` (`resolveDocPath`). On plugin load that map is EMPTY: it is warmed only by `src/persistence/OrphanSweeper.ts`, which starts `SWEEP_DELAY_MS` (15s) after load, and by explicit write intents (`PersistenceServices.withPersistableIdentity`).

Consequences for the first ~15s of a session (and, since the sweep fires NO view refresh, until the next rebuild after it finishes):
- a pinned doc is simply absent from the graph;
- a per-node override (`GraphNode.override`) does not resolve, so once the consuming tickets apply pixels the node renders at its computed size and then JUMPS when a later rebuild picks the override up.

Pre-existing for pins; per-node size overrides make it visible as a layout jump, so it should be settled before/with `nid_qjsj5mth2phdqctbm0vfx9elw_e` (drag-to-resize).

Candidate directions (pick one, do not stack):
- resolve a MISSING docid on demand in the read path (`VicinityGraphBuilder` has `DocIdPort.getDocId` — READ-ONLY, id-lib-legal) for just the docids present in the two maps, instead of waiting for a bulk warm-up;
- or refresh open views once when the sweep completes (cheap, but keeps the 15s window).

## Acceptance Criteria

Opening a vault with a pinned doc and a per-node override renders both correctly on the FIRST graph build, without waiting for the delayed sweep.

