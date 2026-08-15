---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_buurw8hp0yg2v1bwdhdyu7yrs_e
title: "Deleting a duplicate-docid twin destroys the surviving note's pins and overrides"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T00:41:49Z
status_updated_iso: 2026-08-15T01:23:42Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [persistence]
---

ROOT CAUSE: src/main.ts:280-294 handleVaultDelete infers "the doc with docid X is gone" from "the deleted path was mapped to X" via src/persistence/PathDocIdMap.ts handleDelete — unsound when two live files carry the same docid. Docids live in user-visible frontmatter (id:), and Obsidian's "Make a copy" / templates / sync restores duplicate frontmatter verbatim; the bundled id library honours existing ids as-is. PathDocIdMap.set enforces 1:1 last-writer-wins (src/persistence/PathDocIdMap.ts:12-19), so once the COPY is visited/swept, the docid points at the copy; deleting the copy then returns the docid as cleanup key and main.ts forgets it in BOTH tiers (PluginDataStore.forgetDocs + PerDocStore.forgetDocs) — the ORIGINAL note permanently loses its global pin, local pins and node overrides. Nothing resurrects them (the sweep only deletes). Contrast: OrphanSweeper re-verifies at drop time and skips on incomplete evidence; the live handler does the destructive act with none.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/persistence/PathDocIdMap.test.ts, "WHEN a docid was seen at TWO live paths THEN deleting one twin yields no cleanup key".

FIX SHAPES (pick one): (a) defer ambiguous deletes to the orphan sweep — handleVaultDelete withholds cleanup when the map saw the docid at more than one live path this session (map remembers multi-path sightings); the sweep's full-scan re-derivation then correctly sees the surviving twin. (b) re-verify in handleVaultDelete that no other live file still resolves to the docid before forgetting. If the fix lands in main.ts rather than the map, MOVE the committed failing test accordingly.

## Acceptance Criteria

The committed it.skip test (or its relocated equivalent) is unskipped and passes; deleting a copied note never erases the surviving original's pins/overrides.

