---
closed_iso: 2026-08-07T00:05:32Z
id: nid_mw1az1i1aznfoxqsgcwnfus07_e
title: Add procesing for external URL in the graph
status: closed
deps: []
links: [nid_hyzwoqadcfyvisveczuet3e8c_e, nid_prsk9olcj9u2fpzqgv5gb6zhe_e, nid_ccsw8o1rjcs2l7o1elgmlqx5i_e, nid_uqgew1fuqgrdyvas6eum6vaf2_e]
created_iso: '2026-08-04T16:55:26Z'
status_updated_iso: 2026-08-07T00:05:32Z
type: task
priority: 4
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.


Let's add processing of external URLs so that we are able to see what is the central node or the pinned node links out to.

What I am thinking here is being able to see the external links that the central node links out to. I am thinking is that we want to avoid rendering entire URL page. We also want to avoid the network calls for now as that can greatly limit the adoption and trust of a plugin. So I am thinking for now we will only render URL links that have aliases. To avoid having to fetch the URL links and get flagged for network calls (unless obsidian has some API to fetch the data from the links without getting flagged for network calls). IF we cannot get fetch the data through obsidian API withouit getting flagged for network calls then I am thinking we limit the URL rendering only to the URLs that have aliases.

We will want to have a different UI node element for the URL rather than the note so its clear to the user that this is not a local element. (As part of planning lets create a dependency to create multiple proposals of the element design for the human to pick (I am thinking a showcase of 10 different nodes to choose one from)) 

TO start out we will just render the URLs from the Pinned and Central nodes. However, we will want to have a follow-up ticket to add a PILL like configuration in the 'Depth' configuration which will control whether the URLs are rendered or not.

---

## PLANNING RESOLUTION (2026-08-06)

Planning complete. Split into 4 tickets (all `link`ed to this one).

### Key finding on network calls
Obsidian has **no** API to read a URL's title/favicon without a network call
(`requestUrl` IS a flagged network call). So the alias-only approach is the right
constraint — we render ONLY external URLs that already carry an author-written
alias (the markdown link display text), and never fetch anything.

### Key finding on codebase fit
External URLs are discarded at 3 layers today
(`src/adapters/ObsidianLinkProvider.ts:250`, `src/shared/MarkdownInlineLinks.ts:84`,
`src/adapters/CanvasFallbackParser.ts:18`). Alias/`displayText` exists in Obsidian's
raw cache but isn't modeled in `ReferencePort` (`src/adapters/obsidianPorts.ts:35`).
Node identity is `VaultPath`-keyed everywhere, so URL nodes need their own id space
(`url:<normalized-url>`) and their own engine collection. Rendering needs a NEW
third React Flow node kind end-to-end (`flowMapping.ts` union → new `UrlNode.tsx` →
`NODE_TYPES` in `VicinityGraphFlow.tsx:41` → `graph-view.css`).

### Tickets created
1. `nid_hyzwoqadcfyvisveczuet3e8c_e` — **Design showcase**: ~10 external-URL node
   variants, human picks one (the dependency the ticket asked for). Blocks #3.
2. `nid_prsk9olcj9u2fpzqgv5gb6zhe_e` — **Engine + adapter**: surface aliased
   external URLs from central/pinned notes, model as engine nodes/edges, headless +
   fully unit-tested.
3. `nid_ccsw8o1rjcs2l7o1elgmlqx5i_e` — **View rendering**: new `external-url` node
   kind rendering the chosen design; click opens in browser. Depends on #1 + #2.
4. `nid_uqgew1fuqgrdyvas6eum6vaf2_e` — **Follow-up**: Depth-controls PILL to toggle
   URL rendering (the follow-up the ticket asked for). Depends on #2 + #3.

### Open decisions (defaults chosen; tagged `decide`, and in
`.ai_out/_current_decision/current_decision.md` for human review)
- D1 node cap: URL nodes exempt from cap/truncation (bounded by central out-degree).
- D2 dedup: one node per URL, first-seen alias wins, one edge per source central.
- D3 click: `window.open` to OS browser, no modifier/preview/confirm.
- D4 scope: body plain links + frontmatter property links; embedded external URLs out.
- D5 visual: decided by the showcase ticket.
