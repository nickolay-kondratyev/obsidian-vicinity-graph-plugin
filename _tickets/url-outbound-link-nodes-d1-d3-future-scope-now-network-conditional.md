---
id: nid_ty5dmswuu1uw4uh8l6i8cdc0s_e
title: "URL outbound-link nodes (D1-D3) — future scope, now network-conditional"
status: open
deps: [nid_tvtm9gj5zaj4tbfbpti3v6sy2_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_tvtm9gj5zaj4tbfbpti3v6sy2_e]
created_iso: 2026-08-07T17:04:19Z
status_updated_iso: 2026-08-07T17:04:19Z
type: feature
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [external-preview, url-nodes]
---

Tracks the broader url:-node work split out of the closed planning ticket _tickets/add-procesing-for-external-url-in-the-graph.md (nid_mw1az1i1aznfoxqsgcwnfus07_e), which stopped tracking it. LOWER priority than the YouTube-hero slice.

Scope (decisions already made in that ticket): separate url:<normalized-url> nodes for external links from CENTRAL + PINNED notes; distinct UI element (~10-variant design showcase to pick the look); D1 nodes count toward the cap at LOWEST truncation priority; D2 dedup one node per URL, first-seen alias wins, xN occurrence count; D3 click opens OS browser. Follow-up: a pill in the Depth controls to toggle URL rendering.

PLANNING UPDATE (human, 2026-08-07): network calls are now CONDITIONALLY ALLOWED under the master external-previews toggle — the old alias-only constraint (adopted to avoid any network) is RELAXED. URL nodes may fetch thumbnails/favicons/preview data when the toggle is ON. HARD requirements: every such fetch goes through the single gated external-content seam (nid_tvtm9gj5zaj4tbfbpti3v6sy2_e) and OFF means zero network; alias-only rendering remains the OFF-state fallback.

ALSO in scope here (human, 2026-08-07): a video embed that does NOT win the node hero (e.g. it sits inside the body/outline, not leading) renders OUTSIDE the note node — as one of these URL nodes. Explicitly out of the YouTube-hero slice.

