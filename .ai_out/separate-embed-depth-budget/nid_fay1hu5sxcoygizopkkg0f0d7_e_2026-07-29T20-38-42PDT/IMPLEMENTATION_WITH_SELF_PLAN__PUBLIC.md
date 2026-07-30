# Stage 1 — carry `LinkKind`, change no behavior (DONE)

Ticket: `_tickets/separate-depth-budget-for-embedded-outgoing-links.md`
(`nid_fay1hu5sxcoygizopkkg0f0d7_e`). Branch: `nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`.

**Status: `npm test` 1199 passed / 91 files. `npm run check` (src + e2e) clean.**
Three commits on the current branch (`d48d914`, `5022a72`, `5c13f8f`).

---

## Plan I executed

1. `LinkKind` + the two shared regex captures (syntax half).
2. `ReferenceOrder` provenance + `Reference.original` cross-check (markdown half).
3. `CanvasFallbackParser.linkKind` (canvas half).
4. Port: `OutgoingReference` + `getOutgoingReferences`, `FakeLinkProvider.embeds`.
5. `ObsidianLinkProvider`: kind-carrying references + **always-parse canvases (3a)**.
6. Docs (`high-level-plan.md`, `architecture-map.md`), ticket note, change_log.

---

## THE CONTRACT STAGE 3 READS

### `LinkKind` — `src/shared/LinkKind.ts`

```ts
export const LINK_KINDS = ["link", "embed"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export interface HarvestedLink { readonly linkText: string; readonly kind: LinkKind; }
export class LinkKinds { static ofEmbedMarker(marker: string): LinkKind }
```

**Deviation, deliberate:** the brief said "introduce `LinkKind` in the engine".
It lives in `src/shared/` and is **re-exported from `src/engine/index.ts`**
(`export type { LinkKind } from "../shared/LinkKind"`). Reason: `Wikilinks` and
`MarkdownInlineLinks` must name the kind they harvest, they live in `src/shared/`,
and `src/engine/` already imports `src/shared/` — so `shared → engine` would
invert the layering. `src/shared/` is under the SAME purity guard as the engine
(`importGuard.test.ts`), so every property the brief actually wanted (pure,
vault-generic, no canvas/obsidian leakage) holds. Consumers still import it from
`../engine`, per the repo's "import from `engine/index.ts`" rule.

`LINK_KINDS` is intentionally NOT re-exported from the engine yet — nothing
outside its own test uses it. Stage 3 should re-export it the moment it needs
`Record<LinkKind, …>` completeness.

### The port — `src/engine/LinkProvider.ts`

```ts
export interface OutgoingReference {
	readonly target: VaultPath;
	readonly kind: LinkKind;
}

export class OutgoingReferences {
	static targetsOf(references: readonly OutgoingReference[]): readonly VaultPath[]
	static deduped(references: readonly OutgoingReference[]): readonly OutgoingReference[]
}

export interface LinkProvider {
	getOutgoingReferences(path: VaultPath): readonly OutgoingReference[]; // NEW — the outgoing TRUTH
	getOutgoingLinks(path: VaultPath): readonly VaultPath[];              // unchanged signature, now a DERIVED view
	getIncomingLinks(path: VaultPath): readonly VaultPath[];              // untouched, kind-blind
	getFileMetadata(path: VaultPath): FileMetadata | undefined;           // untouched
	getLinkCount(source: VaultPath, target: VaultPath): number;           // untouched, kind-blind
}
```

**Shape rationale (why this and not something else):**

- **Deduplication is per `(target, kind)`.** A note that both embeds and plainly
  links `B` reports two references. That is the ticket's §5 multiplicity made
  visible where it is free.
- **`getOutgoingLinks` KEPT rather than replaced.** Both providers implement it as
  `OutgoingReferences.targetsOf(this.getOutgoingReferences(path))` — one line, no
  second computation, and the doc comment makes that a stated obligation. The
  payoff is the acceptance bar: ~30 pre-existing outgoing assertions and both
  current consumers (`NodeSizer.nodeBearingOutlinkCount`,
  `VicinityTraversal.neighborsOf`) are **byte-for-byte unchanged**, which is the
  strongest available proof of zero behavior change. `NodeSizer` in particular
  MUST stay kind-blind — counting a both-linked-and-embedded pair twice would
  silently resize nodes.
