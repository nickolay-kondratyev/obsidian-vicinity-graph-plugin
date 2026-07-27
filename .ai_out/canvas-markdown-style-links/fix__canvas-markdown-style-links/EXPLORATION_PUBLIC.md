# Exploration — canvas markdown-style links (`nid_ygo7h95ssgmunaqsprc1zlmfh_e`)

Scope: full context for closing the residual gap where a canvas TEXT node's
markdown-style inline link `[label](note.md)` (and `![alt](pic.png)`) produces
an edge in the `core-indexed` regime but NOT in the `fallback-required`
regime. Related ticket already fixed: `nid_s676x55uojmtcwh9t4l9mc6zl_e`
(wikilinks-in-text-nodes parity) — read `.ai_out/canvas-link-regime-unify/`
for that prior work; do not duplicate it.

## 1. `src/shared/Wikilinks.ts` + test

File: `src/adapters/../shared/Wikilinks.ts` (absolute:
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/shared/Wikilinks.ts`)

Header doc (verbatim, load-bearing):

> What a wikilink LOOKS LIKE, in one place — shared because two layers ask the
> same question about the same syntax: `view/outlineEntryLabel` strips the
> markup for display, `adapters/CanvasFallbackParser` harvests link targets out
> of canvas text-node bodies.
>
> A small honest matcher, NOT a markdown parser (same spirit as
> `outlineEntryLabel`): one left-to-right pass, no code-span or escape
> analysis. DELIBERATELY NOT HANDLED: `[[links]]` inside code spans/fences
> (they are harvested as if they were real), and markdown-style `[a](b.md)`
> links (see ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`).

This is THE header comment documenting the residual known difference — it
names our exact ticket and says the two gaps NOT handled: (1) markdown-style
`[a](b.md)` links, (2) `[[wikilinks]]` inside code spans/fences. Ticket
`nid_ygo7h95ssgmunaqsprc1zlmfh_e` (this task) is scoped to gap (1) only —
the ticket body explicitly says the code-span gap is a known co-issue but the
Acceptance Criteria only cover markdown-style links.

Exported surface:
```ts
const WIKILINK_SOURCE = "!?\\[\\[([^\\]]+)\\]\\]";     // capture group 1 = raw inner text
const TARGET_TERMINATOR = /[#|]/;                        // ends the target: alias pipe or #heading/#^block

export class Wikilinks {
  static globalPattern(): RegExp                          // FRESH /g RegExp each call (mutable lastIndex)
  static linkTargetsOf(text: string): readonly string[]    // targets in written order, dupes kept, aliases/subpaths stripped, pure-subpath ([[#h]]) dropped
  private static targetOf(innerText: string): string       // trims + strips at first # or |
}
```

