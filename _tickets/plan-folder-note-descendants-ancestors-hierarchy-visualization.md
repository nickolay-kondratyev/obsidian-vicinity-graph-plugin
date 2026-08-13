---
closed_iso: 2026-08-13T15:37:27Z
id: nid_ri1d36t7hmhu0kr652wny1dmz_e
title: "PLAN: folder-note descendants-ancestors hierarchy visualization"
status: closed
deps: []
links: [nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:41Z
status_updated_iso: 2026-08-13T15:37:27Z
type: epic
priority: 3
assignee: nickolaykondratyev
tags: [plan]
---

Design record (closed on creation). Full plan in body below.


# Plan: folder-note descendants/ancestors hierarchy visualization

Owner-aligned design (interactive session 2026-08-13, planning ticket
`nid_uxugk82jeu4cfj5ujyk4l79e7_e`). This ticket is CLOSED on creation — it is the
design record the implementation tickets reference; it is not itself work.

## Goal

Visualize folder-note hierarchy ('Folder Notes' plugin convention) as first-class
graph relations: the descendants and ancestors of central notes (MAIN + pinned),
with their own depth budgets, distinct edge treatment, and flyout explanation.

## Locked decisions

1. **Folder-note conventions — both, always-on, no setting.** `Jon.md` sibling of
   folder `Jon/`, or `Jon/Jon.md` inside it, is THE folder note of `Jon/`. When both
   exist, INSIDE wins (`Jon/Jon.md`); the sibling `Jon.md` is then an ordinary note.
   Extension tie at the same location: `.md` beats `.canvas`. Only `.md` + `.canvas`
   participate (NO `.base` in v1 — it is not node-bearing anywhere in the plugin).
   The folder note is never its own child.
2. **Children** of folder note X = node-bearing files directly in `X/` (minus the
   folder note itself). One descendant hop = one folder level; `X/sub/y.md` is reached
   only at depth 2 and only if `sub` has its own folder note — a folder WITHOUT a
   folder note is not bridged (no synthetic folder nodes). **Ancestors** = one
   folder-note parent per hop walking up; the first gap stops the walk.
3. **Two new KIND-PURE engine channels** `descendants` + `ancestors` in the ONE
   existing BFS (`src/engine/VicinityTraversal.ts` is parameterized by channel —
   this is two new `neighborsOf` cases, not a second engine). Consistent with owner
   decision D1 (high-level-plan.md): each channel spends only its own budget on its
   own hop kind; NO mid-chain kind switching. Links-out=2 walks link->link only,
   never a folder hop. A node reachable only via a mixed-kind chain is silently
   absent — accepted, NO indicator (those nodes are never DISCOVERED, so no counter
   can see them; same silence D1 already ships for embed->link chains).
   *Sanctioned future direction if this grates: treat descendants as additional
   traversal ROOTS (composes with existing machinery) — a backlog idea, not v1.*
4. **Depth settings: each per-role trio becomes a QUINTET.** New fields
   `descendantDepth` + `ancestorDepth` on both roles. Defaults: MAIN 1/1,
   pinned 0/0. Depth dials at 0 are the off switch (feature itself is always-on).
   Spelling: standard English **descendants** everywhere (code, ids, UI).
   Labels: "Descendants" / "Ancestors" / "Pinned descendants" / "Pinned ancestors",
   under the existing Depth settings group, in both presenters. Each row carries a
   DESCRIPTIVE hover/description explaining the folder-note convention.
5. **Edge model — "collapse, don't multiply" (CLAUDE.md principle, 2026-08-13).**
   An ordered-pair edge carries a RELATION SET: link occurrences and/or the folder
   relation. Pure hierarchy edge: DASHED, no count badge, drawn parent -> child
   (both channels emit that same orientation). MERGED edge (folder note also links
   its child): ONE edge, solid + count badge — the folder relation is discoverable
   in the flyout, not glanceable (owner pick D1-a). Opposite directions unchanged:
   child->parent link + parent->child hierarchy render as today's two-arrow pair.
   Hierarchy relations are invisible to `getLinkCount` and the cross-links sweep.
6. **Flyout**: clicking an edge that carries the folder relation opens the existing
   link-context flyout with a short folder-behavior explanation section (e.g.
   "`Jon.md` is the folder note of `Jon/`; `child-of-jon.md` is inside that folder"),
   alongside the usual link occurrences when merged.
7. **Truncation**: hierarchy-discovered nodes get depth tags like any channel and
   participate in minDepth-first ranking and the node cap with no special casing.
   NEW tie-break level by discovering relation kind: **Embeds > Links > hierarchy**
   (best across a node's depth tags), slotted after graph-distance-to-MAIN and
   before pin recency in the existing priority chain.
8. **Seam**: `LinkProvider` (src/engine/LinkProvider.ts) gains FACT methods
   `getChildNotes(path)` / `getParentNote(path)`. The folder-note resolution rule
   lives in ONE pure shared module (src/shared/), used by adapter + tests.
   Adapter: new `FolderNoteIndex` built from `vault.getFiles()` PATHS ONLY (no file
   reads), lazy-warmed on first build, invalidated on vault create/delete/rename —
   structurally mirroring `src/adapters/FrontmatterIdIndex.ts`. `FakeLinkProvider`
   grows the same methods for fixture tests.

## Named required test (owner-requested)

Vault: `Jon.md` (MAIN, body contains `[[child-of-jon]]`) + `Jon/child-of-jon.md`.
- links-out=1 AND descendants=1 => ONE merged edge Jon->child (solid + badge),
  flyout shows BOTH the link occurrence and the folder relation.
- links-out=1, descendants=0 => solid link edge only.
- links-out=0, descendants=1 => dashed hierarchy edge only.
Covered as engine fixture tests (Hierarchy 1) AND e2e (Hierarchy 5).

## Implementation tickets (in dependency order)

1. `nid_dit8h888p2ml3092b2zn4zy3u_e` — engine channels + edge relation set + spec leaves
2. `nid_bw8hltfj3nsyas03mpfmqn7mg_e` — adapter FolderNoteIndex + provider wiring (deps: 1)
3. `nid_i3cznjkcnelqzvhp0gqlis499_e` — settings UI rows (deps: 1)
4. `nid_f5bfjoymr2pt7odxieunkxasd_e` — view edge rendering + flyout (deps: 1, 2)
5. `nid_eymj85m7qccbpkoo4qj6b1q6t_e` — e2e + docs (deps: 2, 3, 4)
