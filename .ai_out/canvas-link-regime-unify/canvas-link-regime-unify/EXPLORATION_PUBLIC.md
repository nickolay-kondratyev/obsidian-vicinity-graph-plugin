# EXPLORATION — canvas link regime unify (code path)

Ticket: `_tickets/canvas-link-regime-is-re-detected-per-rebuild-...md` (id `nid_s676x55uojmtcwh9t4l9mc6zl_e`).
Human decisions (already recorded, non-negotiable): (1) wikilinks inside canvas
TEXT nodes DO produce edges; (2) fix via **unifying** the two regimes (not
freezing capability detection).

## 1. `src/adapters/ObsidianLinkProvider.ts` — full flow

- `create()` (L69-97): builds `CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))`
  (L74) → `CanvasCapability`. If `"fallback-required"`, iterates **every** vault
  file (L78-87), filters to `.canvas` (L79-81), and for each awaits
  `canvasParseCache.filePathsOf(vault, file)` (L82) — this is the only async
  work; everything else in the class is sync. Populates two maps:
  `canvasOutgoingByPath` (canvas path → ordered raw file-node paths, may
  contain unresolved/duplicate paths) and `canvasIncomingByPath` (target path →
  canvas paths, deduped via `new Set(filePaths)` at L84 before inversion).
  When `"core-indexed"`, both maps stay empty — the fallback parser never runs.
- Constructor (L53-67) is private; `backlinksAvailable=false` eagerly inverts
  `resolvedLinks` once (Q1 fallback).
- `getOutgoingLinks(path)` (L99-106): resolves `VaultFilePort`, computes
  `orderedReferencesOf` (markdown-only, else `null`), delegates to
  `outgoingPathsOf`.
- **`outgoingPathsOf` (L221-239) is the single branch point** that decides
  canvas edges today:
  - L222-225: `file.extension === "canvas" && canvasCapability === "fallback-required"`
    → read `canvasOutgoingByPath`, filter to paths that resolve in the vault
    (`vault.getFileByPath(target) !== null`, L224 — note: exact-path match,
    NOT `getFirstLinkpathDest` link-text resolution, because the fallback
    parser already stores literal `file` paths, not wikilink text), dedupe.
  - L226-235: markdown path (references !== null) → resolve each
    `reference.link` via `resolveReference` (`getFirstLinkpathDest`, L212-214),
    drop unresolved, dedupe (first-occurrence-wins).
  - L236-238: **core-indexed canvas** (and markdown not yet cached) falls
    through to `Object.keys(this.metadataCache.resolvedLinks[file.path] ?? {})`
    — i.e. core-indexed canvas outgoing links are NOT ordered by this code at
    all; comment at L236-237 says "order not contractual, best available".
    This is where core-indexed canvases already report text-node wikilinks
    (Obsidian's own indexer resolved them), for free.
- `attachmentsOf` (L272-276) and `getFileMetadata`'s outline-image logic both
  reuse `outgoingPathsOf`/`orderedReferencesOf`, so canvases never produce
  attachments/outline facts (guarded by `isOutlineBearingPath`/markdown-only
  checks elsewhere) — irrelevant to canvas edges but worth knowing before
  touching `outgoingPathsOf`'s signature.
- `getIncomingLinks` (L108-113): merges `backlinkSources` (core, sync) with
  `canvasIncomingByPath` (fallback-mode only) — this merge is regime-agnostic
  already (core-indexed canvases show up in `backlinkSources` via
  `getBacklinksForFile`/inversion, fallback canvases show up in the extra map).
- `getLinkCount` (L115-129): same branch — fallback mode counts occurrences in
  `canvasOutgoingByPath`; else reads `resolvedLinks[source][target]` directly
  (works uniformly for core-indexed canvas and markdown).
- Non-canvas (markdown) files: always go through `orderedReferencesOf` +
  `getFirstLinkpathDest` resolution (L226-235) — deterministic, cache-driven,
  no regime dependency.
- No `CanvasParseCache` instance is held beyond `create()`'s scope inside the
  provider; the cache itself is long-lived (injected, see §4).

## 2. `CanvasCapability.ts` + its test

`src/adapters/CanvasCapability.ts`: `CanvasCapabilityDetector.detect(resolvedLinkSourcePaths)`
returns `"core-indexed"` iff ANY key ends with `.canvas` (L20-27), else
`"fallback-required"`. Pure, sync, one comparison — the entire race lives in
*when* `resolvedLinks` is queried (it fills async at vault boot; see ticket
"Measured evidence" table: same vault, same session boots, different capability
5/5 correlated with edge count 10 vs 11).
Tests (`CanvasCapability.test.ts`, 4 cases, L5-19): canvas key present → core;
absent → fallback; empty `resolvedLinks` → fallback; `"my.canvas.md"` (suffix
match on `.md`, not `.canvas`) → fallback (guards against substring false
positive). No test exercises the boot-race itself (that's characterized at the
`ObsidianLinkProvider.test.ts` level, see §5).

## 3. `CanvasFallbackParser.ts` + `CanvasParseCache.ts`

`CanvasFallbackParser` (full file, 57 lines):
- Header (L1-10) explicitly documents **V1 scope: file-type nodes only,
  wikilinks inside text nodes deliberately skipped** — this comment is now
  stale per the human decision and must be rewritten (ticket AC #3).
- `parseFilePaths(canvasPath, rawJson)` (L17-26): `JSON.parse`, catches and
  `console.error`s + returns `[]` on malformed JSON (never throws, matches
  obsidian-id-lib philosophy) — this error-swallow behavior should be
  preserved for any new text-node scanning added here.
- `filePathsOf(parsed)` (L28-44): reads `parsed.nodes` (must be an array, else
  `[]`), iterates in array order, keeps only nodes accepted by
  `filePathOfNode`.
- `filePathOfNode(node)` (L46-56): accepts ONLY `{type: "file", file: <non-empty string>}`.
  `type: "text"`, `"link"`, `"group"`, or malformed nodes → `null` (dropped
  silently, no error).
- Returns **raw file paths as written in the JSON's `file` field** (literal
  vault paths, e.g. `"notes/alpha.md"`) — NOT wikilink text, NOT resolved
  targets, NOT doc ids. Order = node-array order ("the canvas's notion of
  reference order", L14). May contain duplicates (`board.canvas` fixture has
  `notes/alpha.md` twice) and unresolved/missing paths (`"gone.md"` test case)
  — resolution/dedup is explicitly the CALLER's job (`ObsidianLinkProvider.outgoingPathsOf`
  L224 filters existence, L224/234 dedupe; text-node wikilinks would need a
  DIFFERENT resolution step — see §6).
