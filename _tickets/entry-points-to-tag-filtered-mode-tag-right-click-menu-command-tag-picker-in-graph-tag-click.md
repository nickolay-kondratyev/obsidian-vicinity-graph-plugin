---
id: nid_6qj8n7uc7zz126l3ix8czfymq_e
title: "Entry points to tag-filtered mode: tag right-click menu, command + tag picker, in-graph tag click"
status: in_progress
deps: [nid_aimlia0wjp0ms0uzd4fvhbomo_e, nid_lmftfz11vvfwj382i4xmmoqgf_e]
links: []
created_iso: 2026-11-17T20:32:45Z
status_updated_iso: 2026-11-17T21:23:39Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/.worktree/t-6qj8n7uc
---

## Goal
Users can reach the tag-filtered graph from where they meet tags. Builds on the mode API from `nid_aimlia0wjp0ms0uzd4fvhbomo_e` and the tag boxes/chips from `nid_lmftfz11vvfwj382i4xmmoqgf_e`, and closes the seam between them.

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`. Read `_agent_decisions/needs_review/tags-v1-product-decisions.md` (sections 8 and 10) first. The owner wrote "left click … menu"; decision 8 explains why it is RIGHT-click (left-click is Obsidian's own tag search) — do not hijack left-click.

## Done criteria
- Right-click on a tag in the editor (Live Preview and Source mode, body hashtags) offers "Vicinity graph: show tagged notes" (Obsidian `editor-menu` event; find the tag under the click with a PURE, unit-tested function, e.g. tag-at-offset over the line text). Choosing it opens/reveals the graph in tag mode for that tag.
- Same item where feasible on: reading-view tags (`a.tag`), the core Tags pane, and frontmatter `tags` property pills. Investigate in real Obsidian (the e2e harness) and implement the ones that work without fighting Obsidian's own menus; report which were skipped and why.
- Command palette: "Show notes with tag…" opens a fuzzy tag picker over the vault's tags (with note counts) and enters tag mode.
- Inside the graph: clicking a tag box label or a tag chip enters tag mode for that tag (in the same view). Folder box behavior unchanged.
- While a view is tag-filtered and grouping is Tags, the filter tag (and its parent tags) is never a grouping key (decision 10) — pass it as the grouper's excluded tags.
- Tag chips hang ~22px below a note, but a group box's bottom padding is 16px, so the chip of the lowest note in a TAG box crosses the box's bottom border. Give tag boxes enough extra bottom padding (tag boxes only; folder layout unchanged) — unit-test the padding rule.
- Tests: unit tests for tag-at-offset and the menu-item decision; extend the tag e2e specs (or add one) to cover: editor right-click on a `#tag` ⇒ menu item ⇒ only tagged notes render; command + picker ⇒ tag mode; click a tag chip in the graph ⇒ tag mode. No CSS/look assertions.
- `npm run check`, `npm test`, the tag e2e specs green.

## Context
- No menus or suggest modals exist yet (`src/main.ts:205-214` registers two plain commands). `main.ts` is the plugin wiring point; keep Obsidian `Menu`/`SuggestModal` code in a thin adapter/view class, decision logic pure.
- Tag rules: shared module from `nid_mr42m1k8cmyeusemmvmxuuaxb_e`.

## Non-goals
- Overriding left-click; a hover menu; multi-tag queries.
