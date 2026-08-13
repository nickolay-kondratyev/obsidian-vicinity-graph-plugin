---
id: nid_bw8hltfj3nsyas03mpfmqn7mg_e
title: "Hierarchy 2: adapter FolderNoteIndex + ObsidianLinkProvider wiring"
status: open
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T15:35:42Z
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
