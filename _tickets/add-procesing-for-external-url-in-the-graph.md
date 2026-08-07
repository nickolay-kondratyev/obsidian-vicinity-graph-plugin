---
id: nid_mw1az1i1aznfoxqsgcwnfus07_e
title: Add procesing for external URL in the graph
status: open
deps: []
links: []
created_iso: '2026-08-04T16:55:26Z'
status_updated_iso: 2026-08-07T00:44:11Z
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

## STATUS: PAUSED — blocked on an embeds-UI rethink (2026-08-06)

Explored the design and made the decisions below, then paused. Detailed
sub-tickets were discarded on purpose; THIS ticket is the only artifact. Do not
start implementation — the blocker below comes first.

### BLOCKER (why paused)
External **embeds** (`![](https://…/pic.png)`) are the main case worth surfacing,
but showing a node labelled just "pic.png" is low value. Embeds need their OWN,
better UI experience first — likely **grouping a central node's embeds together
under it** — and that should land BEFORE the external-URL feature. Revisit this
ticket after the embeds-UI direction exists.

### Decisions captured
- **No network calls, ever.** Obsidian has no API to read a URL's title/favicon
  without a flagged network call (`requestUrl` IS one). So a URL can only be
  labelled from the URL string itself + the author's alias — never fetched
  metadata. (Obsidian already fetches external image embeds itself when rendering
  a note; our graph node would add no fetch and never show the remote image.)
- **Scope:** render external URLs from **central + pinned** notes only, not from
  ordinary traversed neighbours. A follow-up would add a **pill in the Depth
  controls** to toggle URL rendering on/off.
- **New node kind:** URLs are not vault docs (no docid) — they need their own id
  space (`url:<normalized-url>`) and a **distinct UI element** that clearly reads
  as "external, not a local note". A ~10-variant design showcase was to pick the
  look. A URL node also needs to carry its kind (plain **link** vs **embed**).
- **D1 — node cap:** URL nodes COUNT toward the cap, at LOWEST truncation priority
  (notes kept first).
- **D2 — dedup + count:** one node per URL (first-seen alias wins); show an `×N`
  occurrence count from the central, and the link fly-out should preview WHERE the
  central references it.
- **D3 — click:** opens the URL in the OS browser (`window.open`); KISS — no
  modifier, no in-Obsidian preview, no confirm.
- **D4 — forms (UNRESOLVED, the blocker):** plain links `[label](url)` are the
  clear win. Embeds `![](url)` are wanted but need the embeds-UI experience above
  before they belong here.

### Codebase notes for whoever picks this back up
External URLs are discarded at 3 layers today
(`src/adapters/ObsidianLinkProvider.ts:250`, `src/shared/MarkdownInlineLinks.ts:84`,
`src/adapters/CanvasFallbackParser.ts:18`). Alias/`displayText` lives in Obsidian's
raw cache but isn't modeled in `ReferencePort` (`src/adapters/obsidianPorts.ts:35`);
`MarkdownInlineLinks.EXTERNAL_DESTINATION` already recognises external destinations,
so parsing the body ourselves (repo's "we own parsing" precedent) is the robust
source. Rendering needs a new React Flow node kind end-to-end
(`src/view/flowMapping.ts` union → new `UrlNode.tsx` → `NODE_TYPES` in
`src/view/VicinityGraphFlow.tsx:41` → `src/view/graph-view.css`).
