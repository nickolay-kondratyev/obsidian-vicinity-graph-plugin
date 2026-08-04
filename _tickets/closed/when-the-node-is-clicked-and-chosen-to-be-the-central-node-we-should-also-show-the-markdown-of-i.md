---
closed_iso: 2026-08-01T05:03:42Z
id: nid_r5xy3vuw2kj1v75soe4ffwdjz_e
title: When the node is clicked and chosen to be the central node we should also show
  the markdown of it
status: closed
deps: []
links: []
created_iso: '2026-08-01T04:52:30Z'
status_updated_iso: 2026-08-01T05:03:42Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Right now if i focus on a note through the search as expected it is reflected in the vicinity graph as the central note.

However, when i click on a node in the vicinity graph and choose it to be the central node, Right NOW we do not show the markdown of it.

EXPECTED: we show the markdown of the note (either by opening a new tab or changing the previously opened tab to the new note, whichever is easier to do right now, I would prefer NOT to open the new tab though to keep the tab count down and the last tab that was opened to have the content of the last selected note in the vicinity graph). Lets make sure we have an e2e for this as well.

## Resolution (2026-08-01, commit e52a536)

Implemented the preferred variant: the CURRENT main-area tab is reused — no new tab.

- `src/view/GraphViewController.ts` `focusNode()`: after re-centering on the clicked node it now calls `navigator.openNote(path, { newTab: false })` (Obsidian's `getLeaf(false)` reuses the current main-area editor leaf). MAIN is set BEFORE the open, so the resulting active-file event is ignored by `decideActiveFileRebuild` — one rebuild, not two. Folder-group ids and re-clicking the current MAIN remain no-ops (nothing opens).
- Unit tests (`src/view/GraphViewController.test.ts`): flipped the behavior-capturing test "note is NOT opened" (this ticket is the explicit alignment) to "note opens in the editor" + "reuses the current tab (no new tab)"; added guards that MAIN-refocus and folder-group clicks open nothing. Started from failing tests.
- e2e (`e2e/vicinityGraph.e2e.ts`): rewrote the focus-click spec to assert the clicked node becomes `data-tier="main"`, the active file becomes the clicked note, AND the markdown leaf count is unchanged (same tab reused). The ctrl/cmd-click new-tab spec is untouched and still passes.
- Docs: README "Interacting with the graph" click bullet updated (was stale — still described the superseded link-preview flyout); comments in `VicinityGraphFlow.tsx` updated.

Verification: `npm test` 1479/1479 pass; `npm run check` clean; `npm run test:e2e` — all vicinityGraph specs pass (21/21). One UNRELATED pre-existing e2e failure (`e2e/settingsResetReview.e2e.ts` strict-mode locator ambiguity, fails on unmodified code too) is filed as ticket `nid_7u0zgl9oy88jupdvwaiyh7xd2_e`.
