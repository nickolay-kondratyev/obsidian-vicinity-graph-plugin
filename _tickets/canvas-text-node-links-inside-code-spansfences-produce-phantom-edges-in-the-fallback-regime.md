---
id: nid_869bt9d9rlrbr8of1403dnmf3_e
title: "Canvas text-node links inside code spans/fences produce phantom edges in the fallback regime"
status: open
deps: []
links: [nid_fay1hu5sxcoygizopkkg0f0d7_e]
created_iso: 2026-07-27T23:10:42Z
status_updated_iso: 2026-07-27T23:10:42Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [canvas, links, decide]
---

The fallback canvas link regime harvests `[[wikilinks]]` and markdown-style `[a](b.md)` links out of canvas TEXT-node bodies with small honest regex matchers (`src/shared/Wikilinks.ts`, `src/shared/MarkdownInlineLinks.ts`), used by `src/adapters/CanvasFallbackParser.ts`. Neither matcher is code-span aware: a link written inside a code span (`` `[[note]]` ``) or a fenced code block is harvested as if it were real.

Obsidian core (the `core-indexed` regime, `metadataCache.resolvedLinks`) does NOT index those, so the two regimes disagree — the residual half of ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e` (whose markdown-style-link half is now closed). Which regime a rebuild lands in is a boot race, so a divergence surfaces as "the graph depends on how fast you opened it".

Documented as a known residual in `docs-internal/plan/high-level-plan.md` (### Canvas support) and in the `src/shared/Wikilinks.ts` header.

Likely LOW priority: writing a link inside a code span inside a canvas text node is rare. Closing it properly needs code-span/fence awareness in a shared pre-pass (strip fenced blocks and inline code spans before matching), which is a real step towards being a markdown parser — judge the 80/20 before taking it.

## Research — effort, performance, maintainability (2026-07-29)

**Verdict: small and clean. ~1–2h, ~1 new file (~70 LOC) + tests + 3 doc touch-ups. Performance is a non-issue.**

### Shape of the fix

A masking pre-pass, NOT parser awareness inside the matchers:

```
src/shared/MarkdownCodeRegions.ts   (new)
  static withCodeMasked(text: string): string
```

It blanks every fenced-block and inline-code-span region to same-length spaces, leaving all
other offsets untouched. Wiring is ONE line, at the single call site:

```ts
// CanvasFallbackParser.textNodeReferencesOf
const prose = MarkdownCodeRegions.withCodeMasked(text);
return [...Wikilinks.linkTargetsOf(prose), ...MarkdownInlineLinks.linkTargetsOf(prose)]...
```

Why masking rather than making the matchers code-aware: `Wikilinks` is ALSO used by
`src/view/outlineEntryLabel.ts` to strip markup for display, where code-span awareness is
wrong (a `` `[[x]]` `` in a heading should still render its label). Keeping the pre-pass
outside the matchers preserves their "small honest matcher, one left-to-right pass" contract
verbatim — nothing in `Wikilinks.ts` / `MarkdownInlineLinks.ts` changes except the header note.
Blast radius: one call site, one regime, canvas text nodes only.

Masking to SPACES (not deletion) is what keeps it safe: no text on either side of a span can
fuse into a new pseudo-link. `[[a` + span + `b]]` becomes `[[a   b]]`, which the matcher
happily matches and which resolves to a target the vault will not contain — but that is a
`[[…]]` the user literally wrote across a code span, i.e. degenerate either way. (Pure-blank
inners trim to `""` and are already dropped.)

### Algorithm (two levels, one pass each)

1. **Fences, per line.** Opener `/^ {0,3}(`{3,}|~{3,})/`; closer = same char, length ≥ opener,
   nothing but whitespace after. Unclosed fence masks to end of text (CommonMark).
2. **Inline spans, within each non-fenced line.** Scan for a run of N backticks, then the next
   run of EXACTLY N; if none, the opener is literal text and scanning resumes after it.
   ~25 LOC of scanner loop — the `` /(`+)(.*?)\1(?!`)/ `` one-liner is tempting but backtracks
   wrongly on `` ``a`b`` ``, so write the loop.

Per-line inline scanning is a deliberate 80/20: CommonMark lets a code span cross a newline,
so a span opened on line 1 and closed on line 3 would leave line 2 unmasked. Vanishingly rare
inside a canvas text node; document it, do not chase it.

### Performance

Non-issue. O(n) over the node body, one `split("\n")` + one string rebuild per TEXT node,
executed only when the canvas is in the FALLBACK regime and only on a link rebuild. Canvas
text nodes are a few hundred bytes; the two matcher scans that already run over the same text
cost more. No regex backtracking risk (line-anchored fence test, hand-rolled span scanner).

### Deliberately OUT of scope (document, don't build)

Chasing these is what turns the pre-pass into a markdown parser:

- **Indented (4-space) code blocks** — needs block context (list continuations indent too).
- **Escaped backticks / escaped brackets** (`\[not a link\](x.md)`) — already a known residual
  in `MarkdownInlineLinks`'s header.
- `%%comments%%`, frontmatter, HTML blocks.

### Prerequisite before building: MEASURE core, don't assume

This ticket's premise — that `metadataCache.resolvedLinks` skips links in code spans/fences —
is asserted, not measured. Extend `e2e/canvasMarkdownLinkIndexing.e2e.ts` with a canvas whose
only links sit in a code span and in a fence, and confirm core reports zero. If core DOES index
them (it has surprised us before), the correct fix is the opposite one — leave the matchers
alone and close this as won't-fix — so this cheap check gates the whole change.

### Recommendation

Worth doing, at current priority 3, once the e2e measurement confirms the premise. It is the
last known fallback-vs-core divergence, it removes a boot-race-dependent graph, and it costs
one focused file. Do NOT expand it into escape/indent handling.

## Acceptance Criteria

- `e2e/canvasMarkdownLinkIndexing.e2e.ts` MEASURES that real Obsidian core reports no edge for a
  link inside a code span / fence (gates the rest — see Research).
- A canvas text node whose only `[[link]]` / `[a](b.md)` sits inside an inline code span or a fenced code block yields NO edge in the fallback regime, matching core.
- Covered by a both-regimes-agree test in `src/adapters/ObsidianLinkProvider.test.ts` plus unit tests for the shared matchers.
- Docs updated: the residual note in `docs-internal/plan/high-level-plan.md` and the `src/shared/Wikilinks.ts` header.

