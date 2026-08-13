---
closed_iso: 2026-08-13T19:42:58Z
id: nid_otmc0t1jlcuwy3g3a3iychvl0_e
title: Improve descendent and ancestor processing - add special case for folder notes
status: closed
deps: []
links: [nid_025cydqct380d8ik9jhr9hhfn_e]
created_iso: '2026-08-13T19:31:34Z'
status_updated_iso: 2026-08-13T19:42:58Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
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

Adding special case for folder notes, for ancestors and descendents.

Right now we have 

```
note1/
note1.md
note1/other/other.md
```

[note1] -> [other] : is not seen as a descendent due to folder skip.

However, we should treat these as special case, we should recognize that 
other/ is right under note1/ and note1/ is the folder tied to note.md and GIVEN that other/ has other.md HENCE they should be linked as parent child note - at level 1 of descendent 

same thing with ancestor other.md should see that its tied to other/ folder and therefore can go up to note1.md - as level 1 ancestor.

--------------------------------------------------------------------------------

## RESOLUTION (2026-08-13, PLAN completed)

Explored the codebase and found the folder-note hierarchy feature already exists
end-to-end (`src/shared/FolderNotes.ts` + `descendants`/`ancestors` channels in
`src/engine/VicinityTraversal.ts`). Key findings:

- **Ancestor half of this ticket ALREADY WORKS**: `parentNoteOf("note1/other/other.md")`
  resolves to `note1.md` (inside-style notes walk up, `src/shared/FolderNotes.ts:102-106`).
- **Descendant half is the gap**: `childNotesOf("note1.md")` lists only files DIRECTLY in
  `note1/`, so the inside-style subfolder note `note1/other/other.md` is never reached.
- This gap was a **documented "accepted asymmetry"** (`docs-internal/plan/high-level-plan.md:76`,
  owner-locked rule from plan `nid_ri1d36t7hmhu0kr652wny1dmz_e`), so fixing it is a conscious
  design reversal, including editing the behavior-capturing test in
  `src/engine/hierarchyChannels.test.ts`.

Human signed off (via `.out/current_decision.md`) on all four decisions:
1. YES — reverse the asymmetry: a direct subfolder's inside-style folder note becomes a
   level-1 descendant (symmetric with the ancestor walk).
2. YES — minimal scope: only the subfolder's folder note bridges; note-less folders still
   not bridged; deeper files stay level 2+.
3. YES — ancestor side is test-only (verifying BDD test, no code change).
4. YES — single open implementation ticket (no plan/impl split needed).

**Implementation ticket (open, linked): `nid_025cydqct380d8ik9jhr9hhfn_e`**
(`_tickets/folder-note-descendants-bridge-inside-style-subfolder-notes-to-level-1.md`)
carries the full detailed plan, tests, doc updates and acceptance criteria.
