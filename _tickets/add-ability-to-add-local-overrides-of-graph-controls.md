---
id: nid_rnghlzs0uejjlbd5a4bjkq7eg_e
title: "Add ability to add local overrides of graph controls"
status: punted
deps: [nid_8f8ey41extajt08zphwwxhnwq_e]
links: [nid_8f8ey41extajt08zphwwxhnwq_e]
created_iso: 2026-08-07T21:10:55Z
status_updated_iso: 2026-08-07T21:10:55Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

I am imagining that the graph controls would have ability to create local overrides.
The override would be next to the global setting, and should up with some icon to click on to add the local override.
Each section would show whether there are local overrides and the top graph controls would also have an icon to show if there are any local overrides present for this note.
## Notes

**2026-08-10T18:47:17Z**

UNBLOCKED: blocker nid_8f8ey41extajt08zphwwxhnwq_e is CLOSED (per-file store landed). The per-doc/per-main storage home for this feature already exists:
- src/persistence/PerDocStore.ts owns .plugin_data/vicinity_graph/per_file/<docid>.json records shaped { override?, localPins?, localControls? }. The `localControls` section is RESERVED and empty-by-default exactly for this ticket's per-main control overrides — adding it should be a change to PerDocStore + perDocRecord.ts ALONE (purely additive; the record parser already preserves an object `localControls` verbatim).
- Follow the merge-ONE-field-over-fresh invariant (see saveNodeOverrideField) and route through PersistenceServices (sole ensureDocId caller) as localPins/overrides do.
- forgetDocs already spans the whole per-file record, so a new localControls section is pruned on delete with no extra wiring.
