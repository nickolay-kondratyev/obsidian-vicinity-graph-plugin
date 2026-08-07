---
closed_iso: 2026-08-07T16:47:58Z
id: nid_mw1az1i1aznfoxqsgcwnfus07_e
title: Add procesing for external URL in the graph
status: closed
deps: []
links: [nid_21xio7iwxv742ze4qc4p4qbmq_e, nid_k7i845kkf64tb75bs854a29m9_e, nid_ur7veu8yqx8x6q8j6vz2z2ioa_e, nid_15r71ajjkbel5s704kmj6wszw_e, nid_ty5dmswuu1uw4uh8l6i8cdc0s_e, nid_tvtm9gj5zaj4tbfbpti3v6sy2_e]
created_iso: '2026-08-04T16:55:26Z'
status_updated_iso: 2026-08-07T16:47:58Z
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

## STATUS: UNBLOCKED — direction decided, YouTube hero slice split out (2026-08-07)

The embeds-UI blocker is resolved: the first slice is a **leading YouTube hero
video rendered inside the note's own node** (not a separate url: node), gated by a
single master "external previews" setting. Implementation is tracked in the split
tickets below; this ticket remains the home for the broader url-node work
(outbound-link nodes, D1–D3), which is now LOWER priority than the YouTube slice.

### D4 / former blocker — RESOLVED (2026-08-07)
Question was: can Obsidian markdown rendering show `![](https://youtu.be/…)` the
way Obsidian does WITHOUT being flagged for network calls?

Finding: `MarkdownRenderer.render()` renders it, but that emits a real `<img>` /
`<iframe>`, and the Chromium renderer then fetches the remote resource — a
YouTube `![]()` becomes a full Google iframe (cookies + tracking). So it IS a
network call; it just moves out of `requestUrl`/`fetch` where a code scanner sees
it. Obsidian has no automatic "network badge"; disclosure is a POLICY duty tied
to behavior, not to the API name. Dodging the scanner while still phoning home
would be evasion — rejected.

DECISION (human, 2026-08-07):
- **Previews are ON by default** so the feature shines (VSCode-telemetry-style),
  with **ONE master setting (KISS)** to turn ALL external previews OFF. On-by-
  default is acceptable **only with honest disclosure** (plugin description +
  setting help text state it contacts third-party servers). No hidden-fetch trick.
- `MarkdownRenderer` (or a direct embed iframe) is the **sanctioned mechanism**
  for the preview state; when the setting is OFF there is NO fetch and NO iframe.
- **First slice = leading YouTube hero video inside the note's node**: if a note
  has an expanded embed `![](<youtube-url>)` BEFORE the first heading AND before
  any image, render that video at the top of the note's graph node.
- Plain external images / other providers / separate url: outbound-link nodes
  (D1–D3) come later, under the SAME master setting.

### Split tickets (created 2026-08-07)
- `add-external-previews-setting-single-master-toggle-default-on.md`
  (`nid_21xio7iwxv742ze4qc4p4qbmq_e`) — the one master toggle, default ON, disclosed.
- `parse-leading-youtube-hero-embed-from-note-body.md`
  (`nid_k7i845kkf64tb75bs854a29m9_e`) — parsing (engine-pure).
- `model-leading-youtube-hero-video-on-node-data.md`
  (`nid_ur7veu8yqx8x6q8j6vz2z2ioa_e`) — data plumbing; deps parsing.
- `render-leading-youtube-hero-video-inside-the-graph-node.md`
  (`nid_15r71ajjkbel5s704kmj6wszw_e`) — node rendering; deps data-model + setting.

### INTERPRETATION FLAG for the human
I read "display the video within the graph node" as a **hero on the note's OWN
node** (like the existing node thumbnail), NOT a separate url: node that happens
to play video. The split tickets assume that. If you actually meant a distinct
external node, say so and the data-model/render tickets change.

### Decisions captured

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

## Notes

**2026-08-07T16:47:58Z**

PLAN COMPLETE — closing (2026-08-07). YouTube-hero slice fully specced across the 4 split tickets. Final decisions (human):
- SCOPE = all nodes with a leading YouTube embed (not just central/pinned). The central+pinned limit in this ticket governs the FUTURE separate url:-outbound-link nodes (D1-D3), still lower priority — NOT the hero-on-own-node slice.
- RENDER = click-to-play FACADE: lazy <img> poster from i.ytimg.com/vi/<id>/hqdefault.jpg (cookieless, no player JS, no fetch — url derived from parsed videoId), real youtube-nocookie.com/embed/<id> iframe only on click. Chosen because fit-view mounts all visible nodes at once (100-node cap) and live players would boot together; facade cost == existing lazy thumbnails. Grounded on viewport culling (onlyRenderVisibleElements, VicinityGraphFlow.tsx:240) + lazy imgs (NoteNode.tsx:185).
- Setting-aware hero is an ENGINE branch (engine already gets ViewSettings; nodePreviewKind.ts already branches on a settings field) => model ticket now deps the setting ticket.
- Mechanism/e2e pinned; parse URL forms scoped (youtu.be + watch?v=; shorts/embed/live/playlist out).
Remaining url:-node work (D1-D3, outbound-link nodes, Depth pill) stays open as future scope but is NOT tracked by this ticket anymore.
