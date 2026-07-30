# Stage 1 — carry `LinkKind`, change no behavior (DONE)

Ticket: `_tickets/separate-depth-budget-for-embedded-outgoing-links.md`
(`nid_fay1hu5sxcoygizopkkg0f0d7_e`). Branch: `nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`.

**Status: `npm test` 1199 passed / 91 files. `npm run check` (src + e2e) clean.**
Three commits on the current branch (`d48d914`, `5022a72`, `5c13f8f`).

---

## Plan I executed

1. `LinkKind` + the two shared regex captures (syntax half).
2. `ReferenceOrder` provenance (markdown half). *(The `Reference.original`
   cross-check that shipped with it was deleted in ITERATION 1 — see S2.)*
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

### `getLinkCount` — kind-blind, but its canvas SOURCE changed. Read this.

> Amended in ITERATION 1. The original write-up called Stage 1 "zero behavior
> change" without qualification. That was wrong on one point: canvas edge COUNTS.
> Full disclosure in `## ITERATION 1 → S1` at the bottom. Everything below about
> the *kind-blindness* of the number still stands.

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
  same target both ways). ~~plus the `Reference.original` cross-check~~ —
  **DELETED in ITERATION 1 as circular; see S2.**
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

**Updated after ITERATION 1** (the iteration itself touched 5 files: +49 / −57):

| Slice | Files | +/- |
|---|---|---|
| **Total** | 23 | **+913 / −315** |
| Production code (`src/**` non-test) | 12 | +388 / −177 |
| Tests (`src/**/*.test.ts`) | 9 | +505 / −129 |
| Docs (`docs-internal/`) | 2 | +20 / −9 |

Per-file (`src/` + `docs-internal/`):

