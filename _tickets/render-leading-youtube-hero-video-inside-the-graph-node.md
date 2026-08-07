---
id: nid_15r71ajjkbel5s704kmj6wszw_e
title: "Render leading YouTube hero video inside the graph node"
status: open
deps: [nid_ur7veu8yqx8x6q8j6vz2z2ioa_e, nid_21xio7iwxv742ze4qc4p4qbmq_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e]
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