- **No `targetsOfKind` helper yet.** Stage 3 needs it (`neighborsOf(channel)`
  filtering outgoing by kind); adding it now would be unused code. Add it to
  `OutgoingReferences` — that is where the kind-blind collapse already lives.

### `getLinkCount` stays kind-blind — DEVIATION from brief item 5, with reason

The brief asked for counting to become kind-aware "ONLY as far as Stage 3 will
need". Applying that limiting clause honestly, **Stage 3 needs nothing**:
`VicinityTraversal` never calls `getLinkCount` (verified — the only callers are
`EdgeCounts.attach` and tests). Making it kind-aware anyway would be actively
harmful right now:

- For markdown the number IS Obsidian's own `resolvedLinks[source][target]`, which
  **merges links and embeds**. There is no way to split it without re-deriving the
  total from `getFileCache`, and that re-derivation could produce a different
  total than core reports — i.e. a changed edge badge, which Stage 1 forbids.
- Reporting a split whose parts do not provably sum to the total we display would
  be a dishonest port.

The port doc now says all of this out loud. **If Stage 2's visual embed
distinction wants per-kind counts, that is the moment to revisit** — and the
honest shape is then `Readonly<Record<LinkKind, number>>` with the markdown total
re-derived from the cache, accepted as a behavior change and measured.

### Where each kind comes from

| Source | Kind | Mechanism |
|---|---|---|
| markdown `cache.links` | `link` | array provenance |
| markdown `cache.embeds` | `embed` | array provenance |
| markdown `frontmatterLinks` | `link` | unconditional (property links are never embeds) |
| canvas `type:"file"` node | `embed` | constant — a file node renders the file inline |
| canvas `type:"text"` node | as written | the `!` is now capture group 1 of both shared regexes |
| markdown NOT yet in `getFileCache` | `link` (degraded) | `resolvedLinks` keys merge kinds — see below |

**The one degraded path**, and it is transient + markdown-only:
`outgoingReferencesOf`'s final fallback (`resolvedLinks` keys) cannot know a kind.
Canvases can no longer land there, which is exactly why 3a mattered.

### `FakeLinkProvider` fixture shape

```ts
new FakeLinkProvider({
	files: [...],
	links:  { "a.md": ["b.md"] },   // plain links (existing key, unchanged meaning)
	embeds: { "a.md": ["c.md"] },   // NEW — embeds
});
```

A second map rather than a tagged list: every one of the ~14 existing fixture
files compiles and behaves identically (zero churn), and the common kind-blind
fixture stays a bare array of paths. Cost, documented in the type: a source's
references order as "its links, then its embeds". No fixture depends on that.

---

## Always-parse canvases (option 3a) — what changed and what it cost

- `ObsidianLinkProvider.create` no longer calls `CanvasCapabilityDetector`; **every**
  `.canvas` is parsed via the existing mtime-cached `CanvasParseCache`.
- `src/adapters/CanvasCapability.ts` **and its test are DELETED** — dead once
  nothing consults the regime. (The detector's own logic was never wrong; it just
  has no caller.)
- `fallbackServedCanvasPaths` → **`parsedCanvasPaths`** (it now lists every canvas);
  `main.ts`'s backlink-provenance debug log updated to match.
- Incoming links: a core-indexed canvas can now be reported by BOTH the
  backlinks/inversion path and the canvas map — the pre-existing `dedupe` handles
  it, pinned by a test.