```
 docs-internal/architecture-map.md         |   2 +-
 docs-internal/plan/high-level-plan.md     |  27 ++-
 src/adapters/CanvasCapability.test.ts     |  33 ----   (deleted)
 src/adapters/CanvasCapability.ts          |  26 ----   (deleted)
 src/adapters/CanvasFallbackParser.test.ts |  53 ++++++-
 src/adapters/CanvasFallbackParser.ts      |  41 +++--
 src/adapters/CanvasParseCache.test.ts     |   6 +-
 src/adapters/ObsidianLinkProvider.test.ts | 267 +++++++++++++++++++++-------
 src/adapters/ObsidianLinkProvider.ts      | 163 ++++++++++--------
 src/adapters/ReferenceOrder.test.ts       |  49 +++++-
 src/adapters/ReferenceOrder.ts            |  38 ++++-
 src/engine/FakeLinkProvider.test.ts       |  75 ++++++++++
 src/engine/FakeLinkProvider.ts            |  77 +++++++---
 src/engine/LinkProvider.ts                |  64 +++++++-
 src/engine/index.ts                       |   6 +-
 src/main.ts                               |  24 +-
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

---

# ITERATION 1 — reviewer feedback (0 BLOCKING, 4 SHOULD-FIX)

`npm test` 1199 passed / 91 files, `npm run check` clean, both re-run after the
last edit. All four items resolved; three INCORPORATED, one INCORPORATED BY
DELETION. Nothing rejected.

## S1 — canvas edge COUNTS switched source, undisclosed → **INCORPORATED (kept + pinned + disclosed)**

**The reviewer is right and the original write-up was wrong.** "Zero behavior
change" was stated without qualification; it does not hold for canvas edge
**counts**. Before always-parse, a **core-indexed** canvas had no entry in
`canvasOutgoingByPath`, so `getLinkCount` fell through to
`resolvedLinks[source][target]` — *core's* number. Now every canvas has an entry,
so the rendered edge badge is **our parsed occurrence count for every canvas**.
Canvases *are* core-indexed on the real install, so this is the live path.

**I did NOT restore the old semantics.** Keeping the parse-derived count is the
more correct shape, and I'll defend that:

- The edge **SET** already comes from our parse (that is what 3a *is*). Sourcing
  the **COUNT** from core would split one edge across two authorities: an edge our
  parser reports that core has not indexed yet would render a badge of **0**.
- *Whether* core has indexed a given canvas is a boot race. Consulting it for the
  count puts the badge back on exactly the race 3a was adopted to kill — the
  historical e2e flake (`nid_s676x55uojmtcwh9t4l9mc6zl_e`).
- One authority per edge is the invariant worth having; "matches whatever core
  happened to have indexed at boot" is not.

So the honest resolution is the one TOP_LEVEL_AGENT named: **keep it, pin it,
disclose it loudly.** Done in four places:

1. **Test (the pin)** — `ObsidianLinkProvider.test.ts`: *"WHEN a core-indexed
   canvas's own count DISAGREES with our parse THEN the parsed count is
   reported"*. A canvas with a file node **and** a text node saying
   `[[note-a]] and again [[note-a]]`, seeded `resolvedLinks: {"board.canvas":
   {"note-a.md": 1}}`, asserting **3**. The two numbers genuinely differ, so the
   test fails if anyone routes the count back through core. The pre-existing
   coverage only pinned the trivially-agreeing case; count parity now has a home.
2. **Code** — a `DECLARED BEHAVIOR CHANGE` doc block on `getLinkCount`.
3. **Spec** — `high-level-plan.md` "Canvas support" gained an *"our parse is the
   SOLE authority per canvas edge — set AND count"* bullet (it replaced one of
   the stale bullets from S3, so the section shrank rather than grew).
4. **Records** — ticket note on `nid_fay1hu5sxcoygizopkkg0f0d7_e` and a note on
   change_log entry `o1a5bjgjpro68l9nmxnr4yzp2`, both naming the user-visible
   effect: on a canvas where core coalesces references we count separately, the
   badge NUMBER can differ from before; the edge SET is unchanged.

## S2 — the `Reference.original` cross-check cannot fail → **INCORPORATED (deleted, with a real replacement filed)**

The reviewer is right: it was circular. The fixture routed each authored
reference into `links`/`embeds` **using `original.startsWith("!")`** and then
asserted the resulting kind equals `original.startsWith("!")`. `original` was
never handed to production, so both sides were the same string put through the
same rule. A test that cannot fail while *claiming in its doc comment to be a
tripwire* is worse than no test — that is squarely the EARN_TRUST clause.

**I chose delete over rewrite, deliberately.** A non-circular unit version cannot
exist: the assumption it purported to guard is *"Obsidian core routes exactly the
`!`-prefixed references into `cache.embeds`"*, and in a unit test the **fixture
author** decides both arrays. There is no seam where Obsidian's real routing gets
a vote. Whatever residue is left after removing the circularity is already
covered by the `link kinds by provenance` describe directly above it (including
the same-target-both-ways case). Deleting it is DRY, not a coverage loss.

The assumption **does** deserve a tripwire — it just has to be a real-Obsidian
measurement, like `e2e/canvasMarkdownLinkIndexing.e2e.ts` is for canvas indexing.
Filed as ticket **`nid_t0x7ap99djfuzvz5p261ao7rn_e`** (linked to this one, p3):
open a note with a wikilink, an embed, a markdown-style link, an image embed and
a frontmatter property link in a real Obsidian, read `getFileCache`, and assert
which array each landed in — plus find out whether `original` is even populated
on desktop (it is documented "Not available on Publish").

## S3 — stale docs and the `fallback` misnomer → **INCORPORATED**

- `high-level-plan.md`: both stale bullets struck. *"the adaptive design is
  correct on every install either way"* → a bullet saying older-install behavior
  no longer matters because core's index is not consulted on **any** install.
  *"fixtures with canvas entries deliberately absent to exercise detection"* →
  replaced by the S1 sole-authority bullet (detection is gone; an absent
  `resolvedLinks` entry is now a no-op).
- `main.ts`: `logBacklinkProvenance`'s doc no longer says "canvas **fallback**
  parser"; local `fallbackOnly` → **`parserOnly`**, and the log line reads
  `[OUR parser only]`.
- Two adjacent NITs taken while in the same lines (not gold-plating — same
  misnomer, same edit): `ObsidianLinkProvider.ts` *"what makes the fallback
  regime agree with the core-indexed one"* → *"what makes our parse agree with
  what core reports elsewhere in Obsidian"*, and the stray double blank line at
  the former line 407. The remaining NITs (the slightly-overclaimed "canvases
  never land here" comment, unused `LINK_KINDS` export, unguarded `cachedRead`
  loop) were left alone as out of scope for this iteration.

## S4 — uncached-markdown kind degradation → **INCORPORATED as a Stage 3 acceptance item**

Recorded on the ticket (`nid_fay1hu5sxcoygizopkkg0f0d7_e`) and repeated here so
Stage 3 cannot miss it.

### ⚠ STAGE 3 ACCEPTANCE ITEMS (both must be closed IN Stage 3, not deferred)

1. **The uncached-markdown boot window.**
   `ObsidianLinkProvider.outgoingReferencesOf`'s final fallback (markdown not yet
   in `getFileCache`) degrades **every** reference to `kind: "link"`, because
   `resolvedLinks` keys merge kinds. Harmless today (nothing consumes the kind).
   In Stage 3 it is **user-visible**: with `embedDepthOut = 0`, an embedded note
   reached from a not-yet-cached source is traversed as a plain link and still
   appears — the setting silently does not hold during the boot window. Stage 3
   must (a) **pin the behavior with a test** and (b) **consciously choose**:
   ACCEPT the transient degradation, or return `[]` for an uncached markdown file
   and let the next `metadataCache` event rebuild. Do not decide this under time
   pressure at the end of Stage 3.
2. **D5 is already honoured with no new code** (carried forward from the original
   write-up because it is the other thing Stage 3 must *pin rather than build*):
   `VicinityTraversal`'s `eligibility.isNodeBearing` gate drops embedded
   attachments before enqueue, so `embedDepthOut` covers embedded **notes** only.

## Files touched by this iteration

`src/adapters/ObsidianLinkProvider.ts`, `src/adapters/ObsidianLinkProvider.test.ts`,
`src/adapters/ReferenceOrder.test.ts`, `src/main.ts`,
`docs-internal/plan/high-level-plan.md` — 5 files, **+49 / −57** (net −8; the new
pin test and doc blocks cost less than the circular suite that came out).
