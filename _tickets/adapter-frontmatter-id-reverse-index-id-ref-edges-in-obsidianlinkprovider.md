---
closed_iso: 2026-08-12T18:50:04Z
session_ids: [{"a": "claude", "type": "execution", "id": "ce0c9147-cbb6-41de-ac4b-3699d126818c"}, {"a": "claude", "type": "review", "id": "f0126744-06c4-4a2c-9cf7-2c5a8b9eac9d"}, {"a": "claude", "type": "review", "id": "a621fc9a-18cd-4205-8eee-bb900b0efa7d"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_phu0llxhfptse000j66ezrhh3_e
title: "Adapter: frontmatter-id reverse index + id-ref edges in ObsidianLinkProvider"
status: closed
deps: [nid_dthnhlzp0wzxqhcozj3f8ih5h_e]
links: []
created_iso: 2026-08-12T17:19:54Z
status_updated_iso: 2026-08-12T18:50:04Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 2 of the frontmatter-id links feature. Read the plan first: ticket nid_sjojyvd55emyry45qynphei7o_e (_tickets/plan-frontmatter-id-links-depslinks-fields-referencing-note-ids.md). DEPENDS on the settings ticket nid_dthnhlzp0wzxqhcozj3f8ih5h_e (spec leaf `idRefFields` + canonical parse helper must already exist).

Make id-references render as graph edges, BOTH directions, riding the existing link channels/budgets. ENGINE STAYS UNTOUCHED (src/engine/ purity guard applies) — all work in src/adapters/.

Scope:
- New `FrontmatterIdIndex` class in src/adapters/: cache-only (app.metadataCache.getFileCache + vault.getMarkdownFiles(), NEVER file reads) building (a) ownerByIdMap: id -> VaultPath from each note's `id:` frontmatter field; (b) referrersByIdMap: referenced-id -> Set<VaultPath> from the CONFIGURED fields. Lazy warm on first graph build (mirror PerDocStore's lazy-warm pattern); refreshed on metadataCache `changed` + vault delete/rename. Empty configured field list => index inert, zero cost.
- Value handling (locked decisions): accept scalar and list values; strings only (quoted YAML strings arrive unquoted from the cache; skip numbers/objects); skip unresolved ids silently; skip self-references; duplicate id claims resolve deterministically (lexicographically smallest path).
- Merge into src/adapters/ObsidianLinkProvider.ts: getOutgoingReferences additionally emits `{ target, kind: "link" }` for resolved id-refs (dedup targets emitted twice via multiple configured fields); getIncomingLinks additionally returns referrers of the note's own id; getLinkCount includes id-ref occurrences. Note: the frontmatter `id` field is written by stable-ids-for-obsidian — this feature READS it only.
- Tests (BDD WHEN/THEN, one behavior per test): index build from fake metadata, scalar/list/quoted, non-string skip, unresolved skip, self-ref skip, duplicate-id determinism, cache-change refresh, empty-list inert, provider merge for both directions and link counts.
- e2e (npm run test:e2e): vault fixture where note A has `deps: [<id of B>]`; set the settings field through the UI (settle via e2e/settingsWriteWindow.ts, never sleep); assert A->B edge appears when A is active AND when B is active (incoming direction).
- Update README.md (user-facing feature description) and docs-internal/plan/high-level-plan.md if it enumerates edge sources.

---

## Resolution (2026-08-12)

Done and verified. All work stayed in `src/adapters/` (engine purity guard intact).

### What was built
- **`src/adapters/FrontmatterIdIndex.ts`** — cache-only reverse index. Two maps
  built in one pass over `vault.getFiles()` (filtered to markdown via
  `FileKinds.isMarkdownPath`) reading only `metadataCache.getFileCache().frontmatter`
  — NEVER a file read:
  - `ownerByIdMap: id → owner path` (duplicate id claim → lexicographically smallest
    path wins; files sorted by path first for determinism).
  - `referrersByIdMap: referenced-id → Set<referrer path>` from the CONFIGURED fields.
  - Query methods resolve at query time (so id ownership is checked against the
    complete owner map): `resolvedTargets` (outgoing, deduped, self excluded),
    `referrersOf` (incoming — returns [] unless the note actually OWNS its `id`, so a
    duplicate-id loser gets no phantom edge), `occurrenceCount` (multiplicity for the
    badge).
  - Value rules (locked): strings only (`stringValuesOf` accepts scalar + list, drops
    numbers/objects), trimmed, empties/unresolved/self-refs skipped.
  - Lifecycle mirrors `PerDocStore`: `ensureBuilt()` lazy-builds on first graph build
    and no-ops after; `markStale()` (fired from `main.ts`) forces a rebuild. A change
    to the configured field list is auto-detected (`builtFields` compare) so a settings
    write is honoured on the next build with no bespoke subscription. Empty field list
    ⇒ inert (maps empty, zero cost). **Note on ordering:** `resolvedOwnersOf` must call
    `ensureBuilt()` BEFORE reading `builtFields` (a fresh index starts with
    `builtFields = []`) — see the comment there.
- **`src/adapters/ObsidianLinkProvider.ts`** — `create()` gained a 4th param
  (`FrontmatterIdIndex`) and calls `ensureBuilt()`. `getOutgoingReferences` appends
  resolved id-refs as `{kind:"link"}` and re-dedupes (drops an id-ref already carried
  as a wikilink of the same target); `getIncomingLinks` unions in `referrersOf`;
  `getLinkCount` adds `occurrenceCount` on top of the wikilink/canvas count (both
  branches).
- **Wiring** (`main.ts`): the index is plugin-lived (like `canvasParseCache`),
  constructed with `() => pluginDataStore.frontmatterLinks().idRefFields`, threaded into
  `VicinityGraphBuilder` and `LiveLinkOccurrenceProvider` (both grew a constructor
  param and pass it to `create`). `markStale()` is fired from the `metadataCache`
  `changed` handler and the vault rename/delete handlers.

### Tests
- `src/adapters/FrontmatterIdIndex.test.ts` (new): build, scalar/list/quoted-trim,
  non-string skip, unresolved skip, self-ref skip, duplicate-id determinism, empty-list
  inert, incoming (incl. duplicate-loser phantom guard), occurrence counts, cache-change
  refresh, field-list-change refresh.
- `src/adapters/ObsidianLinkProvider.test.ts`: added a describe for both directions,
  id-ref-only count, wikilink+id-ref count add-up, no-duplicate-edge, feature-off.
- `FakeObsidianSpec` gained an optional `idRefFields`; the three provider-test helpers
  construct a real `FrontmatterIdIndex`.
- e2e `e2e/frontmatterIdLinks.e2e.ts` (new, submodule): seeds two notes at runtime
  (`harness.createNote`, added to the harness + `E2eVault.create`), sets the field
  THROUGH the settings tab (`typeInto` + blur, settled via `SettingsWriteWindow`, no
  sleep), asserts the A→B edge when A is active and when B is active. Because the
  INCOMING channel ships at depth 0, the spec bumps `linkDepthIn` to 1 (orthogonal
  dial) so an incoming edge is walked at all.

### Docs
- README.md: new "Frontmatter links" settings bullet.
- docs-internal/plan/high-level-plan.md: new bullet under "Link kinds" describing the
  fourth (adapter-only) edge source.

### Verification
- `npm run check` → 0 errors. `npm test` → 1903 passed. `npm run test:e2e --
  frontmatterIdLinks.e2e.ts` → 2 passed.

### Left for the next reader
- The e2e submodule (`e2e/`) has uncommitted new/changed files
  (`frontmatterIdLinks.e2e.ts`, `obsidianHarness.ts`, `obsidianInternals.ts`) — commit
  them in the submodule before committing the parent, per CLAUDE.md.
- Distinct styling for id-ref edges remains a separate backlog ticket (Q3, KISS: they
  render identical to wikilinks today).


## Notes

**2026-08-12T18:55:05Z**

__REVIEW_AGAIN__: Fixed a real bug — occurrence drawer omitted id-ref edges for markdown sources (badge counted them, drawer showed 0); added a getLinkCount top-up in ObsidianLinkOccurrenceProvider + a test. New code path in a shipped provider warrants a fresh look.
