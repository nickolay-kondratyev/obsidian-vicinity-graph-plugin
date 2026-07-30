# Stage 1 review — carry `LinkKind`, change no behavior

Reviewer: IMPLEMENTATION_REVIEWER. Diff reviewed: `e387f5a..HEAD` (`d48d914`, `5022a72`, `5c13f8f`, `05658ea`).

**Independently verified:** `npm test` → 91 files / **1199 passed**, exit 0. `npm run check` (src + e2e) → exit 0.
No `sanity_check.sh` in this repo. Logs: `.tmp/rev_test.log`, `.tmp/rev_check.log`.

## Verdict

**YES — Stage 1 is ready to build Stage 3 on top of.** The port shape
(`getOutgoingReferences` as the truth, `getOutgoingLinks` as a derived kind-blind view,
`OutgoingReferences` as the single collapse point) is the right seam for a 3-value
channel enum: Stage 3 adds `OutgoingReferences.targetsOfKind(refs, kind)` next to
`targetsOf` and `neighborsOf(channel)` becomes a filter. Nothing needs to be undone.

Zero BLOCKING. Four SHOULD-FIX (three of them disclosure/doc, one test-honesty).
The "carry the kind, change nothing" contract holds for markdown end to end; the
one place it leaks is canvas **edge COUNTS**, below.

---

## SHOULD-FIX

### S1. "Zero behavior change" is not quite true: canvas edge COUNTS switched source, undisclosed
`src/adapters/ObsidianLinkProvider.ts:135-152` (`getLinkCount`), consumed by
`src/engine/EdgeCounts.ts:32` → the rendered edge-count badge.

Before 3a, a **core-indexed** canvas had no entry in `canvasOutgoingByPath`, so
`getLinkCount` fell through to `resolvedLinks[source][target]` — *core's* number. Now
every canvas has an entry, so the badge is **our parsed occurrence count** for every
canvas. Per `docs-internal/tickets/ticket-step-03-human-smoke-run.md`, canvases *are*
core-indexed on the real install, so this is the live path, not a corner.

