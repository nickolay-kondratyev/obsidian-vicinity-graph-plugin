---
id: nid_eymj85m7qccbpkoo4qj6b1q6t_e
title: "Hierarchy 5: e2e coverage + docs update for folder hierarchy"
status: open
deps: [nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T15:35:42Z
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
