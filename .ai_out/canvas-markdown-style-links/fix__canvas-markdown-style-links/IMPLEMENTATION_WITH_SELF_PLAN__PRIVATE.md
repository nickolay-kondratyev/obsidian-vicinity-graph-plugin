# PRIVATE — canvas markdown-style links (`nid_ygo7h95ssgmunaqsprc1zlmfh_e`)

## Plan (as decided at start)

**Goal**: a canvas TEXT node's `[label](note.md)` / `![alt](pic.png)` yields the
same edge in the fallback regime as core reports in the `core-indexed` regime.

**Design decision (the crux flagged by EXPLORATION §8)**: resolve markdown-style
destinations through the SAME seam wikilinks use —
`metadataCache.getFirstLinkpathDest(target, canvasPath)` — after pure-syntax
normalisation (angle-bracket unwrap, drop title, external reject, strip
`#`/`?`, percent-decode). So NO new `CanvasReference` kind: the normalised
destination IS link text as far as resolution is concerned, and one resolution
path keeps relative paths / folder notes / shortest-path targets consistent
with wikilinks (DRY). Option (b) from the exploration (literal
`vault.getFileByPath`) was rejected: it would be a SECOND resolver that
diverges on exactly those cases.

**Steps**:
1. `src/shared/MarkdownInlineLinks.ts` — new pure sibling of `Wikilinks.ts`
   (SRP: "what an inline link looks like" ≠ "what a wikilink looks like").
2. `src/shared/MarkdownInlineLinks.test.ts` — failing-first unit tests.
3. `CanvasFallbackParser.referencesOfNode` text branch → both scans, both
   mapped to the existing `text-node-link` kind.
4. Parity + reconciliation tests in `ObsidianLinkProvider.test.ts`.
5. Docs: `Wikilinks.ts` header, `MarkdownInlineLinks.ts` header,
   `CanvasFallbackParser` header + `CanvasReference` doc,
   `resolvedCanvasTargetsOf` doc, high-level-plan "### Canvas support".

## State at exit

DONE — see `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` for the executed result,
files changed, residuals and test/check results. Nothing left half-applied.

## Rehydration notes / gotchas discovered

- Ordering: the text-node scan is now TWO passes (wikilinks then inline links),
  so combined output is no longer strictly written order. Safe: the plan doc
  already states "Edge ORDER is not contractual on either path", and
  `getOutgoingLinks` dedupes while `getLinkCount` counts occurrences (both
  order-insensitive). Documented in `CanvasFallbackParser`.
- Percent-decode MUST run AFTER the external-URI decision and AFTER the
  `#`/`?` strip: decoding first turns `note%3Aone.md` into `note:one.md`
  (scheme-looking ⇒ wrongly dropped) and `note%23one.md` into `note#one.md`
  (subpath-looking ⇒ wrongly truncated). Both are pinned by tests.
- `decodeURIComponent` THROWS on a malformed escape (`100%.md`) — caught, raw
  kept (test pins it).
- The inline-link label is `[^\[\]]*`, which is what keeps the matcher from
  firing on `[[wikilink]]` / `![[embed]]` text (no double-harvest). Do not
  loosen it without re-checking that.
- Code spans/fences remain OUT OF SCOPE (separate residual, still documented).
