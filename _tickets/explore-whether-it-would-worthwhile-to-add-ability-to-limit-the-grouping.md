---
closed_iso: 2026-08-15T05:29:28Z
id: nid_d422lwuzc4ks6v9dng9e3hd3e_e
title: Explore whether it would worthwhile to add ability to limit the grouping
status: closed
deps: []
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e]
created_iso: '2026-08-15T03:08:51Z'
status_updated_iso: 2026-08-15T05:29:28Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
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
Let's explore ability to add a slider in the grouping that would limit the depth of grouping.

Lets say we have grouping 0-20 with default at 20 (which essentially means as many group levels as you want).

If someone goes to 0 then there is NO grouping by folders at all. 

It should have a good hover over explaining what this does as well.

Right now lets explore to see if this is straightforward to add.

--------------------------------------------------------------------------------
## RESOLUTION (2026-08-15)

**Verdict: worthwhile AND straightforward.** Grouping is one pure function
(`deriveFolderGroups` in `src/view/folderGrouping.ts`, today always-on and
unbounded — the only gate is `MIN_GROUP_MEMBER_COUNT = 2`), and the existing
`edgeDepthIntoGroups` slider is an exact end-to-end wiring template. Rows
already render a description on the settings tab and as a hover tooltip on the
in-graph panel, so the "good hover" requirement is free.

**Decisions signed off by human** (via `.out/current_decision.md`):
- Depth N = RENDERED group-nesting levels (boxes the eye counts); a collapsed
  chain box `A/B/C` counts as ONE level. Groups deeper than N merge up into
  their level-N ancestor. When boxes disappear, relationships previously
  collapsed into group-boundary arrows resurface as individual note edges.
- Range 0–20, step 1, default 20 (effectively unlimited, no sentinel).
- At 0: no grouping; the "Edge depth into groups" and group-label rows render
  disabled via `disabledWhen`.
- Copy: label "Folder grouping depth"; description "Maximum levels of nested
  folder groups. 0 turns folder grouping off entirely; 20 is effectively
  unlimited."
- Structure: focused tickets (human preference).

**Tickets created:**
- Plan (closed, full detail): `nid_yyugpoh3gv8ip24cizvgrs4w4_e`
- Impl 1 — core depth cap in `deriveFolderGroups`: `nid_5086tzts48n7pnc4q77g7bk9e_e`
- Impl 2 — setting wired end-to-end (deps: 1): `nid_5vz7mtm2rn6n7nj9cp5mfbslx_e`
- Impl 3 — dependent rows disabled at 0 (deps: 2): `nid_dqu2jc1kln9ltwzy3lxxocdw7_e`
- Impl 4 — e2e rendered behavior (deps: 2, 3): `nid_ovayqcmi0vlmzyju40tdxw3sd_e`
