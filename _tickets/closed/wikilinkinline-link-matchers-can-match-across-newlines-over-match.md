---
closed_iso: 2026-08-06T16:00:35Z
id: nid_lgo91fzkivxiu32g1j5bttzca_e
title: Wikilink/inline-link matchers can match ACROSS newlines (over-match)
status: closed
deps: []
links: []
created_iso: '2026-08-04T22:26:56Z'
status_updated_iso: 2026-08-06T16:00:35Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [shared, parsing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
`WIKILINK_SOURCE` in `src/shared/Wikilinks.ts` is `(!?)\[\[([^\]]+)\]\]` and `INLINE_LINK_SOURCE` in `src/shared/MarkdownInlineLinks.ts` is similarly newline-tolerant. `[^\]]` matches a newline, so an UNCLOSED `[[` on one line pairs with a `]]` many lines later and the matcher reports one link spanning both.

Obsidian requires a wikilink to open and close on the SAME line, so this is a pure over-match. Two consequences:
- Canvas text-node harvesting (`src/adapters/CanvasFallbackParser.ts` via `Wikilinks.harvestedLinksOf`) can mint a phantom link core never indexed.
- Since nid_yw2m80g72pahcvtsxi09o7vkd_e, `src/shared/MarkdownEmbeds.flattened` REWRITES matched text in link-preview snippets, so a stray `![[` can now swallow several lines of a multi-line `expandedContext` into one marker — user-visible text loss in the preview drawer.

Fix: exclude the newline from the inner-text class (`[^\]\n]+`) in both matchers. Pre-existing behavior, so land it with tests that fail first (a fixture whose `[[` is never closed on its line).

## Update (2026-08-04, review round on nid_yw2m80g72pahcvtsxi09o7vkd_e)

The WIKILINK half is DONE and no longer deferred: `WIKILINK_SOURCE` is now
`(!?)\[\[([^\]\n]+)\]\]`, with failing-first tests in `src/shared/Wikilinks.test.ts`
(harvesting) and `src/shared/MarkdownEmbeds.test.ts` (the rewrite). It was landed
with the embed-flattening review because that feature is what turned a harmless
over-match into deleted prose in a preview row — deferring a one-character fix
behind a text-loss path was not defensible.

REMAINING: `MarkdownInlineLinks`. Deliberately NOT changed in the same breath —
CommonMark legally allows an inline link's LABEL to span lines, so the newline
rule there needs its own decision (measured against real Obsidian, the way
`e2e/canvasMarkdownLinkIndexing.e2e.ts` measures the rest of that matcher)
rather than a copy of the wikilink rule.

## Acceptance Criteria

- ~~A failing-first test in `src/shared/Wikilinks.test.ts` shows an unclosed `[[` no longer matches across a newline.~~ DONE.
- ~~Equivalent coverage for `src/shared/MarkdownInlineLinks.ts`, after deciding what real Obsidian does with a multi-line `[label](dest)`.~~ DONE.
- ~~`npm test` and `npm run check` green.~~ DONE.

## Resolution (2026-08-06)

The inline-link decision is DELIBERATELY not the wikilink rule. Measured against
real Obsidian core in `e2e/canvasMarkdownLinkIndexing.e2e.ts` (new text node `t3`,
three targets that exist in the vault):

- `newlineLabel=true`  — `[foo\nbar](x.md)` IS indexed. A single line ending in the
  label is legal (CommonMark), so excluding the newline would DROP a real edge.
- `newlineDest=true`   — `[x](\ny.md\n)` IS indexed. A line ending between `(` and
  the destination is legal too.
- `blankLabel=false`   — `[foo\n\nbar](x.md)` is NOT indexed. A BLANK line is a
  paragraph break that ENDS the inline — this is the only genuine over-match.

Fix (`src/shared/MarkdownInlineLinks.ts`): the regex stays newline-tolerant; a new
`PARAGRAPH_BREAK = /\n[^\S\n]*\n/` guard in `harvestedLinksOf` drops any match whose
full text straddles a blank line, so the two legal single-newline shapes survive and
only the paragraph-break over-match is refused. A character class can't express
"no double newline", so this lives past the regex — not a copy of the wikilink
`[^\]\n]` change.

Tests:
- `src/shared/MarkdownInlineLinks.test.ts` — failing-first on the two blank-line
  cases (label + destination), plus two pins for the legal single-newline shapes.
- `e2e/canvasMarkdownLinkIndexing.e2e.ts` — the `t3` node + a test asserting core's
  behavior (the ground truth the matcher is pinned to), logging the raw observation.

Gates: `npm run check` green, `npm test` 1657 passed, `npm run test:e2e --
canvasMarkdownLinkIndexing.e2e.ts` 8 passed.
