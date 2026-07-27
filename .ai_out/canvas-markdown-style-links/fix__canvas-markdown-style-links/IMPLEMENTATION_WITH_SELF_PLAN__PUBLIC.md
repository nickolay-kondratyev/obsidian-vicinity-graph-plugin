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
- **`src/shared/MarkdownInlineLinks.test.ts`** (new) — 20 BDD unit tests.
- **`e2e/canvasMarkdownLinkIndexing.e2e.ts`** (new, review round 2) — the only
  MEASUREMENT of what core actually indexes; see the disposition section.
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

## Review round 2 — finding-by-finding disposition

| # | Finding | Disposition |
|---|---------|-------------|
| 1 | SHOULD-FIX — "core indexes these" asserted, never observed, unfalsifiable | **INCORPORATED** — measured against real Obsidian; premise CONFIRMED (details below) |
| 2 | SHOULD-FIX — unencoded space truncates the destination → phantom edge | **INCORPORATED** — failing test first, then fixed; behaviour now matches what core was observed to do |
| 3 | NICE-TO-HAVE — escaped brackets over-match, header not exhaustive | **INCORPORATED** — header now lists escaped brackets and splits the known gaps into OVER-match vs UNDER-match |
| 4 | NICE-TO-HAVE — relative destinations (`./`, `../`, `/abs`) unverified | **INCORPORATED** — probed the real resolver; `./x.md` and `../f/x.md` are accepted verbatim, so nothing to change; recorded in the module header |

### Finding 2 — the phantom edge (correctness fix)

`[a](my note.md)` used to yield the target `my`, which in a vault holding a note
named `my` manufactures an edge to the WRONG document. CommonMark does not allow
an unescaped space in a bare destination, so such a construct is not a link at
all. `destinationOf` now treats the whitespace suffix as a title ONLY when it
opens one (`"`, `'`, `(`), and otherwise answers `""` — no edge. A wrong edge is
worse than a missing one, and this is what real Obsidian does (see below).

New BDD test: *WHEN a destination carries an unencoded space THEN it names no
document* — written FAILING (`expected [ 'my' ] to deeply equal []`) before the
fix. A single-quoted-title test was added alongside so the "only a real title is
dropped" rule is pinned from both sides.

### Finding 1 — the premise, now MEASURED (and TRUE)

New spec **`e2e/canvasMarkdownLinkIndexing.e2e.ts`**, run against the pinned real
Obsidian 1.12.7 — **5 tests, all pass**. It writes ONE canvas text node carrying
every destination shape and reads `metadataCache.resolvedLinks` out of the live
app. Verbatim observation:

```
resolvedLinks[md-links/board.canvas] = {"md-links/target.md":4,"md-links/spaced target.md":1}
getFirstLinkpathDest = ["md-links/target.md","md-links/target.md","md-links/target.md","md-links/spaced target.md"]
```

What that settles:

- **Core DOES index markdown-style links in canvas text nodes**, keyed by the
  RESOLVED path — the premise of this whole change holds. Had it not, the change
  would have been an inversion, not a fix.
- **`%20` resolves** to `spaced target.md`.
- **An unencoded space produces NO link**, and no edge to the bait note
  `md-links/spaced.md` that exists precisely so a truncating implementation would
  betray itself. Core agrees with the finding-2 fix exactly.
- **An external URL produces nothing.**
- **`getFirstLinkpathDest` — the seam the fallback resolves through — accepts
  `target.md`, `./target.md` and `../md-links/target.md` alike**, which answers
  finding 4: relative destinations do not diverge between the regimes, so no path
  normalisation belongs in the matcher. Recorded in the module header.

WHY a self-contained fixture set (`extraFixtures` under `md-links/`) rather than
extending `.dev-vault`: `vicinityGraph.e2e.ts` asserts node and orphan-breakdown
counts to the unit, so ANY extra vault file would break unrelated specs. The
spec also needs neither the plugin's rendering nor its settings.

Docs are now explicit about observed vs assumed: the plan doc's canvas section
carries the measurement (with the raw shape) and states that the unit-level
parity tests hand-seed the `core-indexed` side, so this spec is the only thing
that can falsify the premise. The stale "verify in devtools" line is replaced by
the answer.

## Verification

Final, after the review round:

- `npm test` — **82 files, 1139 tests, all pass** (`.tmp/test-final2.txt`).
  30 of them are new here (20 shared-matcher unit + 2 parser + 8 provider).
- `npm run check` — **exit 0** (`tsc -noEmit` for `src/` and `e2e/`,
  `.tmp/check3.txt`).
- `npm run test:e2e -- canvasMarkdownLinkIndexing.e2e.ts` — **5 passed**, real
  Obsidian 1.12.7, headless (`.tmp/e2e-canvas-md2.txt`). The rest of the e2e
  suite was not run: it is a release gate and no rendered surface changed.
- Every new unit test was written FAILING first (first round: module absent;
  second round: the phantom-edge assertion actually red).
