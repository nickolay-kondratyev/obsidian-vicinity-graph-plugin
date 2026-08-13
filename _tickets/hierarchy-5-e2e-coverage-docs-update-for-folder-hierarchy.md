---
closed_iso: 2026-08-13T17:55:28Z
session_ids: [{"a": "claude", "type": "execution", "id": "d351fa9a-c086-41ba-a0c1-71eaa979ca88"}, {"a": "claude", "type": "review", "id": "ab16834e-9e37-4b29-b150-3a02daa01c79"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_eymj85m7qccbpkoo4qj6b1q6t_e
title: "Hierarchy 5: e2e coverage + docs update for folder hierarchy"
status: closed
deps: [nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_k4q36qb0nvmusoygl56trgtz2_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T17:55:28Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [e2e, docs]
---

End-to-end proof + documentation. Full spec in body.


Design record: ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e` (closed PLAN). Depends on
Hierarchy 2/3/4. NOTE: e2e specs live in the /e2e/ SUBMODULE — commit there first.

## Scope

1. **e2e (real Obsidian)**: dev-vault fixture with the named Jon scenario
   (`Jon.md` containing `[[child-of-jon]]`, `Jon/child-of-jon.md`) plus a
   `Jon/Jon.md`-style case:
   - defaults (links-out=1, descendants=1): ONE merged edge, solid + badge;
     clicking it opens the flyout showing BOTH the link occurrence and the
     folder-relation section.
   - descendants-only budget: dashed edge, no badge, flyout shows the explanation.
   - ancestors: child as MAIN shows its folder note at ancestors=1.
   - settings rows visible under Depth in tab AND panel with their hover text;
     stepping a dial changes the graph (settle writes via
     `e2e/settingsWriteWindow.ts`, never sleep).
2. **Docs**: update `docs-internal/plan/high-level-plan.md` (channel table + edge
   model + truncation chain + the new owner decisions), `docs-internal/architecture-map.md`
   (FolderNoteIndex, seam methods), `README.md` (user-facing behavior + the two
   conventions + depth dials), and CLAUDE.md conventions if the channel/edge bullets
   drift. Keep the "collapse, don't multiply" principle bullet accurate.
3. Run `npm run test:all` green before closing.

## Resolution (2026-08-13)

RESOLVED — implemented & green. `npm run test:all` passed all stages (check →
`npm test` 1968 passed → e2e 176 passed / 1 skipped on the pinned build,
including the 8 new folder-hierarchy specs).

### e2e (the RENDERED proof)

New spec `e2e/folderHierarchy.e2e.ts` (in the `/e2e/` SUBMODULE — committed there
first, then the pointer moved here). Serial, one Obsidian instance, seeded via
`extraFixtures` (isolated per-spec notes — they do NOT touch other specs' node
counts, unlike editing `setup-dev-vault.sh`). Fixtures:

- `Jon.md` links `[[child-of-jon]]` **twice** + is the sibling-style folder note of
  `Jon/child-of-jon.md`. Twice deliberately: a single link is badge-less
  (`linkCountBadgeText` shows `×N` only for N≥2), so two links make the merged
  edge's count badge visible to assert.
- `Ada.md` + `Ada/child-of-ada.md` — a folder note that NEVER links its child, so a
  descendants edge from it is a GENUINELY pure relation with zero link occurrences.
- `Kim/Kim.md` + `Kim/child-of-kim.md` — the inside-style convention.

The 8 tests: merged edge (defaults: solid, `×2` badge, NOT the dash class); merged
flyout (2 occurrence rows + the "Folder relation" section); descendants-only budget
on Jon (dashed `vicinity-graph-edge--hierarchy`, no badge, computed
`stroke-dasharray ≠ none` — proving the generated `styles.css` reached the path);
pure flyout on Ada (0 occurrence rows, "No link occurrences." empty state + the
folder-relation sentence); ancestors=1 with the child as MAIN surfacing the folder
note for BOTH conventions; and the settings rows on tab AND panel with their hover
text (description on the tab row / `title` on the panel stepper, both pulled from
`SETTINGS_GROUPS` so no copy is re-typed) + stepping the panel Descendants dial
0→1 brings the folder-note child into the graph.

**Key discovery for the next reader:** the flyout's occurrence list comes from the
LIVE `LinkOccurrenceProvider`, which reads the vault INDEPENDENTLY of what the walk
took. So a folder note that really links its child (Jon) shows those occurrences in
the flyout even when the edge renders PURE (links-out=0 ⇒ unwalked ⇒ dashed). The
"pure edge has no link occurrences" claim from Hierarchy 4 only holds for a folder
note that does not link its child — hence the separate `Ada` fixture. The dashed
RENDERING (walked set) and the flyout OCCURRENCES (vault read) are two different
authorities.

### Docs

- `docs-internal/plan/high-level-plan.md`: added the two hierarchy rows to the
  channel table (with the `hierarchy` relation note) and a new **Folder-note
  hierarchy** subsection (conventions, children/ancestors, KIND-pure channels,
  the depth quintet, the collapse/merge/dashed edge model, the flyout, the
  truncation tie-break pointer, the seam).
- `docs-internal/architecture-map.md`: `FolderNoteIndex` under adapters and the
  `getChildNotes`/`getParentNote` facts + shared `src/shared/FolderNotes.ts` rule
  under the `LinkProvider` seam.
- `README.md`: a user-facing **Folder-note hierarchy** section (both conventions,
  dashed vs merged connectors, inside-wins) + the Descendants/Ancestors depth dials
  in the Depth settings bullet.
- CLAUDE.md: no change needed — the "collapse, don't multiply" bullet already names
  "a link + folder-hierarchy relation share one edge", and the channel/edge bullets
  did not drift.

## Notes

**2026-08-13T17:57:57Z**

__READY_AS_IS__: docs+e2e-only branch; verified defaults (1/1,0/0), flyout copy, and all e2e symbols match code; npm run check green.
