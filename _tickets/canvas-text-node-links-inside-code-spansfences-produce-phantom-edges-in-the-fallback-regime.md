---
id: nid_869bt9d9rlrbr8of1403dnmf3_e
title: "Canvas text-node links inside code spans/fences produce phantom edges in the fallback regime"
status: open
deps: []
links: []
created_iso: 2026-07-27T23:10:42Z
status_updated_iso: 2026-07-27T23:10:42Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [canvas, links]
---

The fallback canvas link regime harvests `[[wikilinks]]` and markdown-style `[a](b.md)` links out of canvas TEXT-node bodies with small honest regex matchers (`src/shared/Wikilinks.ts`, `src/shared/MarkdownInlineLinks.ts`), used by `src/adapters/CanvasFallbackParser.ts`. Neither matcher is code-span aware: a link written inside a code span (`` `[[note]]` ``) or a fenced code block is harvested as if it were real.

Obsidian core (the `core-indexed` regime, `metadataCache.resolvedLinks`) does NOT index those, so the two regimes disagree — the residual half of ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e` (whose markdown-style-link half is now closed). Which regime a rebuild lands in is a boot race, so a divergence surfaces as "the graph depends on how fast you opened it".

Documented as a known residual in `docs-internal/plan/high-level-plan.md` (### Canvas support) and in the `src/shared/Wikilinks.ts` header.

Likely LOW priority: writing a link inside a code span inside a canvas text node is rare. Closing it properly needs code-span/fence awareness in a shared pre-pass (strip fenced blocks and inline code spans before matching), which is a real step towards being a markdown parser — judge the 80/20 before taking it.

## Acceptance Criteria

- A canvas text node whose only `[[link]]` / `[a](b.md)` sits inside an inline code span or a fenced code block yields NO edge in the fallback regime, matching core.
- Covered by a both-regimes-agree test in `src/adapters/ObsidianLinkProvider.test.ts` plus unit tests for the shared matchers.
- Docs updated: the residual note in `docs-internal/plan/high-level-plan.md` and the `src/shared/Wikilinks.ts` header.

