---
closed_iso: 2026-08-13T20:19:39Z
id: nid_ofacqul281sr71qrdacqy8jv3_e
title: Rename at time eats the visualization of the node
status: closed
deps: []
links: []
created_iso: '2026-08-13T19:43:09Z'
status_updated_iso: 2026-08-13T20:19:39Z
type: bug
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
ROOT cause and fix.

--------------------------------------------------------------------------------

After renames we at times end up with a ghost looking node where the node is transparent in the vicinity graph:

"/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/.tmp/Screenshot From 2026-08-13 13-42-29.png"

It particurly, happens when "folder note" plugin is used and we rename the folder note:

So if we rename a folder note such as 

```
Jon/Jon.md

# 'Jon' renamed to 'Jon1', which causes the folder to be renamed to Jon1 as well 

Jon1/Jon1.md
```

Then we end up with transparent looking node in the graph. So to reproduce it we may want to have the test trigger the folder rename as well in e2e test.

--------------------------------------------------------------------------------

## RESOLUTION (2026-08-13, closed)

**Root cause — a cross-plugin CSS collision, not a rebuild/diff bug.** Our
`NoteNode` root div carried `data-path="<vault path>"` — the same attribute
Obsidian's file explorer keys files by. The community **Folder Notes** plugin
(LostPaul/obsidian-folder-notes, `src/functions/styleFunctions.ts`,
`addCSSClassToFileExplorerEl`) queries
`activeDocument.querySelectorAll("[data-path='<folder note path>']")`
**document-wide** (with 5×500ms retries) and adds class `is-folder-note` to
every match; its `styles.css` has the **unscoped** rule
`.hide-folder-note .is-folder-note { display: none; }`. After a folder-note
rename their retrying tag pass lands AFTER our rebuild, so our node's body gets
`display: none`. What remains visible is the React Flow node wrapper plus its
sibling resize grips — the accent-colored fragments in the ticket screenshot
(confirmed by pixel-measuring the screenshot: the "ghost" is exactly the three
resize grips at ~3x zoom).

**Fix** (`src/view/NoteNode.tsx`): the node root now renders the plugin-scoped
`data-vicinity-path` instead of `data-path`. Nothing in our runtime code or CSS
read `data-path`; clean break per the not-published-yet rule.

**Verification (bidirectional):**
- New e2e regression spec `e2e/folderNoteRename.e2e.ts`: fixtures
  `jon/jon.md` + `jon/jsonb.md`, a stand-in for Folder Notes (body class
  `hide-folder-note`, the verbatim unscoped hide rule, the verbatim
  document-wide `[data-path]` tag pass), and the reentrant folder-rename
  cascade (`jon`→`jon1` from inside the note's own rename event). Asserts every
  node body stays visible AND that no element under the flow carries
  `data-path` at all. Passes with the fix; temporarily reverting to
  `data-path` reproduced the exact ghost signature
  (`class="vicinity-graph-node is-folder-note"`, visibility `hidden`).
- Component test in `src/view/NoteNode.component.test.tsx` pins
  `data-path` absent on the rendered node.
- Full gates: `npm run check` ✅, `npm test` 1969/1969 ✅, e2e 149 passed with
  3 failures **proven pre-existing** (identical with the fix fully stashed) —
  tracked in follow-up ticket `nid_794aqyj6ks4gtlu1cc6po5cut_e` (e2e submodule
  pinned commit 45880847 was never pushed; submodule tip is behind src).

**Commits** (branch
`CC_nid_ofacqul281sr71qrdacqy8jv3_e__rename-at-time-eats-the-visualization-of-the-node_fable`):
main repo `4e057f4`; e2e submodule `e9bdc4a` (same branch name — new spec,
`data-vicinity-path` selector sweep across all specs, settingsBaseline drift
catch-up). NOTE: the submodule branch could NOT be pushed from this
environment (no access rights) — push it before merging the parent, or the
pinned SHA is unreachable (details in the follow-up ticket).
