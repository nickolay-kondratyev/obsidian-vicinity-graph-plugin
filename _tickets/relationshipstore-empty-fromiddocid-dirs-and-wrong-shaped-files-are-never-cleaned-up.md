---
id: nid_jt0jzdm4est2493zjime2ofye_e
title: "RelationshipStore: empty from_id/<docid>/ dirs and wrong-shaped files are never cleaned up"
status: open
deps: []
links: []
created_iso: 2026-10-07T00:34:56Z
status_updated_iso: 2026-10-07T00:34:56Z
type: chore
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: []
---

Follow-up from Relationships 2/4 (nid_a5m4kforr9scit68rhqmqh78o_e).

- `RelationshipStore.forgetDocs` (src/persistence/RelationshipStore.ts) deletes the files under `.plugin_data/vicinity_graph/from_id/<from_docid>/` but not the directory itself: the vault fs port (src/persistence/VaultFileStore.ts and its port) has no rmdir. Empty dirs pile up under the hidden `.plugin_data` folder. Harmless: the warm-up finds them empty.
- A readable but wrong-shaped relationship file reads as "no name" and is never swept: its docids never enter `keyedDocids()`, so the orphan sweep never sees it.

Fix: add a domain-agnostic directory-remove to the fs port (+ Fake), call it from forgetDocs when a from-dir empties; decide whether wrong-shaped files should be quarantined or swept. Low ROI; do only if the clutter becomes visible.

