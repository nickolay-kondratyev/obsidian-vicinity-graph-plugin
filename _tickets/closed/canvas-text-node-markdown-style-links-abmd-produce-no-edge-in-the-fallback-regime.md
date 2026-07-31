---
closed_iso: 2026-07-27T23:28:02Z
id: nid_ygo7h95ssgmunaqsprc1zlmfh_e
title: "Canvas text-node markdown-style links ([a](b.md)) produce no edge in the fallback regime"
status: closed
deps: []
links: [nid_s676x55uojmtcwh9t4l9mc6zl_e]
created_iso: 2026-07-27T19:51:01Z
status_updated_iso: 2026-07-27T23:28:02Z
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


## Notes

**2026-07-27T23:28:02Z**

Resolved on branch fix/canvas-markdown-style-links (change log l49mm4p5fjslpgmdm3jcw1he9).

New pure src/shared/MarkdownInlineLinks.ts normalises a markdown-style destination to LINK TEXT; CanvasFallbackParser harvests it from text-node bodies and ObsidianLinkProvider resolves it through the SAME getFirstLinkpathDest seam wikilinks use — no second resolver, no new CanvasReference kind.

Acceptance criteria:
- [label](note.md) yields the same edge in both regimes — parity block in src/adapters/ObsidianLinkProvider.test.ts.
- [a](my%20note.md) resolves; [a](https://example.com) yields no edge. External-URI verdict and #/? strip run BEFORE percent-decoding so note%3Aone.md is not read as a URI scheme.

Beyond the stated criteria: [a](my note.md) yields NO edge rather than truncating at the space to a wrong-but-resolvable target (CommonMark: a bare destination cannot contain a space). A wrong edge is worse than a missing one.

The premise that core indexes these links inside canvas text nodes was OBSERVED, not assumed: e2e/canvasMarkdownLinkIndexing.e2e.ts reads core resolvedLinks against real Obsidian 1.12.7.

Code-span / fenced-code divergence remains out of scope — tracked by nid_869bt9d9rlrbr8of1403dnmf3_e.

npm test 1139 pass, npm run check clean, e2e spec 5 pass.