Key behavioral notes (from `Wikilinks.test.ts`, BDD "WHEN ... THEN ..." style):
- Written order preserved, duplicates kept (callers dedupe).
- Embeds (`![[x]]`) are links too.
- Alias (`[[note-b|Alias]]`) → only pre-pipe target.
- Heading subpath (`[[note-b#Section]]`) → only doc part.
- Both subpath+alias → doc part only.
- Same-file subpath (`[[#Section]]`) → dropped (empty target).
- Whitespace-padded target is trimmed.
- A fresh regex per call — a shared `/g` instance would leak `lastIndex` across calls (explicit regression test for this).
- Explicit non-match test: `"plain text with [a](b.md) only"` → `[]` (proves markdown-style links are NOT currently matched — this is exactly the gap this ticket must close, presumably via a new matcher/method, not by mutating `linkTargetsOf`'s wikilink-only contract).

## 2. `src/adapters/CanvasFallbackParser.ts` + test

Header doc explains scope and WHY (verbatim key excerpt):

> Fallback `.canvas` JSON parser — the ACTIVE link source for each canvas that
> `metadataCache.resolvedLinks` does not index... Scope: FILE-type nodes AND
> the wikilinks written inside TEXT-type node bodies, because those two
> together are what Obsidian's own indexer reports for a canvas — the two
> regimes must yield the same edge set or the boot race over which one runs
> becomes user-visible (ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`). `link`-type
> (external URL) and `group` nodes reference no vault document and yield
> nothing.
>
> PARSING ONLY: the two node kinds speak different languages — a file node
> carries a literal vault PATH, a text node carries LINK TEXT needing
> Obsidian's resolution — so both travel out as `CanvasReference`s and the
> caller (which owns the metadata cache) resolves them. Malformed JSON NEVER
> throws...: it logs `console.error` and yields no links.

API:
```ts
export class CanvasFallbackParser {
  static parseReferences(canvasPath: string, rawJson: string): readonly CanvasReference[]
  private static referencesOf(parsed: unknown): readonly CanvasReference[]
  private static referencesOfNode(node: unknown): readonly CanvasReference[]
}

export type CanvasReference =
  | { readonly kind: "file-node"; readonly filePath: string }
  | { readonly kind: "text-node-link"; readonly linkText: string };
```

`referencesOfNode` logic (this is exactly where markdown-style-link
harvesting would need to slot in, alongside the existing `Wikilinks.linkTargetsOf` call):
```ts
if (type === "file") {
  return typeof file === "string" && file.length > 0 ? [{ kind: "file-node", filePath: file }] : [];
}
if (type === "text" && typeof text === "string") {
  return Wikilinks.linkTargetsOf(text).map((linkText) => ({ kind: "text-node-link", linkText }) as const);
}
return [];
```
Node kinds handled: `file` (yields exactly one reference if `file` is a
non-empty string), `text` (yields zero-or-many `text-node-link`s), everything
else (`link`, `group`, garbage) yields nothing.

Test file `CanvasFallbackParser.test.ts` uses fixtures under
`src/adapters/testFixtures/` (`board.canvas`, `malformed.canvas`), read via
`readFileSync` + `import.meta.url` path resolution. Test groups:
"CanvasFallbackParser on a valid canvas", "...on malformed content" (never
throws, console.error called once), "...on degenerate shapes" (non-object
root, `nodes` not array, non-string `file`/`text` fields dropped per-node,
no-wikilink text node contributes nothing).

`board.canvas` fixture (verbatim):
```json
{
  "nodes": [
    { "id": "n1", "type": "file", "file": "notes/alpha.md", "x": 0, "y": 0, "width": 400, "height": 400 },
    { "id": "n2", "type": "text", "text": "A wikilink to [[beta]] and an embed of ![[images/pic.png]]", "x": 500, "y": 0, "width": 250, "height": 60 },
    { "id": "n3", "type": "file", "file": "images/pic.png", "x": 0, "y": 500, "width": 400, "height": 400 },
    { "id": "n4", "type": "link", "url": "https://example.com", "x": 500, "y": 500, "width": 250, "height": 60 },
    { "id": "n5", "type": "group", "x": -100, "y": -100, "width": 1000, "height": 1200, "label": "group" },
    { "id": "n6", "type": "file", "file": "notes/alpha.md", "x": 900, "y": 0, "width": 400, "height": 400 }
  ],
  "edges": [ { "id": "e1", "fromNode": "n1", "fromSide": "right", "toNode": "n3", "toSide": "left" } ]
}
```
`malformed.canvas` fixture is deliberately truncated JSON (`{ "nodes": [ { "id": "n1", "type": "file", "file": "notes/alpha.md" }` — no closing brackets).

Note there is NO existing fixture with a markdown-style `[label](note.md)`
link inside a text node — one would likely be needed (either a new fixture
file, or inline JSON strings as several existing tests already do inline
JSON via `JSON.stringify`).

## 3. `src/adapters/ObsidianLinkProvider.ts` + test

Two regimes, decided PER CANVAS (never per install) in `ObsidianLinkProvider.create`:
```ts
static async create(vault, metadataCache, canvasParseCache): Promise<ObsidianLinkProvider> {
  for (const file of vault.getFiles()) {
    if (file.extension !== "canvas") continue;
    if (CanvasCapabilityDetector.detectFor(metadataCache.resolvedLinks, file.path) === "core-indexed") {
      continue; // Core serves this one; parsing it too would double-report.
    }
    const references = await canvasParseCache.referencesOf(vault, file);
    const targets = resolvedCanvasTargetsOf(vault, metadataCache, file.path, references);
    canvasOutgoing.set(file.path, targets);
    ...
  }
  ...
}
```
- `core-indexed`: canvas's own key is present in `metadataCache.resolvedLinks`
  (even if `{}`) → outgoing/incoming/link-count all read straight from
  `resolvedLinks` / backlinks API, exactly like a markdown file. The fallback
  parser NEVER runs for that canvas (`continue`).
- `fallback-required`: canvas absent from `resolvedLinks` → `CanvasParseCache.referencesOf`
  reads+parses the canvas JSON (mtime-cached), then `resolvedCanvasTargetsOf`
  resolves each `CanvasReference` to a vault path and the provider serves that
  canvas's outgoing/incoming/count entirely from the two maps
  `canvasOutgoingByPath` / `canvasIncomingByPath` built at `create()` time.

`resolvedCanvasTargetsOf` — the resolution seam (doc comment explains it is
here, not in the parser, because file-node paths and text-node link-text
resolve through DIFFERENT Obsidian facilities):
```ts
function resolvedCanvasTargetsOf(vault, metadataCache, canvasPath, references) {
  const targets: string[] = [];
  for (const reference of references) {
    const target =
      reference.kind === "file-node"
        ? vault.getFileByPath(reference.filePath)?.path
        : metadataCache.getFirstLinkpathDest(reference.linkText, canvasPath)?.path;
    if (target !== undefined) targets.push(target);
  }
  return targets;
}
```
This is the exact spot that would need a third `CanvasReference` kind (or
reuse of `text-node-link`) for markdown-style link targets, since they also
resolve via `getFirstLinkpathDest(linkText, canvasPath)` — SAME resolution
call as wikilinks, just a different harvesting regex upstream in
`Wikilinks`/`CanvasFallbackParser`. Markdown-style link targets, however, are
NOT "link text" in Obsidian's shortest-path sense — a `[a](note.md)` inline
link's parenthetical part is a literal (percent-encoded) vault-relative path,
NOT a linkpath subject to `getFirstLinkpathDest` resolution the way `[[note]]`
is. This is a design question the implementer must resolve — see §8 below for
what "the same regime" actually means for this syntax.

Test setup for the two regimes (`ObsidianLinkProvider.test.ts`):
- Helper `providerOver(spec: FakeObsidianSpec)` builds `FakeObsidianPorts` and calls `ObsidianLinkProvider.create(ports.vault, ports.metadataCache, new CanvasParseCache())`.
- Regime is selected purely by whether `spec.resolvedLinks` has a key for the canvas path: present (even `{}`) ⇒ `core-indexed`; absent ⇒ `fallback-required`.
- `describe("ObsidianLinkProvider canvas TEXT-node wikilinks (both regimes must agree)")` is the PARITY-test pattern to imitate: same canvas content, two specs (one with the canvas key in `resolvedLinks` seeded with the expected resolved targets, one without it so the fallback parser runs), asserting identical `getOutgoingLinks` results.
- `describe("ObsidianLinkProvider canvas TEXT-node link reconciliation (fallback regime)")` is the reconciliation-case pattern (dangling link → no edge, embed → edge, alias+subpath → resolves, file+text pointing at same note → deduped edge but count via `getLinkCount` distinguishes repeats, resolution is RELATIVE TO THE CANVAS via `resolutionsFrom`, text node linking another canvas → edge to `.canvas` path too).
- BDD naming convention throughout: `it("WHEN <condition> THEN <expected behavior>", ...)`.

`FakeObsidianPorts.ts` (`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/adapters/FakeObsidianPorts.ts`):
```ts
export interface FakeObsidianFileSpec { path; mtime?; size?; content?; }
export interface FakeObsidianSpec {
  files: readonly FakeObsidianFileSpec[];
  fileCaches?: Record<string, CachedMetadataPort>;
  resolvedLinks?: Record<string, Record<string, number>>;   // verbatim resolvedLinks
  resolutions?: Record<string, string>;                      // link text -> target path (getFirstLinkpathDest)
  resolutionsFrom?: Record<string, Record<string, string>>;  // SOURCE path -> (link text -> target path), consulted before `resolutions`
  backlinks?: Record<string, readonly string[]>;             // omit to fake install w/o getBacklinksForFile
}
export class FakeObsidianPorts {
  readonly vault: VaultPort;
  readonly metadataCache: MetadataCachePort;
  constructor(spec: FakeObsidianSpec) { ... }
}
```
No `obsidian` import needed — pure structural fakes over `VaultPort` /
`MetadataCachePort` (see `src/adapters/obsidianPorts.ts` for those port
interfaces). `getFirstLinkpathDest` fake resolution logic: `resolutionsFrom[sourcePath][linkpath] ?? resolutions[linkpath]`, `null` if neither has an entry — i.e. dangling by default, only resolves what the fixture explicitly wires up.

Fixtures directory: `src/adapters/testFixtures/` — currently only
`board.canvas` and `malformed.canvas` (used by `CanvasFallbackParser.test.ts`
only; `ObsidianLinkProvider.test.ts` builds canvas content INLINE as JSON
strings via `FakeObsidianFileSpec.content`, not via the fixture files).

## 4. `CanvasCapability.ts` / `CanvasParseCache.ts`

`CanvasCapability.ts` (`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/adapters/CanvasCapability.ts`):
```ts
export type CanvasCapability = "core-indexed" | "fallback-required";
export class CanvasCapabilityDetector {
  static detectFor(resolvedLinks: Readonly<Record<string, unknown>>, canvasPath: string): CanvasCapability {
    return resolvedLinks[canvasPath] === undefined ? "fallback-required" : "core-indexed";
  }
}
```
Test is PRESENCE of the canvas's own key in `resolvedLinks`, not its
contents — an indexed-but-link-free canvas legitimately appears as `{}`.
Decided per canvas because Obsidian indexes canvases one file at a time and a
canvas the boot sweep missed can stay unindexed indefinitely (measured 4/8
launches in the e2e harness).

`CanvasParseCache.ts` — mtime-keyed cache wrapping `CanvasFallbackParser.parseReferences`:
```ts
export class CanvasParseCache {
  async referencesOf(vault: VaultPort, canvasFile: VaultFilePort): Promise<readonly CanvasReference[]>
  evict(path: string): void
}
```
Caches PARSING only (read + JSON + wikilink scan), never RESOLUTION — a
reference's resolved target can change when OTHER files rename without
touching this canvas's mtime, so `resolvedCanvasTargetsOf` in
`ObsidianLinkProvider` always re-resolves fresh. Relevant to this ticket only
in that any new markdown-style-link harvesting added to
`CanvasFallbackParser`/`Wikilinks` automatically rides this same cache for
free — no separate caching work needed.

## 5. `src/shared/VaultPathFacts.ts` and `src/shared/FileKinds.ts`

`VaultPathFacts.ts` — pure path-string helpers, importable from `src/shared/`
(import-guarded: nothing in `src/shared/` may import `obsidian`/`obsidian-id-lib`/react,
per its own header doc):
```ts
export class VaultPathFacts {
  static extensionOf(path: string): string      // lower-cased, no dot, "" if none
  static folderOf(path: string): string          // "" for vault root
  static folderNameOf(folderPath: string): string
  static titleOf(path: string): string            // basename minus extension
  static basenameOf(path: string): string         // basename incl. extension
}
```
No URL-decoding helper exists here — a markdown-style link target
`[a](my%20note.md)` would need `decodeURIComponent` (or equivalent) applied
somewhere before path comparison/resolution; nothing in the repo currently
does this (see §8).

`FileKinds.ts` — pure classification built on `VaultPathFacts`:
```ts
const NODE_BEARING_EXTENSIONS = new Set(["md", "canvas"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);
const MARKDOWN_EXTENSION = "md";
const EXCALIDRAW_SUFFIX = ".excalidraw.md";

export class FileKinds {
  static isNodeBearingPath(path: string): boolean
  static isImagePath(path: string): boolean
  static isMarkdownPath(path: string): boolean
  static isOutlineBearingPath(path: string): boolean   // markdown minus excalidraw
}
```

## 6. `docs-internal/plan/high-level-plan.md` — "### Canvas support" (verbatim)

```
### Canvas support

- Canvases are first-class docs: they can be nodes, centrals, and pinned.
- **We prefer not to own canvas parsing.** Adaptive strategy, decided **per canvas** at build time: if `resolvedLinks` holds that canvas's own key, its edges flow through the same code path as markdown and our parser never runs for it; otherwise the fallback parses that canvas's JSON. Per canvas and not per install because Obsidian indexes canvases one file at a time and can leave one indefinitely unindexed — a vault-wide verdict would leave every canvas on the wrong side of a partial index with NO link source at all. Presence of the key is the test, since an indexed but link-free canvas appears as `{}`.
- **Settled canvas edge semantics (ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`), binding on BOTH paths:** a canvas links whatever its FILE nodes reference AND whatever the wikilinks (`[[note]]`, `![[note]]`) inside its TEXT nodes reference. Text-node link text resolves exactly like a markdown body link (`getFirstLinkpathDest`, relative to the canvas), so aliases and `#subpaths` resolve to the document and dangling links produce no edge. External `link` nodes and `group` nodes reference no document.
- **Why both paths must agree, not merely both exist:** `resolvedLinks` fills asynchronously at vault boot, so which regime a rebuild lands in is a race we do not control. That race is only harmless while the two regimes report the same edge set — a divergence turns into "the graph depends on how fast you opened it". Known residual divergence: markdown-style `[a](b.md)` links and `[[links]]` inside code spans within text nodes (ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`). Edge ORDER is not contractual on either path.
- The fallback's text-node scan rides the existing mtime-keyed `CanvasParseCache`, so it costs nothing per rebuild; only link RESOLUTION re-runs, because a rename changes a target without touching the canvas's mtime.
- The user's install shows canvas backlinks in the backlinks pane; plugin-ecosystem evidence suggests stock Obsidian historically did not index canvases, so this may be core now or plugin-provided. Verify in devtools, but the adaptive design is correct on every install either way.
- The fallback path is a known stale-data risk and gets dedicated test coverage, including fixtures with canvas entries deliberately absent to exercise detection.
```
This paragraph is THE canonical statement of the residual gap this ticket
closes (markdown-style `[a](b.md)` links), and explicitly leaves the
code-span/fence gap as a SEPARATE, still-open concern (same ticket ID cited
for both, but the Acceptance Criteria in the ticket file only cover the
markdown-style-link half — see §0 ticket excerpt below).

Also relevant, from "### Testing":
> Fixture suite includes canvas JSON files for the fallback parser and
> provider variants without canvas entries. Because the regime is chosen by a
> boot race, canvas coverage is written as PARITY tests: the same canvas is
> asserted through both paths, which must AGREE on the edge set.

## 7. Existing markdown-inline-link (`[a](b.md)`) parsing in `src/`?

None. Grepped the whole `src/` tree for `](`-style patterns outside test
files/URLs — no hits. `Wikilinks.ts`'s explicit non-match test
(`"plain text with [a](b.md) only"` → `[]`) is the only place this syntax is
even acknowledged in code, and it is acknowledged as NOT handled. There is no
existing markdown-link regex, no CommonMark/remark dependency in play here
(the "not a markdown parser" framing in `Wikilinks.ts`'s header suggests the
intended approach is another small honest regex, matching the existing
project style — NOT pulling in a real markdown parser).

## 8. Link target → vault path resolution: how it works today

Two distinct resolution mechanisms exist, and any new markdown-style-link
handling must decide which one it uses (this is the crux of the
implementation decision, flagged for the implementer):

1. **File-node paths** (`CanvasReference.kind === "file-node"`): the `file`
   field of a canvas JSON file-node is ALREADY a literal vault path written
   by Obsidian itself (exact-match lookup): `vault.getFileByPath(reference.filePath)?.path`.
2. **Wikilink text** (`CanvasReference.kind === "text-node-link"`, and
   markdown-body links generally): resolved via
   `metadataCache.getFirstLinkpathDest(linkpath, sourcePath)` — Obsidian's
   "shortest-path" linkpath resolution, RELATIVE TO the file the link was
   written in (proven by the `resolutionsFrom` fixture mechanism and its
   dedicated test "WHEN a text-node link is resolved THEN it is resolved
   relative to the CANVAS itself"). This is the ONLY resolver seam in the
   codebase — there is no separate "resolver port"; `getFirstLinkpathDest` on
   `MetadataCachePort` (`src/adapters/obsidianPorts.ts`) IS the seam:
   ```ts
   export interface MetadataCachePort {
     readonly resolvedLinks: Record<string, Record<string, number>>;
     getFileCache(file: VaultFilePort): CachedMetadataPort | null;
     getFirstLinkpathDest(linkpath: string, sourcePath: string): VaultFilePort | null;
   }
   ```

For a markdown-style inline link `[label](note.md)`, Obsidian's OWN core
behavior (what `resolvedLinks` already reflects in the `core-indexed` regime,
per the ticket) is to treat the parenthetical as a vault-relative
(percent-encoded) PATH, not as `getFirstLinkpathDest`-style shortest-path link
text — though Obsidian's actual internal handling for such inline links in
canvas text nodes is exactly what the fallback parser must MATCH, not what is
theoretically "more correct". Concretely this means the implementer should
decide, likely by consulting Obsidian's real behavior or by testing against
`resolvedLinks` output in the e2e harness (`.ai_out/canvas-link-regime-unify/EXPLORATION_E2E_PUBLIC.md`
documents how the e2e devtools verification was done previously — worth
reading for methodology), whether markdown-style link targets should:
  (a) resolve via `getFirstLinkpathDest(target, canvasPath)` same as
      wikilinks (treating the target as linktext), or
  (b) be decoded (`decodeURIComponent` for `%20` etc.) and treated as a
      vault-relative path resolved via `vault.getFileByPath`, with external
      URLs (`https://`, `http://`, or any scheme-having target) rejected
      outright (no edge).
The Acceptance Criteria explicitly require: encoded targets (`%20`) resolve,
and external URLs produce no edge — which strongly implies path (b), since
`getFirstLinkpathDest` is Obsidian's OWN internal API and its behavior on a
percent-encoded string is unspecified/untested in this codebase, whereas
literal-path + decode + external-URL-rejection is exactly what a hand-rolled
"the same shape core's own indexer used" parser needs to do by hand.

No `.md` extension is implicit in Obsidian's inline links the way it is for
wikilinks (`[[note]]` implies `.md`) — inline markdown links carry an
EXPLICIT extension in the parenthetical (`(note.md)`, `(pic.png)`), which
simplifies the "is this really a vault link vs external URL" decision:
anything with a URL scheme prefix (`scheme://`) should be rejected; anything
else is a same-vault relative/absolute path.

## Summary of exactly where new code would slot in

- `src/shared/Wikilinks.ts`: header doc's "DELIBERATELY NOT HANDLED" line
  would need updating/removing once this is closed; likely a new static
  method (e.g. `Wikilinks.markdownLinkTargetsOf` or a rename to a more
  general `LinkSyntax` class) needs to be added, OR a sibling parser file
  (`src/shared/MarkdownInlineLinks.ts`?) mirroring `Wikilinks.ts`'s shape
  (pure regex, `src/shared/` purity contract, `globalPattern()`-style helper
  to avoid `lastIndex` leakage, one method returning target strings in
  written order with dupes kept).
- `src/adapters/CanvasFallbackParser.ts`: `referencesOfNode`'s `type === "text"`
  branch would need to ALSO harvest markdown-style link targets, tagged
  appropriately in `CanvasReference` (a new `kind`, e.g. `"text-node-md-link"`,
  OR folded into `text-node-link` IF resolution path (a) above is chosen — but
  a new kind is likely needed if resolution differs, per the "the tag is the
  whole point" doctrine in the file's own header comment).
- `src/adapters/ObsidianLinkProvider.ts`: `resolvedCanvasTargetsOf` would need
  a branch for the new `CanvasReference` kind, choosing resolver (a) or (b)
  from §8, plus decode + external-URL-rejection logic if (b).
- Tests: new fixture(s) under `src/adapters/testFixtures/` and/or inline JSON
  in `CanvasFallbackParser.test.ts`; new PARITY-style `describe` block in
  `ObsidianLinkProvider.test.ts` (pattern: `"...both regimes must agree"`)
  plus a reconciliation-style block (pattern: `"...reconciliation (fallback regime)"`)
  covering encoded targets and external-URL rejection per the Acceptance
  Criteria.
