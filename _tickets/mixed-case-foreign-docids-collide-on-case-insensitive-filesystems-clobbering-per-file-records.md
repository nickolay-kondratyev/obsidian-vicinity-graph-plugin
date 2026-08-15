---
id: nid_ij7rct3ysp6aqg18fwfw2ett3_e
title: "Mixed-case foreign docids collide on case-insensitive filesystems, clobbering per-file records"
status: open
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T00:42:38Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [persistence, decide]
---

ROOT CAUSE: the per-file storage name IS the docid verbatim (src/persistence/PerDocStore.ts relPath → per_file/<docid>.json) and the filename-safety rule (src/persistence/DocPersistEligibility.ts FILENAME_SAFE_DOCID_PATTERN /^[A-Za-z0-9_-]{1,120}$/) allows mixed case — so two persistable FOREIGN docids differing only by case (id: MyNote vs id: mynote) address the SAME physical file on macOS/Windows default filesystems. Distinct VaultFileStore serialisation chains + cache entries but one file: the second doc's record silently clobbers the first's (interleaved .tmp remove/rename can also corrupt mid-write), and after restart one doc has lost its state. Generated ids are immune (lowercase base36); the id library README explicitly warns consumers using ids as filenames to validate filename safety themselves. The Windows-reserved-basename check next to it is already matched case-insensitively — the case hazard was seen once and missed here. PRACTICAL FREQUENCY: low (needs two hand-authored ids differing only by case).

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/persistence/PerDocStore.test.ts, describe "PerDocStore on a case-insensitive filesystem", using a CaseInsensitiveFakeVaultFsPort.

FIX SHAPES (decide): (a) case-encode the storage filename (e.g. escape uppercase: MyNote → _my_note) — clean break OK pre-publish; (b) tighten DocPersistEligibility to refuse a docid that collides case-insensitively with an already-persisted one (needs cross-doc state the classifier lacks today); (c) lowercase-only pattern (refuses ALL mixed-case foreign ids — simplest, most restrictive).

