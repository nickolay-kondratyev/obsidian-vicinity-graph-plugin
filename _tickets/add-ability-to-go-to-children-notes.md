---
id: nid_uxugk82jeu4cfj5ujyk4l79e7_e
title: Add ability to visualize children notes
status: in_progress
deps: []
links: []
created_iso: '2026-08-13T14:41:16Z'
status_updated_iso: '2026-08-13T14:53:07Z'
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


--------------------------------------------------------------------------------

Add ability to visualize children and hierarchical notes.

Right now we want to focus on ability to grab the children and ancestors on notes that are deemed to be child notes.

Child notes are notes that match the folder structure exactly as the note without the extension, Following the 'Folder Notes' obsidian plugin structure. I am thinking we support both ways and treat both of them as child notes without having to provide a setting for either

For example both of these example would be the deemed as children of Jon child note
```
Jon.md
Jon/child-of-jon-1
Jon/child-of-jon-2
```


```
Jon/Jon.md
Jon/child-of-jon-1
Jon/child-of-jon-2
```

We also want to support the following extensions to be picked up as child notes `.canvas` `.base` as they are supported by 'Folder Notes'. 

Implementation, I am thinking that for this to work we only need file paths, and if the file paths are already cached by obsidian we would favor getting them from the obsidian rather than reading the file paths ourselves.
