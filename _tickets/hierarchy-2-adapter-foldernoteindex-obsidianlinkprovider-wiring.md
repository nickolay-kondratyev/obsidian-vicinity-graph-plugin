---
closed_iso: 2026-08-13T16:59:05Z
session_ids: [{"a": "claude", "type": "execution", "id": "fc4d6aba-0c8a-4719-af46-641f3033c3a6"}, {"a": "claude", "type": "review", "id": "85085d85-bac6-4dae-990b-0b85420618fa"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_bw8hltfj3nsyas03mpfmqn7mg_e
title: "Hierarchy 2: adapter FolderNoteIndex + ObsidianLinkProvider wiring"
status: closed
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T16:59:05Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [adapters]
---

Adapter half of folder-note hierarchy. Full spec in body.


Design record: ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e` (closed PLAN). Depends on
Hierarchy 1 (`nid_dit8h888p2ml3092b2zn4zy3u_e`) for the seam methods + shared rule.

## Scope (src/adapters/)

New `FolderNoteIndex` mirroring `src/adapters/FrontmatterIdIndex.ts` structurally:
- Built from `vault.getFiles()` PATHS ONLY (via `VaultPort.getFiles()`,
  `src/adapters/obsidianPorts.ts`) — never a file read; delegates the resolution
  rule to the shared module from Hierarchy 1 (no duplicated tie-break knowledge).
- Lazy warm on first build (`ensureBuilt`), invalidated (`markStale`) by vault
  create/delete/rename events — wire the registrations where FrontmatterIdIndex's
  live (src/main.ts / provider construction).
- `ObsidianLinkProvider` (src/adapters/ObsidianLinkProvider.ts) implements
  `getChildNotes` / `getParentNote` over it, reading fresh like the id-ref paths.
- Only `.md` + `.canvas` are folder-note-eligible / child-eligible
  (`NODE_BEARING_EXTENSIONS`, src/shared/FileKinds.ts — unchanged).

## Tests

- Unit tests over a fake `VaultPort` file listing: both conventions, inside-wins,
  extension tie-break, invalidation on create/delete/rename (a rename of the folder
  note or of the folder re-resolves), canvas folder notes.
- `npm test` only (pure adapter logic; no e2e here — Hierarchy 5 owns that).

## Resolution (2026-08-13)

Done. `npm run check` clean, `npm test` green (1948 tests). No e2e (per scope —
Hierarchy 5).

**What was built**

- `src/adapters/FolderNoteIndex.ts` — new. Mirrors `FrontmatterIdIndex`
  structurally: plugin-lived, lazy `ensureBuilt` / `markStale`, built from
  `vault.getFiles()` PATHS ONLY (no file read). It holds ZERO resolution
  knowledge — it just builds a `FolderNotes.fromPaths(...)` snapshot (the shared
  Hierarchy-1 rule) and delegates `childNotesOf` / `parentNoteOf` to it, mapping
  the returned strings to `VaultPath`. Unlike `FrontmatterIdIndex` it takes no
  settings accessor (the convention is config-free), so it invalidates on PATH
  events only, never on `metadataCache 'changed'`.
- `src/adapters/FolderNoteIndex.test.ts` — new. Uses a small mutable
  `MutableFakeVault` (path set changes between builds) so invalidation is
  observable; covers both conventions, inside-wins, `.md`-beats-`.canvas`
  tie-break, canvas folder notes, parent resolution + gap, and the four
  invalidation cases (create, delete, folder-note rename, folder rename), plus a
  "not stale ⇒ stale snapshot still answers" case proving the warm is real.
  Convention CORRECTNESS stays in `src/shared/FolderNotes.test.ts`; this suite is
  the adapter's build/delegate/invalidate contract only.

**Wiring**

- `ObsidianLinkProvider`: new `folderNoteIndex` ctor param + `create()` arg;
  `create()` warms it (`ensureBuilt`) next to the id-index warm; `getChildNotes` /
  `getParentNote` (previously the deliberate `[]` / `undefined` "NOT WIRED YET"
  stubs) now read from it.
- `VicinityGraphBuilder` and `LiveLinkOccurrenceProvider`: thread the shared
  plugin-lived instance into their `ObsidianLinkProvider.create()` calls (one new
  ctor param each), exactly as `frontmatterIdIndex` is threaded.
- `src/main.ts`: constructs the single `FolderNoteIndex(this.app.vault)` and hands
  it to both the builder and the occurrence provider. Registers invalidation next
  to the id-index registrations: a NEW `vault.on('create')` handler (a created
  file can become a folder note / a child), and `markStale()` added to the
  existing `rename` handler (folder-note OR folder rename re-resolves) and the
  `delete` path (`handleVaultDelete`).
- Test helpers in `ObsidianLinkProvider.test.ts`,
  `ObsidianLinkOccurrenceProvider.test.ts`, `LiveLinkOccurrenceProvider.test.ts`,
  `VicinityGraphBuilder.test.ts` updated to pass a `FolderNoteIndex`.

**Next reader note:** the folder-hierarchy engine channels now find real folder
notes in a live vault. The visible/rendered behaviour + its e2e coverage is
Hierarchy 5's scope, not this ticket's.

## Notes

**2026-08-13T17:01:47Z**

__READY_AS_IS__: Focused FolderNoteIndex adapter + provider/main.ts wiring; faithful delegation to shared FolderNotes rule, correct path-event invalidation, all call sites threaded, check clean + 1948 tests green.
