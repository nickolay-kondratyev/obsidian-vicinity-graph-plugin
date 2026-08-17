---
closed_iso: 2026-08-17T17:06:35Z
id: nid_mgp572ljuxzajfrb64gkiyreq_e
title: Add ability to add child to a folder note
status: closed
deps: []
links: [nid_rt0dyx6chv7fxae4k7q85f53l_e]
created_iso: '2026-08-17T16:45:25Z'
status_updated_iso: 2026-08-17T17:06:35Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve.
  IF there are multiple tickets that we want to create 
    THEN put the high level plan into a new ticket and `close` it 
         AND create focused implementation tickets that reference the closed plan.
    ELSE put the plan into a new `open` ticket
  After we are done close this ticket.
  DONT RUSH and make sure the decisions that need to be made are fully signed off one by one by the HUMAN.
--------------------------------------------------------------------------------
WHEN a note is considered a folder note AND it is the main note. 
THEN when hovering over that note we should get an icon in the bottom right corner to create a CHILD note. (Research icons that fit this pattern and use + sign icon as fallback.)

Folder note is either the 
`Jon/Jon.md`

or 
```
Jon.md
Jon/
```
Pattern.
If in conflict we favor the `Jon/Jon.md` pattern and would create the note next to `Jon/Jon.md` as `Jon/Child.md`.
--------------------------------------------------------------------------------

## Resolution (2026-08-17) — CLOSED, plan complete

Planning done. All decisions signed off by human one by one; detailed plan +
requirements + acceptance criteria live in the OPEN implementation ticket
**nid_rt0dyx6chv7fxae4k7q85f53l_e**
(`_tickets/implement-create-child-note-hover-chip-on-main-folder-note.md`).
Single implementation ticket (no ticket split needed).

Codebase findings that grounded the plan:
- Folder-note detection ALREADY exists: `src/shared/FolderNotes.ts` (pure;
  `Jon/Jon.md` > `Jon/Jon.canvas` > sibling `Jon.md` > sibling `Jon.canvas`)
  + `src/adapters/FolderNoteIndex.ts`, feeding `LinkProvider.getChildNotes/getParentNote`.
- NO vault-write seam exists yet — `VaultPort` (`src/adapters/obsidianPorts.ts`)
  is read-only; this feature adds the first one (new small port, not a widened VaultPort).
- Node hover UI lives in `src/view/NoteNode.tsx` (chips: pin/local-pin/gear;
  resize handles on edges/corner); icons via `GraphUiPort.renderIcon` (Obsidian `setIcon`).

Human-signed decisions (Q/A log, from `.out/current_decision.md`):
1. Placement: bottom-right corner INSIDE the note body (hover-revealed chip);
   no collision with the edge/corner resize handles.
2. Icon: lucide `file-plus-2`, aria/tooltip "Create child note".
3. Flow: click immediately creates `Untitled.md` (deduped `Untitled 1.md`, …)
   inside the folder, EMPTY, no name prompt; rename happens in the editor.
4. New note opens in the active editor and BECOMES the new MAIN (graph
   re-centers via normal active-file-change path).
5. Sibling pattern (`Jon.md` + `Jon/`): child also created INSIDE `Jon/`;
   pattern conflict already resolved by `FolderNotes` precedence.
6. Scope: ONLY main + already-a-folder-note. Out of scope: converting a plain
   note into a folder note, canvas children, templated content.