- Test fixture `src/adapters/testFixtures/board.canvas` (14 lines) already
  contains a representative text node: `{"id":"n2","type":"text","text":"A
  wikilink to [[beta]] is skipped in V1", ...}` and a `CanvasFallbackParser.test.ts`
  case (L28-31) asserting `"beta"` is NOT in the output — **this assertion
  will need to flip** once text-node scanning ships.

`CanvasParseCache.ts` (full file, 33 lines):
- Mtime-keyed (`Map<path, {mtime, filePaths}>`), one entry per canvas path.
  `filePathsOf(vault, canvasFile)` (L18-26) returns the cached `filePaths` iff
  `cached.mtime === canvasFile.stat.mtime`, else re-reads via
  `vault.cachedRead(canvasFile)` and re-parses through `CanvasFallbackParser.parseFilePaths`.
  Caches only `readonly string[]` (the parser's return shape) — if the parser's
  return type changes (e.g. to carry resolved text-node targets too), this
  cache's `CachedParse.filePaths` field and `filePathsOf`'s return type must
  change together.
- `evict(path)` (L29-31): manual invalidation hook for delete/rename, not
  auto-wired to any vault event in this file (caller's responsibility — check
  `main.ts` for wiring, not read in this pass).
- **Long-lived, plugin-owned** (doc comment L9-13): "provider builds come and
  go, the cache persists across them" — this is the ONE component in the
  canvas pipeline that already has cross-rebuild lifetime, and is exactly the
  kind of collaborator a "detect once" fix (candidate #1 in the ticket, NOT
  chosen) would have piggybacked on. For the chosen unify approach it stays as
  a plain re-parse cache; resolving text-node wikilinks does NOT need to be
  cached here separately since `getFirstLinkpathDest` is already O(1)-ish and
  called per query elsewhere in `ObsidianLinkProvider`.

## 4. `VicinityGraphBuilder.ts` — provider lifecycle

`build(mainPath)` (L36-70): constructs `ObsidianLinkProvider.create(...)` FRESH
on **every** call (L41) — this is the direct mechanism of the boot race (each
rebuild re-runs `CanvasCapabilityDetector.detect` against whatever
`resolvedLinks` looks like at that instant). Collaborators injected into
`VicinityGraphBuilder`'s constructor (L25-33): `vault`, `metadataCache`,
`docIdPort`, `canvasParseCache` (the ONE long-lived canvas collaborator),
`pluginDataStore`, `docDataStore`, `pathDocIdMap`. `VicinityGraphBuilder`
itself is presumably constructed once in `main.ts` (not read this pass) and
reused across rebuilds — so it, or a new sibling collaborator, is the natural
home for anything that must survive across builds (e.g. if a "detect once"
component were still desired as defense-in-depth, though the human decision is
option 2 = unify, not freeze).

## 5. Obsidian port seams + existing tests

`src/adapters/obsidianPorts.ts` (full file, 84 lines) — `MetadataCachePort`
(L69-74) already exposes:
```ts
getFirstLinkpathDest(linkpath: string, sourcePath: string): VaultFilePort | null;
```
This is the SAME method `ObsidianLinkProvider.resolveReference` (L212-214)
already uses for markdown link resolution — **the port needs no new surface**
to resolve canvas text-node wikilink text to a vault path; a canvas-text-node
scan just needs to call this existing method with the wikilink's captured
target string and the canvas's own path as `sourcePath`.

`src/adapters/FakeObsidianPorts.ts` (full file, 99 lines): `FakeObsidianSpec.resolutions`
(L26-27, `Readonly<Record<string, string>>`, "link text → target path") backs
`getFirstLinkpathDest` (L83-86) in tests — already reusable for a text-node
resolution test. `FakeObsidianFileSpec.content` (L16-17) already feeds canvas
JSON via `cachedRead` — no fixture-plumbing changes needed to test a text-node
canvas.

`ObsidianLinkProvider.test.ts` test names (grep, full list in PRIVATE notes) —
notably:
- `describe("ObsidianLinkProvider canvas handling")` (L92-137): fallback vs
  core-indexed baseline behavior (file-node-only cases).
- **`describe("ObsidianLinkProvider canvas TEXT-node wikilinks (the two regimes disagree)")`
  (L148-173)** — THE characterization tests to change. Doc comment (L140-147)
  explicitly says "CHARACTERIZATION, not endorsement... WHICH behaviour is
  correct is a product decision, tracked in ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`;
  neither test asserts a preference." Fixture (L151-159): one canvas, file node
  → `note-a.md`, text node body `"see [[note-b]]"`.
  - Test 1 (L161-164): fallback-required + text node with `[[note-b]]` →
    asserts `getOutgoingLinks(board.canvas) === ["note-a.md"]` (b dropped).
    **Must become `["note-a.md", "note-b.md"]` (or equivalent ordering) once
    unified.**
  - Test 2 (L166-172): core-indexed with `resolvedLinks: {"board.canvas":
    {"note-a.md":1, "note-b.md":1}}` → asserts both come through (already
    matches the target behavior; this test's role after the fix is to prove
    core-indexed installs remain unaffected/still-correct, not to change).

## 6. Existing wikilink-parsing utilities (DRY) + link resolution model

- **`src/view/outlineEntryLabel.ts`** (full file, 53 lines) already contains a
  wikilink regex: `const WIKILINK = /!?\[\[([^\]]+)\]\]/g;` (L26), used to
  strip `[[...]]`/`![[...]]` markup for display, capturing `target` or
  `target|alias` and using `link.slice(link.lastIndexOf("|") + 1)` to keep
  only the alias-or-target display text (L41). **This lives in `src/view/`**
  — per the layering rule (`view → adapters → engine`), `adapters/` CANNOT
  import from `view/`. If the parser is to DRY against this, the regex
  constant (or a tiny "extract wikilink targets from text" helper) would need
  to move somewhere `adapters/` can reach (`src/shared/` is the natural home —
  already exempt from the `obsidian`-import ban and already imported by both
  `view` and `adapters`, e.g. `VaultPathFacts` used by `FakeObsidianPorts.ts`
  L1). Note `outlineEntryLabel`'s regex captures the ALIAS-adjusted display
  text, not the raw target before a pipe — a canvas-text scanner instead wants
  the pre-pipe target (`link.slice(0, link.indexOf("|"))` or no split at all
  before calling `getFirstLinkpathDest`, since Obsidian's link resolution
  itself expects the target substring, not `target|alias`). So reuse should be
  at most the delimiter regex, not the replace-callback logic.
- No other `[[...]]`-matching regex exists in `src/engine/` or `src/adapters/`
  (grep across `src/**/*.ts` excluding tests found only the two hits above:
  `outlineEntryLabel.ts` and comments/docstrings referencing `[[links]]`
  informally).
- **Link resolution model, core vs fallback:**
  - Core (`resolvedLinks`): Obsidian's own indexer has ALREADY resolved link
    text to target paths by the time `resolvedLinks[source]` is populated —
    `outgoingPathsOf` L236-238 just reads the keys, no resolution logic in
    this codebase touches core-indexed canvas targets at all.
  - Fallback (file nodes): `CanvasFallbackParser` returns literal `file` path
    strings already (canvas JSON's `file` field is a vault-relative path, not
    wikilink text) — `outgoingPathsOf` L224 does existence-filtering
    (`vault.getFileByPath(target) !== null`), NOT `getFirstLinkpathDest`
    resolution, because there is nothing to resolve (already a path).
  - **Text-node wikilinks are the ONLY case needing NEW resolution logic**:
    `[[note-b]]` is link TEXT (possibly a shortest-path note name, alias, or
    heading subpath — `[[note#heading]]`/`[[note|alias]]`), which must be
    resolved the same way markdown body links are: via
    `metadataCache.getFirstLinkpathDest(linkpath, sourcePath)` (already used
    at `ObsidianLinkProvider.ts` L213), with `sourcePath` = the canvas's own
    path (mirrors how Obsidian core resolves canvas text-node links relative
    to the canvas file) and `linkpath` = the pre-pipe, pre-`#`-subpath target
    substring (Obsidian's own link-parsing convention — `getFirstLinkpathDest`
    is documented/used elsewhere in this repo to accept just the note-name
    part, see `ReferenceOrder`/reference `.link` fields which already arrive
    pre-split by Obsidian's own cache).
  - This resolution CANNOT happen inside `CanvasFallbackParser` (pure string/JSON
    parsing, no `obsidianPorts` dependency, no vault/metadataCache access) —
    it belongs in `ObsidianLinkProvider` (which already owns the resolution
    step for markdown) or a new adapter collaborator that takes a
    `MetadataCachePort`. `CanvasParseCache`/`CanvasFallbackParser` can still
    own EXTRACTING the raw `[[...]]` text-node substrings (pure, cacheable by
    mtime like today), while resolution-to-path happens at query time in
    `ObsidianLinkProvider` (consistent with how markdown resolution is NOT
    cached either — `resolveReference` is called fresh per query, backed by
    Obsidian's own already-sync `getFirstLinkpathDest`).

## 7. Ordering/dedup (`ReferenceOrder.ts`) and canvas edge ordering

- `ReferenceOrder.orderedReferences(cache)` (full file, 49 lines) is
  markdown-only machinery: merges `frontmatterLinks` (sentinel offset -1, L19,
  L40-43) with `links`+`embeds` sorted by `position.start.offset` (L44-45).
  It is driven by `CachedMetadataPort` (Obsidian's OWN per-file cache), which
  canvases never populate (`getFileCache` is markdown-cache-shaped; canvases
  are JSON, not indexed into `CachedMetadata` the same way) — **`ReferenceOrder`
  is NOT used for canvas ordering today and has no natural extension point for
  it** (no offsets exist for canvas JSON nodes the way they do for markdown
  body text).
- Canvas outgoing order today: fallback mode = raw node-array order (file
  nodes only, `CanvasFallbackParser`'s iteration order, L36-43); core-indexed
  mode = `Object.keys(resolvedLinks[canvasPath])`, explicitly "order not
  contractual" (`ObsidianLinkProvider.ts` L236-238 comment). **Neither regime
  has a real, meaningful order today for canvas edges** — so a unified
  implementation that interleaves file-node paths and text-node wikilink
  targets can pick ANY defensible order (e.g. "file nodes first in node-array
  order, then text-node links in node-array order" or "single pass over
  `nodes` array preserving encounter order across both node types") without
  breaking a documented ordering contract. The `board.canvas` fixture test
  (`CanvasFallbackParser.test.ts` L20-26) DOES assert exact node-array order
  for file nodes (`["notes/alpha.md","images/pic.png","notes/alpha.md"]`) —
  that ordering guarantee should almost certainly be preserved/extended
  (single encounter-order pass over `nodes`), not reset.
- No canvas edge needs a "reference order position" the way markdown's
  `imagePrecedesOutline`/attachment-order logic does — canvases don't feed
  `outlineFactsOf`/`attachmentsOf` (guarded by `isOutlineBearingPath` /
  markdown-only checks), so ordering only affects the edge array itself /
  dedup, not any offset-sensitive downstream rule.

## 8. Docs and tickets mentioning canvas text nodes

- `docs-internal/plan/high-level-plan.md`:
  - L83-88 "### Canvas support" section: L86 states the adaptive-strategy
    design in the present-tense as if final: "detect whether the install's
    `resolvedLinks` contains `.canvas` keys... If no, a fallback provider
    parses `.canvas` JSON (file-type nodes; text-node wikilinks are skipped in
    V1)." **This line must be rewritten** per ticket AC #3 ("chosen
    text-node-wikilink semantics are recorded in
    docs-internal/plan/high-level-plan.md").
  - L133-140 "## Deferred to V2+" list: L137 `"- Canvas text-node wikilink
    parsing."` — **this deferred-item line must be removed/moved** since the
    human decision un-defers it.
- `_tickets/canvas-link-regime-is-re-detected-per-rebuild-...md` (id
  `nid_s676x55uojmtcwh9t4l9mc6zl_e`) — the ticket itself; full text read, key
  points: human decisions already locked (§ "Human Decision" inline notes at
  L62 and L70 of that file), acceptance criteria at bottom (L76-84) include
  the e2e re-baselining item (`ensureCanvasFixtureIsIndexed()` deletion in
  `e2e/edgeRoutingEval.e2e.ts`, expected edge count 11 under the unified
  behavior) — that belongs to the e2e-agent's exploration half, cross-refed
  here for completeness.
- `docs-internal/tickets/ticket-step-03-human-smoke-run.md` L18-22: real-vault
  observation log — on the human's actual Obsidian 1.12.7 install, canvas is
  **core-indexed** (contradicts an earlier 2026-07-17 `count=0` snapshot logged
  elsewhere in the same file, not reproduced above) — i.e. the fallback path is
  NOT exercised in the maintainer's own dev vault, only in unit tests. Relevant
  context for how much real-world risk the fallback parser's correctness carries.
- `.ai_out/canvas-link-regime-unify/canvas-link-regime-unify/TOP_LEVEL_AGENT.md`
  — orchestration log for this very task; records the two human decisions
  verbatim (reproduced at top of this file) and the flow checklist
  (EXPLORATION already marked done for both code-path and e2e/doc agents).

## The hard part, stated precisely

To make `fallback-required` match `core-indexed`, the fallback pipeline must:
1. Extract `[[...]]` (and `![[...]]`? — core almost certainly also indexes
   `![[embed]]` in canvas text; TODO for implementation to verify against a
   real Obsidian instance or by inspecting what `resolvedLinks` produces for a
   text-node embed) substrings from `type: "text"` node bodies
   (`CanvasFallbackParser`, pure JSON/string work, extending `filePathOfNode`'s
   sibling for text nodes — needs a NEW node-kind branch, not a change to
   `filePathOfNode` itself, since text nodes can yield ZERO-OR-MANY targets vs.
   file nodes' exactly-one).
2. Resolve each extracted target string to a vault path via
   `metadataCache.getFirstLinkpathDest(linkpath, canvasPath)` — this is the
   SAME API `ObsidianLinkProvider.resolveReference` already calls for markdown,
   already exposed on `MetadataCachePort`, already fakeable via
   `FakeObsidianSpec.resolutions`. No port changes needed.
2a. Because resolution needs `MetadataCachePort` (an adapter-layer type) and
   `CanvasFallbackParser`/`CanvasParseCache` currently only deal in
   `VaultPort`/raw JSON (no `MetadataCachePort` dependency), the resolution
   step must either (a) move into `ObsidianLinkProvider` (parser keeps
   returning raw wikilink text alongside file paths; provider resolves both
   uniformly at query time — mirrors today's markdown flow exactly), or (b)
   thread `MetadataCachePort` into `CanvasParseCache`/`CanvasFallbackParser`
   (more invasive, breaks the parser's current pure-JSON-in/paths-out
   contract and its cache-by-mtime-only invalidation, since resolution can
   change independent of canvas mtime whenever OTHER files are renamed).
   **(a) is the shape that matches the existing markdown precedent and the
   existing `CanvasParseCache` cache-key contract**; recommend the
   implementation agent default to it unless a concrete reason favors (b).
3. Once both file-node paths and resolved text-node targets are unioned
   in the fallback's `canvasOutgoingByPath`/`canvasIncomingByPath` maps
   (`ObsidianLinkProvider.create`, L75-88), `outgoingPathsOf`'s
   fallback-mode branch (L222-225) already dedupes/filters correctly with NO
   further change needed — the unification work is almost entirely upstream
   of that branch.
4. The `core-indexed` branch (L236-238) needs NO code change (it already
   reports text-node links) — but its "order not contractual" comment and the
   overall behavior should be re-verified against whatever the fallback now
   produces, since the ticket's goal is for BOTH regimes to yield the "same
   edge set" (not necessarily identical ORDER, per the ticket's acceptance
   criteria wording "the same edge set").
