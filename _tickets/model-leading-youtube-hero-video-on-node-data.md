---
id: nid_ur7veu8yqx8x6q8j6vz2z2ioa_e
title: Model leading YouTube hero video on node data
status: in_progress
deps: [nid_k7i845kkf64tb75bs854a29m9_e, nid_21xio7iwxv742ze4qc4p4qbmq_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_f3czh4cey22n7zc8prqadjlek_e]
created_iso: '2026-08-07T15:49:50Z'
status_updated_iso: '2026-08-07T17:44:46Z'
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, youtube, data-model]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
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

**2026-08-07T16:23:36Z**

PLAN REVIEW (2026-08-07): Added dep on the external-previews SETTING ticket (nid_21xio7iwxv742ze4qc4p4qbmq_e). Grounding: the engine already receives global settings verbatim (VicinityEngine.ts GraphBuildRequest.globalView: ViewSettings), and nodePreviewKind.ts ALREADY branches on a settings field (nodePreviewPreference). So the setting-aware hero choice is an ENGINE decision, modeled exactly like the existing preview-kind logic — it needs the new boolean leaf in SettingsSpec to exist first, hence the dep. Implementation seam: the leading-image pick is engine-side at VicinityTraversal.ts:186 (firstImagePath) and outline-vs-thumbnail precedence resolves in nodePreviewKind.ts:35-78 (auto branch line 76). Add the video as a new hero candidate AHEAD of thumbnail/outline in that same resolution, gated by the external-previews boolean; when OFF the resolution falls through to today's thumbnail/outline ladder unchanged (matches the OFF requirement in the render ticket).

**2026-08-07T16:47:42Z**

DECISION (human, 2026-08-07) — SCOPE = ALL NODES. The leading YouTube hero applies to EVERY node with a leading video, not just central/pinned. This is natural: body-derived content (attachments/outline/firstImage) is already computed for every discovered node in VicinityTraversal.ts:180-202, so the video hero is modeled the same way (a new hero candidate resolved in the engine alongside firstImage/outline in nodePreviewKind.ts), gated by the external-previews boolean. NOTE: the parent ticket's 'central+pinned only' limit was about the FUTURE separate url:-outbound-link nodes (D1-D3) — it does NOT constrain this hero-on-own-node slice.

**2026-08-07T16:52:41Z**

TICKET REVIEW (2026-08-07) — two seams the plan notes under-specify, verified against code:
1. NodeSizer is the SECOND consumer of nodePreviewKind (src/engine/NodeSizer.ts; the doc comment in src/engine/nodePreviewKind.ts says both consumers MUST agree). Adding a "video" preview kind therefore includes teaching NodeSizer the fixed 16:9 hero height, or content-fit sizing will reserve space for a region the node does not show. Coordinate the exact height constant with the render ticket (nid_15r71ajjkbel5s704kmj6wszw_e) — one named constant, engine-side, since the sizer needs it.
2. The hero FACT enters the engine via the LinkProvider metadata seam, exactly like imagePrecedesOutline: extend the FileMetadata shape in src/adapters/obsidianPorts.ts / the engine port, have ObsidianLinkProvider report it, and mirror it in src/engine/FakeLinkProvider.ts for fixture tests. "Thread engine -> adapters -> view" in the body reads backwards — the fact flows adapter -> engine -> view mapping.
3. PIN: preference "title-only" continues to blank EVERYTHING including the video hero — it stays the one documented preference that empties the slot (nodePreviewKind.ts early-out). Only the external-previews boolean and title-only can suppress an existing leading video.

**2026-08-07T17:04:36Z**

DECISION (human, 2026-08-07) — option A confirmed: the video is EXCLUSIVE winner of the existing preview slot (a new nodePreviewKind value, resolved ahead of thumbnail/outline, suppressed only by external-previews OFF and the title-only preference). It occupies the thumbnail's place in the node, so NodeSizer models it like the thumbnail region but with the fixed 16:9 height. Non-winning (non-leading) videos are out of scope here — future URL-node work (nid_ty5dmswuu1uw4uh8l6i8cdc0s_e).
