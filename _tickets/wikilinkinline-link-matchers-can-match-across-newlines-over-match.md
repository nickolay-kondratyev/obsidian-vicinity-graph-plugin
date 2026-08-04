---
id: nid_lgo91fzkivxiu32g1j5bttzca_e
title: "Wikilink/inline-link matchers can match ACROSS newlines (over-match)"
status: open
deps: []
links: []
created_iso: 2026-08-04T22:26:56Z
status_updated_iso: 2026-08-04T22:26:56Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [shared, parsing]
---

`WIKILINK_SOURCE` in `src/shared/Wikilinks.ts` is `(!?)\[\[([^\]]+)\]\]` and `INLINE_LINK_SOURCE` in `src/shared/MarkdownInlineLinks.ts` is similarly newline-tolerant. `[^\]]` matches a newline, so an UNCLOSED `[[` on one line pairs with a `]]` many lines later and the matcher reports one link spanning both.

Obsidian requires a wikilink to open and close on the SAME line, so this is a pure over-match. Two consequences:
- Canvas text-node harvesting (`src/adapters/CanvasFallbackParser.ts` via `Wikilinks.harvestedLinksOf`) can mint a phantom link core never indexed.
- Since nid_yw2m80g72pahcvtsxi09o7vkd_e, `src/shared/MarkdownEmbeds.flattened` REWRITES matched text in link-preview snippets, so a stray `![[` can now swallow several lines of a multi-line `expandedContext` into one marker — user-visible text loss in the preview drawer.

Fix: exclude the newline from the inner-text class (`[^\]\n]+`) in both matchers. Pre-existing behavior, so land it with tests that fail first (a fixture whose `[[` is never closed on its line).

## Acceptance Criteria

- A failing-first test in `src/shared/Wikilinks.test.ts` shows an unclosed `[[` no longer matches across a newline.
- Equivalent coverage for `src/shared/MarkdownInlineLinks.ts`.
- `npm test` and `npm run check` green.

