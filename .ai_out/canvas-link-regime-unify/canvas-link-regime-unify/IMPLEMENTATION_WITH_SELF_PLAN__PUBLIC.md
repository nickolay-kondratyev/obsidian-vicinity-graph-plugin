# IMPLEMENTATION_WITH_SELF_PLAN — canvas link regime unify

Ticket: `nid_s676x55uojmtcwh9t4l9mc6zl_e`. Branch `canvas-link-regime-unify`.
Status: **done, acceptance gate passed** (5/5 e2e runs agree, and the race is
proven benign rather than merely absent — see §6).

## 1. Plan (as executed)

1. Teach the fallback path about canvas TEXT-node wikilinks, resolving them the
   way markdown links are already resolved (`getFirstLinkpathDest`). No port change.
2. Keep parsing inside the mtime-keyed `CanvasParseCache`; keep resolution out of it.
3. Flip the characterization tests to assert the settled semantics for BOTH regimes.
4. Reconcile the remaining regime differences; file a ticket for what cannot be
   reconciled cheaply.
5. Update plan doc, parser header, dev-vault seed; delete the vestigial e2e workaround.
6. Run the 5x e2e gate.

## 2. Settled semantics (now written down in `docs-internal/plan/high-level-plan.md`)

A canvas links **whatever its FILE nodes reference AND whatever the wikilinks
(`[[note]]`, `![[note]]`) inside its TEXT nodes reference.** Text-node link text
resolves exactly like a markdown body link — `getFirstLinkpathDest` relative to
the canvas — so aliases and `#subpaths` resolve to the document, and a dangling
link produces no edge. `link` (external URL) and `group` nodes reference no
document. Edge ORDER is not contractual on either path.

## 3. Design

`CanvasFallbackParser` used to return bare paths. It now returns
`CanvasReference`s — a discriminated union of `{kind: "file-node", filePath}` and
`{kind: "text-node-link", linkText}`. The tag is load-bearing: a file node's
`file` is already a literal vault path (exact lookup), while text-node link text
needs Obsidian's resolution. Collapsing them into one string list would silently
resolve one as the other.

Resolution lives in `ObsidianLinkProvider` (module function
`resolvedCanvasTargetsOf`), mirroring the existing markdown flow, exactly as the
exploration recommended (option (a)). The parser stays pure JSON/string work with
no `MetadataCachePort` dependency, and `CanvasParseCache`'s mtime-only key stays
honest — resolution must NOT be cached by canvas mtime, because a rename changes
a target without touching the canvas.

Knowledge of *what a wikilink looks like* now lives once, in `src/shared/Wikilinks.ts`
(pure; `shared` is reachable from both `view` and `adapters`). `view/outlineEntryLabel.ts`
consumes the same pattern. The two callers ask different questions of the same
syntax — "what does this point at" vs "what does Obsidian display" — so only the
pattern is shared, not the extraction logic.

Because resolution now happens when the fallback maps are built,
`outgoingPathsOf`'s canvas branch simplified to a dedupe, and unresolvable
references are dropped once instead of being existence-filtered at query time.

## 4. Reconciliation table

| Regime difference | How resolved |
|---|---|
| Wikilink in a TEXT node | **Fixed** — fallback now harvests and resolves them. The reason this ticket exists. |
| Embed `![[x]]` in a TEXT node | **Fixed** — the pattern matches `!?[[...]]`; core indexes embeds as links too. Test: "embed produces an edge". |
| Alias / subpath (`[[n#H\|Alias]]`) | **Fixed** — target is trimmed to the pre-`#`/pre-`\|` document part, which is what `getFirstLinkpathDest` accepts. Core resolves these; the fallback now does too. |
| Unresolved / dangling link | **Aligned** — dropped. `resolvedLinks` only ever holds resolved links, so a dangling link must not conjure an edge. (Note: file-node paths pointing at missing files were already dropped; that filter just moved earlier.) |
| Duplicate targets | **Aligned** — `getOutgoingLinks` dedupes on both paths; `getLinkCount` counts occurrences on both (fallback counts resolved targets, core reads `resolvedLinks[src][tgt]`). Test: two text-node links to one note ⇒ count 2. |
| Same note via a FILE node and a TEXT node | **Aligned** — one edge. Test present. |
| Attachment / non-markdown targets | **Already aligned** — both report them (`pic.png` test). |
| Canvas → canvas links | **Already aligned** — file nodes resolve by path, text-node links resolve through `getFirstLinkpathDest`, which resolves `.canvas` files. Test present. |
| Self-link (`[[board]]` inside `board.canvas`) | **Symmetric by construction** — both regimes report it; no special-casing added, so neither regime can differ. |
| **Edge ORDER** | **NOT identical, by design.** Fallback = canvas node-array encounter order; core = `Object.keys(resolvedLinks[path])`, which is not ours to control. The ticket asks for the same edge SET; order was already documented as non-contractual on the core path. Recorded in the plan doc. |
| **Markdown-style `[a](b.md)` in a TEXT node** | **NOT reconciled.** Core indexes it, the fallback does not. Doing it properly needs URL-decoding, external-URL rejection and code-span awareness — worse-than-nothing if half-done, and canvas text nodes overwhelmingly use wikilinks. Ticket filed: `nid_ygo7h95ssgmunaqsprc1zlmfh_e`. |
| **`[[link]]` inside a code span in a TEXT node** | **NOT reconciled** — core skips it, the fallback harvests it. Same ticket; documented in the `Wikilinks` header as a deliberate non-goal of an honest-but-small matcher. |

## 5. Performance

The human's caveat was treated as a requirement.

