---
id: nid_9evsq3tz9oy6zk41i1qak6w3x_e
title: "excludedNodeCount counts excluded attachments that were never node candidates"
status: open
deps: []
links: []
created_iso: 2026-08-15T00:41:50Z
status_updated_iso: 2026-08-15T00:41:50Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [engine]
---

ROOT CAUSE: src/engine/VicinityTraversal.ts:146-156 — the exclusion gate runs BEFORE the isNodeBearing check (deliberately, to skip the metadata read), so a non-node-bearing neighbor (image/pdf attachment) whose path matches an exclusion pattern is recorded via collector.recordExcluded and inflates excludedNodeCount — yet it could never have been a node, and it STILL renders as the linking note's attachment chip/thumbnail (attachments come from FileMetadata.attachments, untouched by exclusion). Scenario: a.md embeds assets/pic.png, exclusion pattern ^assets/ → graph is byte-identical to the no-exclusion graph but the toolbar badge (src/view/GraphToolbar.tsx) claims "1 node(s) excluded".

FAILING TEST (committed, it.fails — flip to it as acceptance): src/engine/VicinityTraversal.test.ts, "WHEN an exclusion pattern matches only an attachment THEN the excluded-node count stays zero".

FIX NOTE: checking isNodeBearing before recordExcluded costs the metadata read the current ordering avoids — consider recording the excluded PATH and counting only node-bearing ones lazily, or accepting the metadata read for the (rare) excluded branch. Decide whether an excluded ATTACHMENT should also stop rendering as attachment chip (probably not — exclusion is about nodes).