**Why it is the right shape, not just the asked shape:** `resolvedLinks` is a
merged link+embed COUNT, so a core-served canvas could not name a kind at all; and
*whether* core indexed a given canvas is a boot race, so consulting it would have
made kinds boot-timing-dependent. This is the permanent fix shape for closed
ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`.

---

## Tests — added and CHANGED (full disclosure)

### Added (all BDD, one behavior per test)

- `src/shared/LinkKind.test.ts` — marker → kind, and the kind enumeration.
- `Wikilinks.test.ts` / `MarkdownInlineLinks.test.ts` — new "kinds" describes:
  plain vs embed, embed + link on the SAME target keeping distinct kinds, embed
  with alias+subpath.
- `CanvasFallbackParser.test.ts` — "link kinds" describe: file node ⇒ embed (even
  pointing at a non-note), text-node `[[x]]` ⇒ link, `![[x]]` ⇒ embed, `[l](x)` ⇒
  link, `![a](x)` ⇒ embed.
- `ReferenceOrder.test.ts` — provenance describe (links/embeds/frontmatter, and the
  same target both ways), **plus the `Reference.original` cross-check**: one
  authored-reference table drives BOTH the cache arrays (by Obsidian's routing
  rule) and the expectations (by the `!` prefix), so provenance and the prefix
  signal cannot silently disagree.
- `FakeLinkProvider.test.ts` — fixture kinds, links-before-embeds order, the
  both-linked-and-embedded pair (two references, one target, count 2, one linker).
- `ObsidianLinkProvider.test.ts` — markdown kinds (provenance, frontmatter, order
  preserved, both-kinds pair, the degraded `resolvedLinks`-keys case) and canvas
  kinds (file node, `![[x]]`, `[[x]]`, `![](x)`, both-kinds canvas, **and kinds
  unchanged when core has also indexed the canvas**).

### CHANGED — and exactly why

1. **DELETED: `src/adapters/CanvasCapability.test.ts`** (with its subject). It
   tested a detector that no longer has a caller. Not a weakening — the behavior
   it guarded was removed by design (deliverable 3).
2. **REPLACED: the `ObsidianLinkProvider canvas regime is decided PER CANVAS`
   suite** → `ObsidianLinkProvider parses EVERY canvas (resolvedLinks is never
   consulted for canvas links)`. Its 4 cases were re-pointed at the new contract
   and 2 were added. **One case genuinely inverted, deliberately:**
   - was: *"WHEN an indexed canvas has no links at all THEN its empty index entry
     is respected"* — core's `{}` suppressed our parser.
   - now: *"WHEN core's index entry for a canvas is EMPTY but the canvas has a file
     node THEN the parsed link wins"*.
   That is the deleted regime, stated as the new contract. The replacement suite's
   doc comment records the inversion in-repo so nobody re-discovers it as a bug.
3. **RETITLED (assertions untouched): the three canvas parity suites.** They no
   longer test "two regimes agree" (there is one path now); they test that our
   parse **matches what core reports** and that core's index entry **makes no
   difference**. Same fixtures, same expectations, honest names. The "both regimes
   must agree" rationale comments were rewritten for the same reason.
4. **Mechanically updated expectations** (new field, same behavior):
   `CanvasFallbackParser.test.ts` and `CanvasParseCache.test.ts` `CanvasReference`
   literals gained `linkKind`; `ReferenceOrder.test.ts` `OrderedReference` literals
   gained `kind`; the two shared matcher suites route through a local
   `targetsOf()` helper because `linkTargetsOf` became `harvestedLinksOf`.
   **No assertion was relaxed or removed.**

---

## Landmines Stage 3 must know

- **`Wikilinks.globalPattern()` capture groups SHIFTED**: group 1 is now the embed
  marker, group 2 the inner text. `src/view/outlineEntryLabel.ts` was updated
  (its `String.replace` callback gained the extra positional arg). Any new caller
  of `globalPattern()` must count from 2 — the constants
  `EMBED_MARKER_GROUP` / `INNER_TEXT_GROUP` document this in-module.
- **`CanvasReference` now has TWO tags**: `kind` = resolution mechanism
  (`file-node` / `text-node-link`, unchanged), `linkKind` = the link/embed fact.
  They are independent; do not derive one from the other.
- **D5 is already honoured with no new code**: `VicinityTraversal`'s
  `eligibility.isNodeBearing` gate (`VicinityTraversal.ts:122-124`) drops embedded
  attachments before enqueue, so `embedDepthOut` will cover embedded NOTES only.
  Stage 3 should PIN this with a test, not build it.
- **`getIncomingLinks` is untouched and stays kind-blind** — the owner scope cut.
  `BacklinksAdapter` was not touched at all; no `getBacklinksForFile` probe.
- **Nothing consumes the kind.** `VicinityTraversal`, `NodeSizer`, `EdgeCounts`,
  `DepthSettings`, `SETTINGS_SPEC`, every settings row, all CSS: **unchanged**.

---

## COST

`git diff --stat e387f5a` (branch point), `src/` + `docs-internal/`:

| Slice | Files | +/- |
|---|---|---|
| **Total** | 23 | **+914 / −305** |
| Production code (`src/**` non-test) | 12 | +371 / −170 |
| Tests (`src/**/*.test.ts`) | 9 | +525 / −128 |
| Docs (`docs-internal/`) | 2 | +18 / −7 |

Per-file (`src/` + `docs-internal/`):

```
 docs-internal/architecture-map.md         |   2 +-
 docs-internal/plan/high-level-plan.md     |  23 ++-
 src/adapters/CanvasCapability.test.ts     |  33 ----   (deleted)
 src/adapters/CanvasCapability.ts          |  26 ----   (deleted)
 src/adapters/CanvasFallbackParser.test.ts |  53 ++++++-
 src/adapters/CanvasFallbackParser.ts      |  41 +++--
 src/adapters/CanvasParseCache.test.ts     |   6 +-
 src/adapters/ObsidianLinkProvider.test.ts | 240 ++++++++++++++++++++++++------
 src/adapters/ObsidianLinkProvider.ts      | 149 +++++++++++--------
 src/adapters/ReferenceOrder.test.ts       |  95 +++++++++++-
 src/adapters/ReferenceOrder.ts            |  38 ++++-
 src/engine/FakeLinkProvider.test.ts       |  75 ++++++++++
 src/engine/FakeLinkProvider.ts            |  77 +++++++---
 src/engine/LinkProvider.ts                |  64 +++++++-
 src/engine/index.ts                       |   6 +-
 src/main.ts                               |  14 +-
 src/shared/LinkKind.test.ts               |  18 +++   (new)
 src/shared/LinkKind.ts                    |  38 +++   (new)
 src/shared/MarkdownInlineLinks.test.ts    |  71 ++++---
 src/shared/MarkdownInlineLinks.ts         |  39 +++--
 src/shared/Wikilinks.test.ts              |  62 ++++--
 src/shared/Wikilinks.ts                   |  39 +++--
 src/view/outlineEntryLabel.ts             |  10 +-