The declared inversion (empty `{}` entry no longer suppressing the parser) is a genuine
improvement and correctly justified. This second change is not mentioned anywhere in
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`, and it is the exact surface that produced the
historical e2e edge-count flake in `nid_s676x55uojmtcwh9t4l9mc6zl_e`.

Failure scenario: a canvas where core's count and our occurrence count differ in
MULTIPLICITY (not in edge set) — e.g. a file node to `note-a.md` plus a text node
`[[note-a]] [[note-a]]`, or any shape where core coalesces. Existing coverage only pins
the trivially-agreeing case (`ObsidianLinkProvider.test.ts:181`, expected `1` against a
seeded `{"note-a.md": 1}`). Set parity is well tested; count parity is not tested at all.

Direction: (a) state the change in the PUBLIC record and the change_log — it is an
unavoidable consequence of owner-approved 3a, not unapproved scope; (b) add ONE test with
a target referenced **twice** in the same canvas, asserting our count against the seeded
`resolvedLinks` count, so a future divergence in multiplicity fails here rather than in e2e.

### S2. The `Reference.original` cross-check test cannot fail — it is circular
`src/adapters/ReferenceOrder.test.ts` (the
`provenance agrees with Reference.original` describe).

The fixture routes each authored reference into `links`/`embeds` **using
`original.startsWith("!")`**, then asserts the resulting kinds equal
`original.startsWith("!")`. Both sides are derived from the same string by the same rule,
and `original` is never handed to production (`ref()` does not set it). The suite's own
doc comment claims "it fails if provenance and the `!` prefix could ever disagree" —
that is an overclaim: the assumption it purports to guard (that Obsidian's own routing
agrees with the `!` prefix) is not exercised by any code under test. What it actually
asserts is already covered by the `link kinds by provenance` describe above it.

This is the kind of test CLAUDE.md's EARN_TRUST clause is about — it *looks* like a
tripwire and is not one.

Direction: either delete it as a duplicate of the provenance suite, or keep it and rewrite
the doc comment to say honestly what it covers (`ReferenceOrder` maps provenance →
kind, nothing more). If the assumption genuinely wants a tripwire, that is a real-Obsidian
measurement (`e2e/`, alongside `canvasMarkdownLinkIndexing.e2e.ts`) — worth a ticket, not
a unit test.

### S3. Stale docs left behind by the regime deletion
`docs-internal/plan/high-level-plan.md`, "Canvas support" section — two bullets still
describe the deleted machinery, directly under the bullet that says it was deleted:

- "…and **the adaptive design is correct on every install either way**." — there is no
  adaptive design any more.
- "The fallback path is a known stale-data risk and gets dedicated test coverage,
  including fixtures with canvas entries deliberately absent **to exercise detection**." —
  detection is gone; absence of a `resolvedLinks` entry is now a no-op.

Also `src/main.ts:215-231`: the log LINE was updated, but the method doc still frames the
delta as "the incoming edges that exist ONLY because our canvas **fallback** parser
produced them", and the local is still `fallbackOnly`. The word "fallback" no longer
denotes anything — it is now simply *the* parser (as `CanvasFallbackParser`'s own class
doc now correctly says).

Direction: strike the two stale bullets; rename `fallbackOnly` → e.g. `parserOnly` and
align the method doc.

### S4. The degraded markdown path becomes a real (if transient) Stage 3 trap — flag it in the ticket now
`src/adapters/ObsidianLinkProvider.ts:270-278`.

Markdown not yet in `getFileCache` degrades every reference to `kind: "link"`. Harmless in
Stage 1 (nothing consumes the kind). In Stage 3 it is user-visible: with
`embedDepthOut = 0`, an embedded note reached from a not-yet-cached source is traversed as
a **plain link** and therefore still appears — the setting silently does not hold during
the boot window. That is a POLS problem of exactly the flavour 3a was adopted to kill for
canvases.

The implementer documented the degradation honestly (port doc + `high-level-plan.md`), and
it is transient, so it is not a Stage 1 defect. Direction: record it as an explicit Stage 3
acceptance item on `_tickets/separate-depth-budget-for-embedded-outgoing-links.md` (pin the
behavior with a test and decide: accept, or return `[]` for an uncached markdown file and
let the next `metadataCache` event rebuild). Deciding it in Stage 3 under time pressure is
how it turns into a bug.

---

## NITs (take or leave)

- `src/adapters/ObsidianLinkProvider.ts:407-408` — stray double blank line left by the
  edit. `npm run check` is `tsc` only, so nothing catches it.
- `src/adapters/ObsidianLinkProvider.ts:330` — "That is precisely what makes the fallback
  regime agree with the core-indexed one": there is one regime now; the sentence should say
  "what makes our parse agree with core".
- `src/adapters/ObsidianLinkProvider.ts:275` comment "Canvases never land here" is very
  slightly overclaimed: a canvas CREATED after the provider was built is not in
  `canvasOutgoingByPath` and would fall through to `resolvedLinks` keys until the next
  rebuild. Same as before this change; only the comment is new.
- `LINK_KINDS` (`src/shared/LinkKind.ts:34`) is exported but consumed only by its own test.
  The implementer deliberately left it unexported from the engine; fine, but it is unused
  production surface until Stage 3 needs `Record<LinkKind, …>`.
- `create()` awaits `cachedRead` for EVERY canvas sequentially with no `try`/`catch`
  (`ObsidianLinkProvider.ts:82-100`). A single failing read (file deleted between
  `getFiles()` and `read`) rejects the whole provider build. Pre-existing, but 3a widens
  the exposure from "unindexed canvases" to "all canvases". Low probability; worth a ticket,
  not a Stage 1 fix.

---

## The three declared deviations — judged

**(a) `LinkKind` in `src/shared/`, re-exported from `src/engine/index.ts` — CORRECT.**
`Wikilinks` / `MarkdownInlineLinks` must name the kind and live in `shared/`; putting the
type in `engine/` would invert `shared → engine`. `shared/` is under the same
`importGuard` purity rule, so every property the brief wanted (pure, vault-generic, no
obsidian/canvas leakage) holds, and consumers still import from `../engine`. This is the
better call than the brief's literal wording.

**(b) `getLinkCount` left kind-blind — CORRECT, and it does NOT trap Stage 3.**
Verified independently: the only `getLinkCount` caller in the engine is
`EdgeCounts.attach` (`src/engine/EdgeCounts.ts:32`); `VicinityTraversal` never asks for
counts, so a per-channel BFS needs nothing here. Splitting the markdown number would mean
re-deriving core's merged `resolvedLinks` total from the file cache — a rendered-badge
change, which Stage 1 forbids. The reasoning is recorded in the port doc, which is where it
belongs. The residual question it defers is a **Stage 2** one (ticket §5: an edge that is
both linked and embedded is a *summary*, `link | embed | both`, not a scalar) — Stage 2
should own it, and `EdgeVisibility`'s induced-edge sweep is the second consumer to check
then.

**(c) `getOutgoingLinks` kept as a derived view — CORRECT, and load-bearing.**
It is what let ~30 pre-existing outgoing assertions and both consumers
(`NodeSizer.nodeBearingOutlinkCount`, `VicinityTraversal.neighborsOf`) stay byte-for-byte
unchanged — the strongest available evidence for the zero-change claim. The interface doc
makes "MUST answer `targetsOf(getOutgoingReferences(path))`" an obligation, and both
implementations honour it in one line, so there is no second computation to drift.
`NodeSizer` staying kind-blind is right: counting a both-linked-and-embedded pair twice
would silently resize nodes.

## Deleted code — dead, and nothing lost

`CanvasCapability.ts` + `CanvasCapability.test.ts`: I grepped `src/`, `e2e/` and
`docs-internal/` — the only surviving references are historical records, plus
`high-level-plan.md`'s explicit "**Superseded**" note. The detector had exactly one caller
and 3a removes it; its test guarded a behavior the owner decided to delete (ticket SCOPE
DECISION → "§3a always-parse canvases — still needed"). The removal is **aligned, not
silent**: the replacing suite's doc comment records the inversion in-repo, and the one
inverted case is re-stated as the new contract rather than dropped. That meets the CLAUDE.md
bar. The other four suites were **retitled only** — I diffed the assertions: unchanged.

## Test quality

Good. BDD `WHEN … THEN`, one behavior per test, no `toBeTruthy`-style soft asserts, no
silent fallbacks. The new canvas-kind cases are genuinely falsifiable (a file node pointing
at a non-note still asserts `embed`, which would break if kind were derived from the
target). The `resolvedLinks`-keys degradation is pinned explicitly rather than left
implicit — that is the honest choice. The new "a canvas whose JSON names nothing reports
nothing even when `resolvedLinks` claims an edge" case is a real guard against the deleted
regime leaking back through the fallback. Sole exception: **S2**.

`FakeLinkProvider`'s "links then embeds" ordering (rather than production's offset order)
is a fixture/production divergence, but it is documented in the type and it does **not**
bite Stage 3: a kind-pure channel filters to one kind, and relative order *within* a kind is
preserved. Acceptable.

## Documentation updates needed

- `docs-internal/plan/high-level-plan.md` — the two stale "Canvas support" bullets (S3).
- `src/main.ts` `logBacklinkProvenance` doc + `fallbackOnly` local (S3).
- `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` / `_change_log` — disclose the canvas
  `getLinkCount` source switch (S1).
- `_tickets/separate-depth-budget-for-embedded-outgoing-links.md` — add the uncached-markdown
  degradation as an explicit Stage 3 acceptance item (S4).
- No `CLAUDE.md` change required: nothing in the settings pipeline, settings rows, spec or
  persistence was touched, and I verified that independently.
