---
id: nid_q9xrbnj9kjtznese9xfsdgerp_e
title: "Link preview: render context as markdown (follow-up to raw-text v1)"
status: open
deps: [nid_z2k1eebic1nilpz9z3r65cnrx_e]
links: []
created_iso: 2026-07-31T18:49:32Z
status_updated_iso: 2026-07-31T18:49:32Z
type: task
priority: 4
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview, ui]
---

Follow-up to parent ticket nid_tohotgq2s92dvd1iov1rd0umv_e (_tickets/show-the-preview-of-the-links.md), which explicitly allows raw markdown context for v1.

Upgrade the link-preview modal rows from raw markdown text to rendered markdown using Obsidian MarkdownRenderer (NO current usage anywhere in src/ - this introduces it). Wrap it behind a narrow port with a Fake (layering rules: docs-internal/architecture-map.md); the raw-text path stays as the fallback when rendering fails. Keep [[wiki links]] inside rendered context non-navigating or clearly secondary so the row's own GO icon stays the primary affordance.

## Acceptance Criteria

- Context rows render markdown (bold, links, code) via a ported MarkdownRenderer seam with Fake
- Render failure falls back to raw text, never a blank row
- npm test and npm run check pass

