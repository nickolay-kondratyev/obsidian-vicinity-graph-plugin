# Stage 1 — carry `LinkKind` (rehydration memory) — COMPLETE

`npm test` 1199/1199, `npm run check` clean. Three commits on the current branch:
`d48d914` (syntax + provenance), `5022a72` (port + always-parse), `5c13f8f` (docs).
Ticket note + change_log entry (`o1a5bjgjpro68l9nmxnr4yzp2`) written.

Full write-up for the next stage: `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` in
this directory. This file is only the stuff a clone of ME would want.

## Plan status — all done

1. [x] `src/shared/LinkKind.ts` (`LINK_KINDS`, `LinkKind`, `HarvestedLink`,
       `LinkKinds.ofEmbedMarker`). In `shared/`, re-exported as a TYPE from
       `src/engine/index.ts`. `LINK_KINDS` deliberately NOT re-exported (unused).
2. [x] `Wikilinks` / `MarkdownInlineLinks`: `(!?)` is group 1, old group 1 → group 2;
       `linkTargetsOf` → `harvestedLinksOf`. `outlineEntryLabel` callback updated.
3. [x] `ReferenceOrder.OrderedReference.kind` by provenance + `original` cross-check.
4. [x] `CanvasReference.linkKind` (independent of the existing `kind`).
5. [x] Port: `OutgoingReference`, `getOutgoingReferences`,
       `OutgoingReferences.targetsOf/.deduped`. `getOutgoingLinks` kept as derived.
6. [x] `FakeLinkProvider.embeds` fixture map.
7. [x] `ObsidianLinkProvider`: kinds + always-parse; `CanvasCapability.*` deleted;
       `parsedCanvasPaths`; `main.ts` log.
8. [x] Docs: `high-level-plan.md` (new "Link kinds" section + Canvas support
       rewrite + testing section), `architecture-map.md`.

## Judgement calls I made (defend these if challenged)

- **`getLinkCount` NOT made kind-aware.** Brief item 5 says "only as far as Stage 3
  will need"; Stage 3 needs zero (`VicinityTraversal` never calls it — grep it).
  And `resolvedLinks` is a MERGED count, so splitting means re-deriving the total
  from `getFileCache`, which can change a displayed badge = behavior change.
- **`getOutgoingLinks` kept.** Deleting it would have forced ~30 assertions and two
  consumers to be rewritten, and `NodeSizer` MUST stay kind-blind (a both-linked-
  and-embedded pair would otherwise count twice and resize nodes).
- **`LinkKind` in `shared/` not `engine/`.** `engine → shared` already exists;
  the reverse would invert layering. `shared/` is under the same importGuard.
- **One test genuinely inverted** (empty core index entry no longer suppresses our
  parser). Documented in the replacement suite's doc comment, the ticket note, the
  commit message and PUBLIC.md.

## Traps I hit (a clone WILL hit these)

- `src/view/outlineEntryLabel.ts:44` reads capture group 1 of
  `Wikilinks.globalPattern()` in a `String.replace` callback. Adding a leading
  capture SILENTLY shifts it — TS does not catch it. Its tests do.
- `CanvasParseCache.test.ts` also asserts `CanvasReference` literals (easy to miss;
  it failed after the parser change while the parser's own suite passed).
- `vitest` transpiles without typechecking, so a green `npm test` proves nothing
  about types — run `npm run check` separately (it also covers `e2e/`).

## Not done, on purpose (Stage 3's job)

`VicinityTraversal`, `NodeSizer`, `EdgeCounts`, `DepthSettings`, `SETTINGS_SPEC`,
settings rows/presenters/persistence, CSS: **untouched**. No `targetsOfKind` helper
(would be unused code); Stage 3 adds it to `OutgoingReferences`. `LINK_KINDS`
re-export from the engine is Stage 3's first line.

---

# ITERATION 1 (review feedback) — DONE, tree clean

`npm test` 1199/1199, `npm run check` clean. One extra commit on the branch.
All 4 SHOULD-FIX incorporated, none rejected. Details in PUBLIC.md `## ITERATION 1`.

## What I got WRONG in Stage 1 (own it)

**I claimed "zero behavior change" flatly.** It was false for canvas edge COUNTS:
pre-3a a core-indexed canvas had no `canvasOutgoingByPath` entry so `getLinkCount`
returned core's `resolvedLinks` number; post-3a it returns our occurrence count for
EVERY canvas. I had reasoned carefully about `getLinkCount` (see PRIVATE §"Judgement
calls") and *still missed* that 3a moved its canvas branch — because I was thinking
about the MARKDOWN split, not about which canvases now land in the map. **Lesson for a
clone: when you widen a map's key set, audit EVERY reader of that map, not just the one
you were editing.** `canvasOutgoingByPath` has three readers.

I kept the new semantics (one authority per edge; sourcing the count from core while
the set comes from us re-exposes the boot race) and pinned it with a test whose seeded
`resolvedLinks` (1) genuinely differs from the parse (3). If someone ever routes canvas
counts back through core, that test fails.

## The circular test — how it happened

I wrote a fixture that derived the cache arrays from `original.startsWith("!")` and then
asserted the kinds equal `original.startsWith("!")`, and I wrote a doc comment calling it
a tripwire. It felt rigorous while writing it because the AUTHORED table looked like real
source text. **Heuristic that would have caught it: ask "what edit to PRODUCTION makes
this fail?" — if the answer needs a paragraph, the test is decorative.** Here the answer
was "nothing" because `original` never reaches production. Deleted; the real tripwire is
an e2e measurement, filed as `nid_t0x7ap99djfuzvz5p261ao7rn_e`.

## Traps in THIS iteration

- The new count test failed first run (got 1, expected 3): a canvas text-node `[[note-a]]`
  needs `resolutions: { "note-a": "note-a.md" }` in the `providerOver` spec. FILE nodes
  resolve by literal path and need no `resolutions`; TEXT-node links go through the fake
  `getFirstLinkpathDest` and silently resolve to nothing without it.
- `CachedMetadataPort` is still imported by `ReferenceOrder.test.ts` after the deletion
  (used by `linksOf`) — deleting the import would have broken the build.

## Still true from Stage 1

Everything in "Not done, on purpose (Stage 3's job)" above is unchanged. Stage 3's two
ACCEPTANCE ITEMS are now written into PUBLIC.md and the ticket: (1) decide the uncached-
markdown `kind: "link"` degradation (accept, or return `[]` and wait for the next
`metadataCache` event) and pin it; (2) pin D5 rather than build it.