```

**Honest reading of this number.** This is NOT the measurement the ticket's
MEASUREMENT MANDATE is about. The mandate measures what ONE NEW SETTINGS FIELD
costs under the declarative descriptor model — that is **Stage 3** (`embedDepthOut`
+ the `Direction` → channel widening). Stage 1 touched **zero** settings files:
no `SETTINGS_SPEC`, no `settingsRows`, no presenter, no persistence, no defaults
tripwire. Its cost is the *plumbing of a new domain fact through the link layer*,
which the descriptor model neither helps nor hinders. Attribute it separately when
Stage 3 reports.

What Stage 1's number does say: **~200 production lines net**, half of which are
doc comments, and it **removed** two files. The single largest line item
(`ObsidianLinkProvider.test.ts`, +240/−~60) is test additions plus the regime-suite
replacement, not complexity.

---

## Deviations from the brief, collected

1. **`LinkKind` lives in `src/shared/`, re-exported from the engine** — layering
   (`shared → engine` would be an inversion). Same purity guarantees. §"THE CONTRACT".
2. **`getLinkCount` left kind-blind** — the brief's own "only as far as Stage 3
   will need" clause resolves to *nothing*, and doing it anyway would risk changing
   a rendered edge badge. Fully reasoned above and recorded in the port's doc.
3. **`getOutgoingLinks` kept alongside `getOutgoingReferences`** rather than
   replaced — it is a one-line derived view, and keeping it is what let ~30
   behavior-capturing assertions stay literally untouched as the zero-change proof.
