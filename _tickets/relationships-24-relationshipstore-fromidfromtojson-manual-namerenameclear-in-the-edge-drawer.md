---
id: nid_a5m4kforr9scit68rhqmqh78o_e
title: "Relationships 2/4: RelationshipStore (from_id/<from>/<to>.json) + manual name/rename/clear in the edge drawer"
status: in_progress
deps: [nid_gk9h4jpa7di1al7och0rehd3h_e]
links: []
created_iso: 2026-10-06T23:04:40Z
status_updated_iso: 2026-10-07T00:11:36Z
type: task
priority: 2
assignee: nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/.worktree/t-a5m4kfor
---

Part 2/4 of the named-relationships epic. Read the parent ticket first for the data model and the
DIRECTED rule.

## Goal
Persist relationships, and let the user name, rename or clear an edge's relationship from the edge drawer.

## Storage — `RelationshipStore` (`src/persistence/`)
- Files: `$VAULT/.plugin_data/vicinity_graph/from_id/<from_docid>/<to_docid>.json` via the existing
  `VaultFileStore` (`src/persistence/VaultFileStore.ts`), which gives the `{ "v1": payload }` envelope,
  atomic writes and quarantine of unreadable files. Payload: `{ name: string | null, origin: "manual" | "ai",
  model?, reasoningEffort?, usage?: {inputTokens, outputTokens}, createdIso, updatedIso }`.
  `name: null` marks a dismissed AI name.
- `VaultFileStore.listKeys` lists IMMEDIATE children only. The warm-up therefore walks `from_id/`, then
  each `<from_docid>/` dir. Add a nested-list helper or walk in the store, and keep `VaultFileStore`
  domain-agnostic.
- Mirror `PerDocStore` (`src/persistence/PerDocStore.ts`):
  - Lazy warm on the first build, sharing one in-flight promise. In-memory authoritative after that.
  - Sync, EXACT-direction read `relationshipFor(from, to)`. Never consult `(to, from)`: relationships
    are directed.
  - A `to → froms` reverse index, used only for delete pruning.
- `forgetDocs(docids)` deletes the from-dir AND every file in to-position. Wire it as the THIRD
  side-by-side call at the removal choke point (vault delete handler + `OrphanSweeper`, see `src/main.ts`).
  Add its docids to the warm-up union (`keyedDocids()` → `DocIdMapWarmer`).
- Docids: `ensureDocId` on write intent for BOTH notes via the seam in
  `src/persistence/PersistenceServices.ts` (`stable-ids-for-obsidian` adds the frontmatter `id`).
  A refusal is reported through `UserNoticePort`, like pin refusal.
- Write failures go through the settings pipeline's `runGuarded` (CLAUDE.md "Settings writes"), so
  there is ONE failure policy and the views repaint from the store.
- Update the CLAUDE.md "Persistence is TWO-TIER" section and `docs-internal/architecture-map.md`
  (a third docid-keyed facts store).

## UI — edge drawer
- Unnamed edge: "Name this relationship" opens a text input. It commits on Enter/blur, not per
  keystroke, and stores a manual `source → target` name.
- `parent` default on a hierarchy edge: it can be named too, and the manual name replaces `parent`.
- Manual name: rename or clear. Clear deletes the file.
- AI name (written by task 4/4): shows "AI-generated · <model>". Rename turns it manual. Clear writes
  the dismissed marker.
- Syntax name: read-only, "declared in <note>". The user edits the note to change it.
- Name validation (pure, tested): trimmed, non-empty, max length as a named constant. A refusal uses plain copy.

## Acceptance
- `RelationshipStore` unit tests on `FakeVaultFsPort`:
  - write/read, and that `(B, A)` never answers for `(A, B)`;
  - warm after restart;
  - `forgetDocs` for both positions;
  - the dismissed marker and the quarantine path.
- Precedence tests extended (syntax > manual > ai > `parent`). A dismissed marker hides the AI name.
- e2e: name an edge in the drawer → label appears → reopen the view → still there → clear → gone.
