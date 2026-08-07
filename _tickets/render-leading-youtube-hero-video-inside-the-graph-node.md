---
id: nid_15r71ajjkbel5s704kmj6wszw_e
title: "Render leading YouTube hero video inside the graph node"
status: open
deps: [nid_ur7veu8yqx8x6q8j6vz2z2ioa_e, nid_21xio7iwxv742ze4qc4p4qbmq_e, nid_tvtm9gj5zaj4tbfbpti3v6sy2_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_tvtm9gj5zaj4tbfbpti3v6sy2_e, nid_21xio7iwxv742ze4qc4p4qbmq_e]
created_iso: 2026-08-07T15:49:50Z
status_updated_iso: 2026-08-07T15:49:50Z
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, youtube, ui]
---

Render the note node's leading YouTube hero video INSIDE its React Flow node, analogous to the existing node thumbnail/hero. The hero occupies the TOP of the node, ahead of the title/heading and any images (matches human ask).

MECHANISM: Obsidian MarkdownRenderer (sanctioned for the preview/opt-in state) or a direct YouTube embed iframe. This DOES cause a third-party network request BY DESIGN and MUST be gated behind the master external-previews setting (default ON). When the setting is OFF: no iframe, no request, graceful fallback (plain node / label).

WIRING: node component + NODE_TYPES in src/view/VicinityGraphFlow.tsx, flow node mapping in src/view/flowMapping.ts, styles in src/view/graph-view.css (styles.css is generated — do not hand-edit).

TESTS: view-layer DOM/CSS change => run npm run test:e2e (per CLAUDE.md) covering the rendered node with the setting ON and OFF. Rendered-node behavior is not reachable by npm test jsdom scans alone.

Depends on: the YouTube data-model ticket AND the external-previews setting ticket.
Context: _tickets/add-procesing-for-external-url-in-the-graph.md.


## Notes

**2026-08-07T16:05:02Z**

ADD (2026-08-07) — OFF behavior is a hard requirement, not just "render nothing":
When the external-previews setting is OFF, the leading `![](youtube-url)` must NOT
get special hero treatment at all. It is treated as a REGULAR (non-embedded)
external link, so the node's existing hero/outline logic runs unchanged — e.g.
the normal "find the image after the link" thumbnail selection and the outline
rendering take over exactly as if the video special-casing did not exist. I.e.
OFF removes the video from hero consideration; it does not blank the hero slot.
This likely means the ON/OFF branch lives where the hero is CHOSEN (data-model /
hero-selection), not only in the final render — coordinate with
nid_ur7veu8yqx8x6q8j6vz2z2ioa_e (data-model ticket).

**2026-08-07T16:23:36Z**

PLAN REVIEW (2026-08-07) — two decisions pinned to remove open forks:
1. MECHANISM = a direct privacy-domain iframe (https://www.youtube-nocookie.com/embed/<videoId>), NOT MarkdownRenderer. Rationale: we already own the parse and hold the videoId (parse ticket output), so MarkdownRenderer would re-parse work we own AND yields a cookie-ful google iframe; a direct nocookie iframe gives us sizing control and the least third-party exposure consistent with 'still contacts YouTube'. This stays within the human's D4 sanction ('MarkdownRenderer OR a direct embed iframe').
2. e2e = assert the DOM, not real playback. ON => an iframe element with the expected youtube-nocookie embed src for the videoId is present; OFF => NO iframe / no external request and the node falls back to its normal thumbnail/outline hero. Do NOT assert that YouTube actually loads (network-dependent => flaky). Sizing: give the hero a fixed 16:9 box at the top of the node (video aspect differs from the existing thumbnail); reuse the existing hero sizing seam where possible.

**2026-08-07T16:47:42Z**

DECISION (human, 2026-08-07) — RENDER = CLICK-TO-PLAY FACADE (supersedes the earlier 'live iframe on render' note for the ON state; the iframe is still the play target).

Why: all-nodes scope + React Flow fit-view mounts every visible node at once (up to the 100 node cap), so N live YouTube players would boot together. A facade keeps cost == today's lazy thumbnails.

Facade spec:
- Poster = a plain lazy <img>, src https://i.ytimg.com/vi/<videoId>/hqdefault.jpg (hqdefault ALWAYS exists; do NOT use maxresdefault — it 404s for non-HD uploads). Cookieless static CDN image, NO player JS, NO oEmbed/JSON fetch — the URL is derived purely from the parsed videoId. Reuse the existing lazy-<img> thumbnail treatment (NoteNode.tsx:185, loading=lazy).
- Overlay a play affordance. On click, swap the poster for the real iframe: https://www.youtube-nocookie.com/embed/<videoId> (fixed 16:9 box at the top of the node). At most 1-2 real players ever exist.
- Master toggle OFF => NO poster image request, NO iframe; node falls back to its normal thumbnail/outline hero (the OFF requirement is unchanged). The poster image IS a third-party (Google CDN) request, so it lives under the toggle too — lighter than the player, not zero-contact.

e2e (assert DOM, never real playback/network):
- ON  => facade poster <img> present with the expected i.ytimg.com/vi/<id> src; after a click the youtube-nocookie embed iframe is present.
- OFF => no poster img, no iframe, normal hero fallback.

**2026-08-07T16:52:47Z**

TICKET REVIEW (2026-08-07) — implementation gotchas verified against the view code:
1. LAYOUT: today's thumbnail renders BELOW the title inside .vicinity-graph-node__content (src/view/NoteNode.tsx:179-190). The hero "at the TOP of the node, ahead of the title" is therefore a NEW region above the title (likely a sibling of the content zone, like the outline is — see the sibling-not-child comment at NoteNode.tsx:193), not a reuse of the thumbnail slot position. Plan the CSS accordingly; prefer CSS over JS.
2. INTERACTION: the play affordance and the live iframe sit inside a draggable/selectable React Flow node. They need the nodrag/nopan escape-hatch classes and a stopPropagation click handler so play does not also select/drag the node or trigger node-open — copy the existing precedent (src/view/NodeOutline.tsx:43, src/view/NoteNode.tsx:65, src/view/GraphToolbar.tsx:30 comment).
3. SIZING: the fixed 16:9 hero height must be known to the engine NodeSizer via the new preview kind (see review note on nid_ur7veu8yqx8x6q8j6vz2z2ioa_e) — do not size the hero with a view-local constant.

**2026-08-07T17:04:35Z**

DECISION (human, 2026-08-07) — hero placement RESOLVED (option A, exclusive): when the video WINS the preview, it renders WITHIN the node in the SAME place the image/thumbnail renders today (inside .vicinity-graph-node__content, below the title) — it takes the thumbnail's slot, NOT a new region above the title. This SUPERSEDES point 1 of the earlier review note; points 2 (nodrag/nopan/stopPropagation) and 3 (NodeSizer owns the 16:9 height) stand. A video that does NOT win (not leading) is future URL-node scope (nid_ty5dmswuu1uw4uh8l6i8cdc0s_e), not this ticket. ALSO: build the poster/iframe URLs through the gated external-content seam (nid_tvtm9gj5zaj4tbfbpti3v6sy2_e, now a dep).
