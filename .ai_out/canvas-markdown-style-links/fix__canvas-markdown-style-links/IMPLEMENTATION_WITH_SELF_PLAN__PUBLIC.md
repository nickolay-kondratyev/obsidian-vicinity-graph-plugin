# Implementation — canvas markdown-style links (`nid_ygo7h95ssgmunaqsprc1zlmfh_e`)

Branch `fix/canvas-markdown-style-links`. Status: **DONE**, tree clean,
`npm test` and `npm run check` green. Ticket NOT closed, no `change_log` entry
(both are TOP_LEVEL_AGENT's).

## What was done

A canvas TEXT node's markdown-style inline links — `[label](note.md)` and
`![alt](pic.png)` — now produce the same edges in the `fallback-required`
regime that Obsidian core already reports in the `core-indexed` regime. The
last-remaining behavioural difference between the two canvas link regimes,
apart from code spans, is closed.

## The design decision (the crux EXPLORATION §8 flagged)

**Markdown-style destinations resolve through the SAME seam wikilinks use** —
`metadataCache.getFirstLinkpathDest(target, canvasPath)` — after pure-syntax
normalisation. Consequences:

- **No new `CanvasReference` kind.** A normalised destination IS link text for
  resolution purposes, so it travels as the existing `text-node-link`. That is
  what Obsidian core does, and it keeps ONE resolution path: a second,
  literal-path `vault.getFileByPath` lookup (option (b) in the exploration)
  would have diverged from wikilinks on relative paths, folder notes and
  shortest-path targets — exactly the cases the regimes must agree on.
- **Syntax knowledge is a new pure sibling module**, not an extension of
  `Wikilinks` (SRP: "what a wikilink looks like" vs "what an inline link looks
  like" are different syntaxes with different rules — percent-encoding,
  external URLs, titles). Both live in `src/shared/`, still `obsidian`-free
  (import guard passes).

### Normalisation rules, and why the ORDER matters

For each `[label](…)` / `![alt](…)` match, on the parenthetical:

1. unwrap `<…>`, else drop anything from the first whitespace (a trailing
   `"title"`);
2. **external verdict** — a URI scheme (`^[a-zA-Z][a-zA-Z0-9+.-]*:`, so
   `https:`, `mailto:`, `obsidian:`, `file:`) or protocol-relative `^//` ⇒ no
   edge;
3. strip from the first `#` (subpath) or `?` (query);
4. `decodeURIComponent`;
5. empty ⇒ no edge.

Steps 2 and 3 run **before** 4 deliberately, per the guidance: decoding first
would turn `note%3Aone.md` (a file whose name contains a colon) into a `note:`
"scheme" and silently drop a real edge, and `note%23one.md` into a bogus
subpath. Both directions are pinned by tests.

`decodeURIComponent` throws on a malformed escape (`100%.md`); it is caught and
the literal text kept — it simply will not resolve, which is honest, rather
than dropping a link the user can see.

## Files changed

- **`src/shared/MarkdownInlineLinks.ts`** (new) — the pure matcher +
  normalisation described above; `globalPattern()` returns a FRESH `/g` regex
  per call, same `lastIndex`-leak guard as `Wikilinks`.
- **`src/shared/MarkdownInlineLinks.test.ts`** (new) — 18 BDD unit tests.
- **`src/shared/Wikilinks.ts`** — header no longer claims markdown-style links
  are unhandled; points at the sibling module and keeps the code-span residual
  (now under its own ticket).
- **`src/adapters/CanvasFallbackParser.ts`** — text branch extracted to
  `textNodeReferencesOf`, which runs BOTH scans and maps both to
  `text-node-link`. Header scope + `CanvasReference` doc widened.
- **`src/adapters/CanvasFallbackParser.test.ts`** — two new tests (normalised
  markdown-style link reported as link text; external destination reported as
  nothing); one stale test NAME corrected ("no wikilink" → "no link of either
  syntax").
- **`src/adapters/ObsidianLinkProvider.ts`** — `resolvedCanvasTargetsOf` doc
  records the one-resolver decision and its WHY-NOT.
- **`src/adapters/ObsidianLinkProvider.test.ts`** — two new `describe` blocks
  (8 tests) following the existing patterns: the required **parity** block
  (both regimes agree on `[label](note-b.md)`, outgoing + backlink) and a
  fallback **reconciliation** block (percent-encoded target resolves, external
  URL yields nothing, `![alt](pic.png)` embed yields an edge, a wikilink and a
  markdown-style link to the same note count 2, resolution is relative to the
  canvas).
- **`docs-internal/plan/high-level-plan.md`** ("### Canvas support") — settled
  semantics now cover both syntaxes and spell out the normalisation order; the
  markdown-link gap is removed from the residual list; the code-span gap stays,
  under its new ticket. Also notes the fallback's per-syntax scan order.
- **`README.md`** ("V1 scope / limits") — the line "canvas text-node wikilinks
  are skipped" was **already a lie** before this change (the previous ticket
  made them count); corrected to state that canvas text-node links of both
  syntaxes count, with the code-span caveat.
- **`_tickets/canvas-text-node-links-inside-code-spansfences-produce-phantom-edges-in-the-fallback-regime.md`**
  (new, `nid_869bt9d9rlrbr8of1403dnmf3_e`) — see below.

## Deliberately left residual

- **Code spans / fenced code blocks — out of scope per instructions, and NOT
  made meaningfully worse.** A `[a](b.md)` inside a code span is now harvested
  where it previously was not, so the divergence grows by one syntax; but the
  failure mode is unchanged in kind and rarity (you must write a link inside a
  code span inside a canvas text node). Because the ticket that used to track
  this is being closed, I filed **`nid_869bt9d9rlrbr8of1403dnmf3_e`** so the
  residual keeps a home, and cited it from the plan doc, the README and both
  shared matcher headers.
- **Brackets inside the label** (`[see [x]](y.md)`) and **parentheses inside
  the destination** (`[a](note (1).md)`) do not match — recognising them means
  becoming a markdown parser. Documented in the module header.
- **Reference-style links** (`[a][ref]` + a link definition) are not handled;
  they are vanishingly rare in canvas text nodes and would need a second pass
  over definitions. Documented as out of the matcher's scope by its name and
  header ("inline links").
- **Edge order across the two syntaxes** is "wikilinks, then markdown-style",
  not written order — two scans. Safe: edge order is explicitly not contractual
  on either regime, and both consumers (`getOutgoingLinks` dedupes,
  `getLinkCount` counts) are order-insensitive. Stated in code and plan doc.

## Verification

- `npm test` — **82 files, 1137 tests, all pass** (`.tmp/test-final.txt`).
  28 of them are new here (18 shared-matcher unit + 2 parser + 8 provider).
- `npm run check` — **exit 0** (`tsc -noEmit` for `src/` and `e2e/`,
  `.tmp/check.txt`).
- Unit tests were written FAILING first (module absent) before implementing.
- `npm run test:e2e` (real Obsidian) not run — no e2e-visible surface changed
  and it is a release gate, not part of this task's DoD.
