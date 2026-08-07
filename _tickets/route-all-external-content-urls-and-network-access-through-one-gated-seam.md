---
id: nid_tvtm9gj5zaj4tbfbpti3v6sy2_e
title: Route ALL external-content URLs and network access through ONE gated seam
status: in_progress
deps: [nid_21xio7iwxv742ze4qc4p4qbmq_e]
links: [nid_15r71ajjkbel5s704kmj6wszw_e, nid_21xio7iwxv742ze4qc4p4qbmq_e, nid_ty5dmswuu1uw4uh8l6i8cdc0s_e,
  nid_mw1az1i1aznfoxqsgcwnfus07_e]
created_iso: '2026-08-07T17:04:06Z'
status_updated_iso: '2026-08-07T17:31:17Z'
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [external-preview, architecture]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
DECISION (human, 2026-08-07): network calls to third parties are now CONDITIONALLY ALLOWED — gated by the master external-previews setting (_tickets/add-external-previews-setting-single-master-toggle-default-on.md). That makes the OFF guarantee a real invariant we must be able to PROVE, not a convention. Build ONE seam that all external content flows through:

- ONE module is the only place external hosts/URLs are ever constructed (first residents: i.ytimg.com poster URLs, youtube-nocookie.com embed URLs; later: any thumbnail/favicon/oEmbed fetch via requestUrl). Suggested home: a pure URL-builder in src/shared/ plus, when actual fetches arrive, one adapter class wrapping requestUrl/fetch behind an engine-defined port (DIP, like LinkProvider).
- The seam consults the external-previews setting: OFF => it refuses (no URL issued, no fetch made). Unit-test BOTH states through the seam — the OFF test is the guarantee.
- STRONG BLOCK, repo-idiom: add a source-scan tripwire test (same pattern as ACCESSOR_OWNED_SYMBOLS / typedNumberFields.test.ts) that fails if ANY module outside the sanctioned seam references an external host literal, fetch(, or requestUrl(. This is what makes "OFF means zero network" enforceable as the feature grows, instead of a per-feature promise.
- NOTE the current slice's belt-and-suspenders: the YouTube hero is ALSO gated engine-side at hero selection (nid_ur7veu8yqx8x6q8j6vz2z2ioa_e), so when OFF the view never even receives a video hero. The seam is the second, structural layer.

Deps: the master-toggle setting ticket. The render ticket (nid_15r71ajjkbel5s704kmj6wszw_e) should build its poster/iframe URLs through this seam.
