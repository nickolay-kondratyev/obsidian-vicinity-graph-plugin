---
closed_iso: 2026-08-05T17:58:59Z
id: nid_1mq3t7706vw2kj2kv7ljqlw6l_e
title: "UX decide: content-fit nodes are floored at the CSS density rungs — any note with ONE heading is >= 122px"
status: closed
deps: []
links: [nid_k2pa8khm6ugozmhkd6nlbdrq6_e, nid_jcxzhexfaksge2arjzca3w7ff_e, nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: 2026-08-05T00:52:58Z
status_updated_iso: 2026-08-05T17:58:59Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui, decide, sizing]
---

Found in adversarial review of the content-fit sizing change (ticket nid_cx5zoz7ptucg9nxalibv0mbjb_e).

THE BUG THAT WAS FIXED (this ticket is only about which fix the owner wants long-term):
`src/engine/NodeSizer.ts` sized a node to the SUM of the regions it decided to show, but `src/view/graph-view.css` paints those regions only above container-query rungs (content-box 104px for the preview slot — outline OR thumbnail; 72px for the attachment chip row). A note with 2 renderable headings summed to 75px border-box, which is BELOW the 122px (104 + 18px chrome) reveal — so the node grew 35px for an outline the stylesheet then refused to paint: dead space, no outline, at every dial setting. Same for a title-only note with an attachment (61px, chips hidden).

FIX AS LANDED: `NodeSizer.revealFloorPx` floors any node whose preview kind is not "none" at `PREVIEW_VISIBLE_MIN_NODE_PX` (122px) and any attachment-bearing node at `ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX` (90px) — the same rule the thumbnail already used, now shared by every counted region. `minPx`/`maxPx` still clamp on top, so an explicit small `maxPx` still wins.

THE CONSEQUENCE THE OWNER SHOULD RULE ON: at shipped defaults (40/160) every note with even ONE renderable heading now renders at 122..160px, so size discriminates much less among outline-bearing notes, and graphs are denser in pixels than the "size fits the content" sketch implies. A title-only note is still minPx (40px), which is the headline win of Q1 and is unaffected.

Options:
1. Keep as landed (floor to the reveal). Consistent with the thumbnail rule; the fixed-height thumbnail slot genuinely needs 104px.
2. LOWER the outline + attachment reveal thresholds in `src/view/graph-view.css` so the outline paints at whatever height the sizer computed (one entry ~= 57px border-box). Most faithful to "a node is exactly big enough for what it shows"; keeps small notes small AND visible. Costs: the density ladder stops protecting against a squeezed outline on a user-dragged tiny node (the outline scrolls, so it degrades rather than breaks), and `e2e/nodeOutline.e2e.ts` E7 (the 72-104px "attachments only, outline hidden" band) is behaviour-capturing and would need explicit re-alignment.
3. Split the rungs: keep 104 for the thumbnail (fixed-height slot) and lower only the outline, since the outline can shrink.

Related: `docs-internal/tickets/ux-decide-hover-pin-chip-is-hidden-on-small-nodes-now-including-a-default-sized-empty-mainpinned-central.md` (nid_tclb98q9hxhmcuonamvr4ig1f_e) — option 2 would leave MORE nodes below the pin chip's 90px threshold, option 1 lifts most content-bearing nodes above it.

## Acceptance Criteria

Owner picks one of the three options; if it is not option 1, `NodeSizer.revealFloorPx` and/or the graph-view.css rungs are changed together with `src/view/nodeDensityThresholds.test.ts` (which pins engine constant == css rung + chrome) and the affected e2e band assertions.


## Notes

**2026-08-05T01:11:55Z**

Follow-up review of the same change found the floor was 2px short for CENTRALS: `[data-tier="main"]` / `[data-tier="pinned-central"]` draw a 2px accent border, so a central's content box is `sizePx - 20`, not `sizePx - 18`. Sized at the flat 122px floor, a MAIN note with 1-4 headings got a 102px content box, missed the 104px container query, and rendered as a title over dead space — the exact trap the floor exists to prevent. It was safe to ignore before this change only because centrals used to be pinned to maxPx.

FIXED: `revealMinNodePx(rung, isCentral)` in src/engine/constants.ts is now the ONE place `rung + chrome` is spelled out, `NodeSizer` floors (and sums) with the node's own chrome, and src/view/nodeDensityThresholds.test.ts parses BOTH `[data-tier]` borders so the central chrome cannot drift either. A central floors at 124/92 instead of 122/90 — which does not change the options this ticket asks the owner to pick between.

**2026-08-05T17:58:59Z**

OWNER DECISION (2026-08-05): option 1 — keep as landed, NO changes now. The CSS density rungs and revealMinNodePx stay where they are.

Rationale: rather than lower the rungs so tiny nodes can paint an outline, the owner wants to cut the DEMAND for the outline — in auto mode, non-central non-pinned notes should show TITLE ONLY. Peripheral notes then show no preview region at all, so the reveal floor never engages for them and they fall back to minPx; size discrimination is restored without touching the density ladder. The floor keeps doing its job exactly where the 104px slot is genuinely wanted (centrals, pinned, explicit overrides).

Follow-up: nid_k2pa8khm6ugozmhkd6nlbdrq6_e (_tickets/auto-preview-do-not-show-the-outline-by-default-for-non-central-non-pinned-notes.md). Closing this one.