- **Text-node scanning sits INSIDE the cached work.** `CanvasParseCache` is keyed
  on canvas path + mtime; the JSON parse and the wikilink scan happen together
  behind that key. An unmodified canvas is scanned **once per plugin session**,
  not once per rebuild. A dedicated test pins this ("the scan is part of the
  CACHED work" — asserts one `cachedRead` across two lookups).
- **Added per-build cost** = one `metadataCache.getFirstLinkpathDest` call per
  text-node wikilink per canvas, and only in `fallback-required` mode (in
  `core-indexed` mode the parser never runs at all). That is a hash lookup in
  Obsidian's own index, the same call the markdown path already makes for every
  body link in every visited note — so the canvas contribution is a rounding
  error against existing per-build work. Bounded by *total wikilinks written in
  canvas text nodes*, which is bounded by canvas content, not vault size.
- **Why resolution is deliberately NOT cached**: a rename changes a link's target
  without touching the canvas's mtime, so a resolution cache keyed on mtime would
  serve stale edges. Correctness over a micro-optimization that saves a hash lookup.
- Observed e2e: routing 3.4–4.2ms, layout 29–33ms across all 5 gate runs — no
  regression signal, and the sparse fixture's numbers sit where they always have.

## 6. Verification

`npm test` → **1075 passed / 80 files**. `npm run check` → clean (exit 0).
`npm run test:e2e -- vicinityGraph.e2e.ts` → 20 passed (its counts did not shift;
they are node counts, and `test.canvas` was already a member).

**Mutation check (are the new tests real?)** — disabling text-node harvesting in
the parser fails **7** of the new/updated tests. They are guards, not decoration.

### The 5-run acceptance gate

`npm run test:e2e -- edgeRoutingEval.e2e.ts`, five consecutive runs:

| run | `[eval] force/sparse` edges | routingMs | layoutMs | result |
|-----|------|-----------|-----------|--------|
| 1 | **11** | 4.20 | 29.1 | pass |
| 2 | **11** | 3.40 | 31.8 | pass |
| 3 | **11** | 4.20 | 32.6 | pass |
| 4 | **11** | 3.50 | 31.8 | pass |
| 5 | **11** | 3.50 | 30.2 | pass |

All five agree at 11 (`test.canvas -> note2.md` now always present). Obstacles 13
in every run, as before.

### Proof that the fix is a fix, not luck

A stable count could also mean "core-indexed happened to win all five times", so
I ran four further instrumented runs recording whether Obsidian had actually
indexed the canvas at graph-open time (temporary probe, reverted; tree is clean):

| probe run | canvas core-indexed? | edges |
|---|---|---|
| 1 | true | 11 |
| 2 | **false** | 11 |
| 3 | **false** | 11 |
| 4 | true | 11 |

**The boot race is still there and now lands on both regimes — and the edge count
no longer moves.** That is precisely the "benign by construction" outcome option 2
was chosen for. (Pre-fix, the ticket measured 5/5 correlation: fallback ⇒ 10,
core ⇒ 11.)

## 7. Files changed

- `src/shared/Wikilinks.ts` (new) + `src/shared/Wikilinks.test.ts` (new) — the one
  place that knows wikilink syntax.
- `src/adapters/CanvasFallbackParser.ts` — yields `CanvasReference`s incl. text-node
  links; header no longer describes a V1 skip. Tests rewritten.
- `src/adapters/CanvasParseCache.ts` — caches references, not paths; documents
  parse-cached / resolution-fresh. Test added for the cached scan.
- `src/adapters/ObsidianLinkProvider.ts` — resolves both reference kinds at build
  time (`resolvedCanvasTargetsOf`); canvas branch simplified.
- `src/adapters/ObsidianLinkProvider.test.ts` — characterization block flipped to
  settled semantics for BOTH regimes (see §8) + a 6-test reconciliation block.
- `src/adapters/testFixtures/board.canvas` — text node reworded, embed added.
- `src/view/outlineEntryLabel.ts` — shares the wikilink pattern.
- `docs-internal/plan/high-level-plan.md` — settled semantics + "both paths must
  agree, and why"; V2+ deferral removed; Testing section says parity.
- `scripts/setup-dev-vault.sh` — `test.canvas` text node no longer says "skipped in V1".
- `e2e/edgeRoutingEval.e2e.ts` — `ensureCanvasFixtureIsIndexed()` + its two
  constants + `beforeAll` call deleted; 10-vs-11 prose dropped. (This removed the
  suite's ONLY vault write.)
- `_tickets/…markdown-style-links….md` (new, `nid_ygo7h95ssgmunaqsprc1zlmfh_e`).

Commits: `621ece9` (fix + tests), `42076cb` (docs/fixture/e2e).

## 8. Called out explicitly

- **Intentional behaviour change to a characterization test**, human-approved via
  the ticket: `ObsidianLinkProvider.test.ts`'s "the two regimes disagree" block
  asserted the divergence and said "neither test asserts a preference". Both tests
  now assert the text-node edge, the docblock records the settled decision and
  cites the ticket, and the describe reads "both regimes must agree". Stated in the
  commit message too.
- **Two residual regime differences shipped knowingly** (markdown-style links,
  code-span links) — ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`, documented in the
  code and the plan doc rather than papered over.
- **Edge order is still not identical between regimes** and cannot be made so; the
  ticket's criterion is the edge SET.
- `.dev-vault/test.canvas` was deleted and reseeded locally, since seeding is
  `write_if_missing` and would not have refreshed it.
- **Not done, per instructions**: no `change_log` entry, ticket not closed, branch
  not merged.
