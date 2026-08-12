---
closed_iso: 2026-08-12T17:20:29Z
id: nid_zklwx8uxsk3bzvgcbnm3wvvj9_e
title: Add ability to have frontmatter field link to ids
status: closed
deps: []
links: [nid_sjojyvd55emyry45qynphei7o_e]
created_iso: '2026-08-10T18:25:45Z'
status_updated_iso: 2026-08-12T17:20:29Z
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
GOAL: add ability to link based on note `id` field from frontmatter.

For example ticket notes used 

```
deps: [note-id-1]
links: [note-id-2, note-id-3]
```

'note-id-1' is the `id` field in frontmatter of some_note_with_note-id-1_in_id_field.md
```
---
id: note-id-1
---
```

--------------------------------------------------------------------------------
We would like to be able to display these relationship in the graph. 

For now we will use the regular links out budget to process them in the graph.

My assumption, is that this should be straighforward to do as Obsidian should already CACHE the frontmatter in its index. Do NOT read entire vault to power this feature if we are not able to pull from Obsidian cache then STOP the planning and pull in the human.

--------------------------------------------------------------------------------
# RESOLUTION (2026-08-12) — planning complete, ticket closed

Feasibility confirmed: `app.metadataCache.getFileCache(file).frontmatter` caches
frontmatter (the adapter already reads it for title overrides), so the feature is
powered by a cache-only reverse `id -> path` index — NO vault file reads. The STOP
condition did not trigger. Notable finding: for markdown notes the frontmatter `id`
field IS the docid written by `stable-ids-for-obsidian`; this feature reads it only.

Human decisions locked (Q&A in chat, 2026-08-12):
- Field list is a SETTING, DEFAULT EMPTY (user adds each field name; row carries
  explanatory info text).
- BOTH directions (outgoing id-refs + incoming referrers), riding the existing
  link-out / link-in channels and budgets. Engine untouched; adapter-layer feature.
- KISS edge appearance: id-ref edges render as ordinary `kind: "link"` edges.
- Values: scalar + list, strings only (quoted YAML strings included); unresolved
  ids silently skipped; self-references skipped.

Tickets created:
- `nid_sjojyvd55emyry45qynphei7o_e` — high-level PLAN (closed; the design record).
- `nid_dthnhlzp0wzxqhcozj3f8ih5h_e` — Part 1: settings spec leaf + text row (open).
- `nid_phu0llxhfptse000j66ezrhh3_e` — Part 2: FrontmatterIdIndex + ObsidianLinkProvider
  merge + e2e (open, deps: Part 1).
- `nid_uykmq7xpow597qs6bpgrhanlt_e` — backlog: distinct id-ref edge styling (p4).
