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
