---
id: nid_ur7veu8yqx8x6q8j6vz2z2ioa_e
title: "Model leading YouTube hero video on node data"
status: open
deps: [nid_k7i845kkf64tb75bs854a29m9_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e]
created_iso: 2026-08-07T15:49:50Z
status_updated_iso: 2026-08-07T15:49:50Z
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, youtube, data-model]
---

Carry the parsed leading YouTube hero video (from the parsing ticket) through the node model so the view can render it. Logical/data plumbing ONLY — no rendering here.

- Add the hero-video field to the engine node data structure and thread it engine -> adapters -> view mapping (src/view/flowMapping.ts flow-node union).
- Decide identity/dedup only if actually needed (a hero belongs to its note node; it is NOT a separate url: node in this slice).
- Keep engine pure (importGuard). BDD fixture tests.

Depends on the YouTube parsing ticket.
Context: _tickets/add-procesing-for-external-url-in-the-graph.md.


## Notes

**2026-08-07T16:05:02Z**

ADD (2026-08-07): hero selection must be setting-aware. When external previews
are OFF, the leading YouTube embed is NOT eligible as the node hero — the model
falls through to the existing hero logic (next image after the link / outline) as
if the video were a plain link. Model this so the ON/OFF choice is made at hero
selection, not patched in the renderer. See nid_15r71ajjkbel5s704kmj6wszw_e.
