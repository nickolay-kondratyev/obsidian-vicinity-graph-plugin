---
id: nid_ygo7h95ssgmunaqsprc1zlmfh_e
title: "Canvas text-node markdown-style links ([a](b.md)) produce no edge in the fallback regime"
status: open
deps: []
links: [nid_s676x55uojmtcwh9t4l9mc6zl_e]
created_iso: 2026-07-27T19:51:01Z
status_updated_iso: 2026-07-27T19:51:01Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

Follow-up from the canvas link regime unification (ticket nid_s676x55uojmtcwh9t4l9mc6zl_e).

src/adapters/CanvasFallbackParser.ts now harvests WIKILINKS ([[note]] and ![[note]]) out of canvas TEXT-node bodies, via src/shared/Wikilinks.ts. Canvas text nodes are markdown, so Obsidian core (the `core-indexed` regime, which reads metadataCache.resolvedLinks) ALSO indexes markdown-style inline links written there, e.g. `[label](note.md)` and `![alt](pic.png)`. The fallback regime does not, so the two regimes still differ for that (rare) syntax.

Likewise, a [[link]] written inside a code span or fenced code block inside a canvas text node is skipped by core but harvested by the fallback parser.

Both are documented as residual, known differences in the Wikilinks header and in docs-internal/plan/high-level-plan.md (### Canvas support).

Why not fixed inline: markdown-link harvesting needs URL-decoding (%20), external-URL rejection and code-span awareness to avoid being a worse approximation than skipping it; the payoff is small because canvas text nodes overwhelmingly use wikilink syntax.

## Acceptance Criteria

- A canvas text node containing `[label](note.md)` yields the same edge in BOTH regimes, covered by an adapter test in src/adapters/ObsidianLinkProvider.test.ts.
- Encoded targets (`[a](my%20note.md)`) and external URLs (`[a](https://example.com)`) are handled honestly (resolve / no edge respectively).

