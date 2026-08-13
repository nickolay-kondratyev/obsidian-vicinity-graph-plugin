---
closed_iso: 2026-08-13T15:37:28Z
id: nid_uxugk82jeu4cfj5ujyk4l79e7_e
title: Add ability to visualize children notes
status: closed
deps: []
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e]
created_iso: '2026-08-13T14:41:16Z'
status_updated_iso: 2026-08-13T15:37:28Z
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

--------------------------------------------------------------------------------

## Resolution (2026-08-13, planning session)

PLAN completed with owner alignment (interactive session). All decisions locked in
the closed design-record ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e`
(`_tickets/plan-folder-note-descendants-ancestors-hierarchy-visualization.md`).
Key outcomes: renamed children -> DESCENDANTS; two new kind-pure engine channels
(descendants + ancestors) with own depth dials (MAIN 1/1, pinned 0/0, always-on);
folder-note conventions both supported, inside wins, md > canvas, NO `.base` in v1
(owner dropped it); edges merge per ordered pair (pure hierarchy = dashed no badge,
merged with a link = solid + badge, flyout explains the folder relation); truncation
tie-break Embeds > Links > hierarchy; "collapse, don't multiply" principle added to
CLAUDE.md. Implementation split into 5 dep-ordered tickets:
`nid_dit8h888p2ml3092b2zn4zy3u_e` (engine) -> `nid_bw8hltfj3nsyas03mpfmqn7mg_e`
(adapter) / `nid_i3cznjkcnelqzvhp0gqlis499_e` (settings UI) ->
`nid_f5bfjoymr2pt7odxieunkxasd_e` (view edges + flyout) ->
`nid_eymj85m7qccbpkoo4qj6b1q6t_e` (e2e + docs).
