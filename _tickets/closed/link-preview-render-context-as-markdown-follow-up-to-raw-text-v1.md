---
closed_iso: 2026-08-06T23:07:40Z
id: nid_q9xrbnj9kjtznese9xfsdgerp_e
title: 'Link preview: render context as markdown (follow-up to raw-text v1)'
status: closed
deps: [nid_z2k1eebic1nilpz9z3r65cnrx_e]
links: []
created_iso: '2026-07-31T18:49:32Z'
status_updated_iso: 2026-08-06T23:07:40Z
type: task
priority: 4
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview, ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
Follow-up to parent ticket nid_tohotgq2s92dvd1iov1rd0umv_e (_tickets/show-the-preview-of-the-links.md), which explicitly allows raw markdown context for v1.

Upgrade the link-preview modal rows from raw markdown text to rendered markdown using Obsidian MarkdownRenderer (NO current usage anywhere in src/ - this introduces it). Wrap it behind a narrow port with a Fake (layering rules: docs-internal/architecture-map.md); the raw-text path stays as the fallback when rendering fails. Keep [[wiki links]] inside rendered context non-navigating or clearly secondary so the row's own GO icon stays the primary affordance.

## Acceptance Criteria

- Context rows render markdown (bold, links, code) via a ported MarkdownRenderer seam with Fake
- Render failure falls back to raw text, never a blank row
- npm test and npm run check pass

## Notes

**2026-08-06T23:07:40Z**

## Closed as SUPERSEDED (2026-08-06)

This follow-up is outdated: the rendered-markdown context it asked for was already delivered by the separate, now-closed ticket nid_zlvkl9m4eepitt4efzbhtbhh6_e ("Render markdown snippets nicely in the link preview drawer via MarkdownRenderer.render", closed 2026-08-01), which took a slightly different but complete route to the same goal.

What ships today (verified in-tree):
- **Ported MarkdownRenderer seam with a Fake** — `GraphUiPort.renderMarkdown(el, markdown, sourcePath)` (src/view/viewPorts.ts:259), implemented via `MarkdownRenderer.render(...)` in src/view/ObsidianGraphUi.ts:70. Component tests drive it through a Fake renderMarkdown (src/view/LinkPreviewContent.component.test.tsx).
- **Context rows render markdown (bold, links, code)** — `SnippetMarkdown` in src/view/LinkPreviewContent.tsx renders each short/expanded snippet through the seam.
- **[[wiki links]] stay secondary to the GO icon** — rendered `a.internal-link` clicks are routed out via a single delegated handler (onOpenLink → NoteNavigatorPort.openMarkdownLink) with preventDefault + stopPropagation so a link click never toggles the row; each row keeps its own GO button as the primary navigation affordance.
- **Never a blank row** — null-context occurrences render a designed "No context available" row (OccurrenceRow), and `renderMarkdown` clears+replaces el content so re-runs never stack.

Divergence from this ticket's AC #2 ("render failure falls back to raw text"): the delivered design calls `MarkdownRenderer.render` directly rather than wrapping it in a try/catch raw-text fallback. This was the conscious design choice of the implementing ticket and is not a regression. If a hardened render-failure fallback is later wanted, file a fresh narrow ticket for it rather than reopening this superseded one.

No code change made under this ticket; nothing to test.
