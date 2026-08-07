---
closed_iso: 2026-08-07T17:14:56Z
id: nid_k7i845kkf64tb75bs854a29m9_e
title: Parse leading YouTube hero embed from note body
status: closed
deps: []
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e]
created_iso: '2026-08-07T15:49:50Z'
status_updated_iso: 2026-08-07T17:14:56Z
type: feature
priority: 2
assignee: nickolaykondratyev
tags: [external-preview, youtube, parsing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
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

**2026-08-07T16:52:52Z**

TICKET REVIEW (2026-08-07) — where the code lives, verified against the repo:
- The parser itself belongs in src/shared/ next to MarkdownInlineLinks.ts (pure, covered by the same import guard), NOT src/engine/ — the adapter (ObsidianLinkProvider) calls it while building FileMetadata and reports a plain "leading video" fact to the engine, the same shape as the existing imagePrecedesOutline fact. The engine never sees markdown text.
- Wiki-style embeds ![[...]] cannot carry an external URL, so only markdown-style ![](url) needs handling — no extra scope hiding there.
- "Before any image" must consider BOTH local image embeds/attachments AND (future) external image URLs; for this slice, comparing against the existing first-image position that feeds imagePrecedesOutline is sufficient.

**2026-08-07T17:14:56Z**

RESOLVED — leading YouTube hero PARSER shipped (engine-pure slice). All 1742 npm tests + tsc check green.

WHAT LANDED (pure, src/shared/, under importGuard — no obsidian/react/id-lib imports; only the JS `URL` global):

1. src/shared/YoutubeHeroEmbed.ts
   - YoutubeVideoIdentity { videoId, canonicalUrl } — the normalized identity output.
   - identityOfUrl(url): normalizes ONE url. IN scope: youtu.be/<id>, {www.,m.,}youtube.com/watch?v=<id> with arbitrary extra params (&t=, &list=). OUT (returns null): /shorts/, /embed/, /live/, playlist-only, non-youtube hosts, watch with no v, and any id not matching the canonical 11-char base64url shape /^[A-Za-z0-9_-]{11}$/. Start-time (t/start) is DROPPED per plan (identity = videoId + canonical watch URL only). canonicalUrl = https://www.youtube.com/watch?v=<id>; renderer derives poster/nocookie-embed from videoId.
   - leadingEmbedOf(body): LeadingYoutubeEmbed { identity, offset } | null — the FIRST expanded `![](youtube-url)` in the body, with the offset of its `!`. Masks code regions first (MarkdownCodeRegions, offset-preserving) so a fenced sample embed never counts.

2. src/shared/MarkdownInlineLinks.ts — new pure MIRROR of harvestedLinksOf: externalEmbedsOf(text): ExternalEmbed[] { url, offset }. Keeps EXTERNAL embed URLs (raw, query kept — watch?v= is significant) that harvestedLinksOf drops. This is the seam that makes the external URL SURVIVE instead of being discarded (the ticket's MarkdownInlineLinks.ts:84 concern). EMBEDS only (`!`); plain [](url) links excluded. Reuses the existing EXTERNAL_DESTINATION verdict (DRY).

SCOPE SPLIT / handoff to the model ticket (nid_ur7veu8yqx8x6q8j6vz2z2ioa_e):
- The "LEADING" positional verdict (video offset < first-heading offset AND < first-image offset) is NOT done here. The parser returns the youtube embed OFFSET; the adapter (ObsidianLinkProvider) already holds the heading offset and the first-image position behind imagePrecedesOutline and will make that comparison there, reporting a plain "leading video" FileMetadata fact — same shape/seam as imagePrecedesOutline (per that ticket's TICKET REVIEW note #2). This keeps positional policy in the adapter and the string parse pure. "Before any image" for this slice = local first-image only (external image embeds are future scope).

TESTS: src/shared/YoutubeHeroEmbed.test.ts (identity in/out-of-scope forms + leadingEmbedOf: leading, offset, plain-link-not-embed, fenced-code, earlier-non-youtube-external, none) and appended externalEmbedsOf cases in src/shared/MarkdownInlineLinks.test.ts. BDD WHEN/THEN, string fixtures (no obsidian). Pure change => npm test is the correct gate (no view/settings surface), per CLAUDE.md.
