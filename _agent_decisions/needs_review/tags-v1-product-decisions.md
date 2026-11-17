# Tags V1 — product decisions made by the agent (2026-11-17)

The owner asked for (1) grouping by tags as an alternative to folders, with a
top-right toggle and tag colours, and (2) a tag-filtered graph mode with a
bottom-right status. These are the calls made for V1 without the owner; each
is cheap to revisit.

## Tag grouping

1. **Algorithm — "explain the most tag memberships", greedy and recursive.**
   At each level, for every tag carried by 2+ of the level's notes, take the
   group's tag SET = the tags shared by ALL of those notes; score =
   `members × tags in the set`. The best-scoring set becomes a box (ties: more
   members, then tag name); its notes are removed and the level repeats. Inside a
   box the same rule runs again on the remaining (not yet explained) tags, so
   boxes nest. A box with several shared tags is ONE box labelled with all of
   them (`#important #follow-up`), the tag analogue of the folder chain-collapse.
   - On the owner's example this yields
     `#important #follow-up [note1, #vital [note2, note3]]`, `#vital [note4, note5]`,
     `note6` loose with a `#visit` chip.
   - The owner's example listed `note2` beside `note1` and only `note3` under
     `vital`, but note2 and note3 carry identical tags, so any deterministic rule
     must place them together. Treated as a typo.
   - Ceiling: greedy, not optimal. Two notes sharing 10 tags outscore 15 notes
     sharing 1. Upgrade path: a members-weighted score. Recorded in code.
2. **A note renders once** — in exactly one box (no duplicated nodes).
3. **Leftover tags become chips on the note** (tags not already named by the
   note's enclosing boxes), only in tag-grouping mode, capped with a `+N`.
4. **Nested tags** (`#project/alpha`) also count as their parents (`#project`),
   matching Obsidian's own tag search. A box label drops a parent tag implied by a
   child tag in the same set.
5. **Same group size floor (2) and the same grouping-depth cap** as folders; the
   depth row is relabelled mode-neutral.
6. **Tag colours:** fixed preset families matched on the tag's last segment,
   case- and separator-insensitive (`follow-up` = `followup` = `Follow_Up`):
   - red: critical, urgent, blocker, bug, asap, fixme, error, broken, important
   - orange: todo, follow-up, wip, in-progress, pending, waiting, review, action
   - yellow: idea, question, draft, maybe, someday
   - green: done, complete, completed, resolved, approved
   - blue: reference, info, docs, research, learning
   - purple: project, goal, area
   - grey: archive, archived, deprecated, obsolete
   Every other tag gets a stable hash colour. Colours come from Obsidian's theme
   variables (`--color-red`, ...), so light/dark both work. User-assignable colours
   are deferred.
7. **The mode is a global setting** (like every other dial): a Grouping-section
   row in the settings tab + panel, and the dedicated top-right Folders | Tags
   toggle writes the same field.

## Tag-filtered mode

8. **Entry: RIGHT-click, not left-click.** Left-click on a tag is Obsidian's own
   "search this tag"; taking it over would surprise users. Entry points: the tag's
   right-click menu ("Vicinity graph: show tagged notes") in the editor (and in
   reading view / tags pane where feasible), a command-palette command with a tag
   picker, and clicking a tag box label or chip inside the graph.
9. **What shows:** every note carrying the tag (or a nested child tag), with the
   links between them; the node cap still applies. Pins do not add notes. No note
   is "the main note".
10. **The filter tag is not a grouping key** while filtering (every note has it,
    so it would only wrap the whole graph in one box).
11. **Sticky per view:** the filter stays while you open other notes (clicking a
    node opens it); it ends only via the status pill's exit button. It survives an
    Obsidian restart through the view's saved state.
12. **Bottom-right status pill** always shows the mode — "Vicinity of <note>" or
    "Tagged #tag · N notes" — with a hover explanation, plus an exit button in tag
    mode.
