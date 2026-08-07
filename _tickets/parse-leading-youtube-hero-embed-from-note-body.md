---
id: nid_k7i845kkf64tb75bs854a29m9_e
title: "Parse leading YouTube hero embed from note body"
status: open
deps: []
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e]
created_iso: 2026-08-07T15:49:50Z
status_updated_iso: 2026-08-07T15:49:50Z
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, youtube, parsing]
---

Detect a YouTube video declared as an EXPANDED embed `![](<youtube-url>)` (youtu.be/... or youtube.com/watch?v=...) that appears BEFORE the first markdown heading AND before any image embed in the note body. Only a LEADING video counts as the node hero (matches the human ask: "video ... before heading and before images").

OUTPUT: a normalized video identity (video id + canonical URL) for downstream data-model/rendering. No network, no fetch — parse the string only.

BUILD ON EXISTING PARSING:
- src/shared/MarkdownInlineLinks.ts — EXTERNAL_DESTINATION already recognizes external destinations; repo precedent is "we own parsing".
- External URLs are currently DISCARDED at src/adapters/ObsidianLinkProvider.ts:250, src/shared/MarkdownInlineLinks.ts:84, src/adapters/CanvasFallbackParser.ts:18 — the leading YouTube embed must survive rather than be dropped.

CONSTRAINTS: engine-pure (no obsidian/obsidian-id-lib/react imports; guarded by src/engine/importGuard.test.ts). BDD tests (WHEN..THEN), one behavior each, fixture-tested via Fake providers. Start from a failing test.

SCOPE: YouTube ONLY for now. Other providers / plain external images are later slices under the same master setting.

Context: _tickets/add-procesing-for-external-url-in-the-graph.md.


## Notes

**2026-08-07T16:23:36Z**

PLAN REVIEW (2026-08-07): Explicit OUT OF SCOPE for this first slice — youtube.com/shorts/, /embed/, /live/, and playlist-only URLs. IN scope: youtu.be/<id> and youtube.com/watch?v=<id> (with arbitrary extra query params like &t=). Normalize to a bare videoId + canonical URL; the renderer builds the nocookie embed URL from the videoId. Preserve a start-time (t/start param) ONLY if trivial, otherwise drop it — not worth blocking the slice.
