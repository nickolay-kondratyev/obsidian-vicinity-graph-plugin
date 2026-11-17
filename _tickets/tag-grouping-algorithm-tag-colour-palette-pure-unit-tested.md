---
id: nid_86c83wvlt5tbfs6s9ttr8r7mq_e
title: "Tag grouping algorithm + tag colour palette (pure, unit-tested)"
status: in_progress
deps: [nid_44yk50pp4xl9yexnoufqsiytj_e, nid_mr42m1k8cmyeusemmvmxuuaxb_e]
links: []
created_iso: 2026-11-17T20:32:45Z
status_updated_iso: 2026-11-17T20:49:51Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/.worktree/t-86c83wvl
---

## Goal
A pure, deterministic tag grouper that produces the mode-agnostic grouping result (from `nid_44yk50pp4xl9yexnoufqsiytj_e`), plus the tag colour rule. This is the brain of "group by tags"; wiring/UI is the next ticket (`nid_lmftfz11vvfwj382i4xmmoqgf_e`).

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`. Read `_agent_decisions/needs_review/tags-v1-product-decisions.md` (sections 1-6) first — it is the spec.

## Done criteria
- Grouping algorithm per decision 1 ("explain the most tag memberships", greedy, recursive): at each level, for each tag carried by >= 2 of the level's notes, the candidate box's tag SET = tags shared by ALL those notes; score = members x set size; ties: more members, then tag name; winners' notes leave the level and it repeats; inside a box the rule re-runs on the not-yet-explained tags. Multi-tag sets are ONE box labelled with all its tags; a parent tag implied by a child tag in the same set is dropped from the label.
- Owner example is a unit test: notes `note1 {follow-up, important}`, `note2 {follow-up, important, vital}`, `note3 {follow-up, important, vital}`, `note4 {vital}`, `note5 {vital}`, `note6 {visit}` ⇒ one box `important+follow-up` containing note1 and a nested `vital` box [note2, note3]; a top-level `vital` box [note4, note5]; note6 ungrouped.
- Each note renders in exactly one box (or none). The grouper answers each note's LEFTOVER tags (its tags not named by its enclosing boxes — note6 ⇒ `visit`) so the view can draw chips.
- Accepts an "excluded tags" input (tags never used as group keys — the tag-filter mode passes its filter tag, decision 10) and honours the existing grouping depth cap and the 2-member floor (`MIN_GROUP_MEMBER_COUNT` in `src/view/folderGrouping.ts`).
- Deterministic: same input ⇒ same output (it is called independently by elk and flow mappings — see the CONTRACT in `src/view/folderGrouping.ts`).
- Tag colour rule (decision 6): preset families matched on the tag's last segment, case- and separator-insensitive; every other tag a stable hash into the same palette; output is a colour TOKEN that maps to Obsidian theme variables (`--color-red`, `--color-orange`, …) — no hex. Unit-tested: `follow-up`, `FollowUp`, `todo` ⇒ orange; `critical` ⇒ red; an unknown tag ⇒ the same token every call.
- Edge cases covered by tests: no tags at all (no boxes), every note sharing one tag, nested tags (`project/alpha`, `project/beta` ⇒ `project` box with nested boxes), excluded tag, depth cap 0 and 1.
- Mark the greedy ceiling in a code comment (decision 1: 2 notes x 10 tags outscore 15 x 1; upgrade path: members-weighted score).
- `npm run check` and `npm test` green.

## Context
- Tag rules (normalise, nested expansion) live in the shared module from `nid_mr42m1k8cmyeusemmvmxuuaxb_e` — call them, never re-implement.
- Place the grouper beside `src/view/folderGrouping.ts` (view layer, pure, RF-free), colour rule in its own small pure module.

## Non-goals
- No setting, no rendering, no UI. No user-assignable colours. No folder colours.
