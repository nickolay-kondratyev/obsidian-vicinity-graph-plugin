# EXPLORATION private notes — canvas-link-regime-unify (code path)

Raw working notes backing EXPLORATION_PUBLIC.md. Full grep/file dumps kept
here so the implementation agent (or a future exploration pass) doesn't need
to re-run the same searches.

## Files read in full this pass
- src/adapters/ObsidianLinkProvider.ts (337 lines)
- src/adapters/CanvasCapability.ts (29 lines)
- src/adapters/CanvasCapability.test.ts (21 lines)
- src/adapters/CanvasFallbackParser.ts (57 lines)
- src/adapters/CanvasFallbackParser.test.ts (66 lines)
- src/adapters/CanvasParseCache.ts (33 lines)
- src/adapters/VicinityGraphBuilder.ts (91 lines)
- src/adapters/obsidianPorts.ts (84 lines)
- src/adapters/FakeObsidianPorts.ts (99 lines)
- src/adapters/ReferenceOrder.ts (49 lines)
- src/adapters/BacklinksAdapter.ts (49 lines)
- src/view/outlineEntryLabel.ts (53 lines)
- src/adapters/testFixtures/board.canvas (14 lines)
- docs-internal/plan/high-level-plan.md (excerpts: L83-88, L125-140)
- _tickets/canvas-link-regime-is-re-detected-per-rebuild-....md (86 lines, full)
- .ai_out/canvas-link-regime-unify/canvas-link-regime-unify/TOP_LEVEL_AGENT.md (full)
- docs-internal/tickets/ticket-step-03-human-smoke-run.md (excerpt L5-22)
- ObsidianLinkProvider.test.ts L1-227 partial (full describe/it name grep + L92-175 body)

Not read this pass (out of scope for code-path agent, likely covered by the
e2e/doc-surface sibling agent): e2e/edgeRoutingEval.e2e.ts full body,
docs-internal/architecture-map.md beyond the top ~60 lines, main.ts wiring of
CanvasParseCache/VicinityGraphBuilder lifetimes, CanvasParseCache.test.ts body
(only path found, not opened), engine/ files beyond grep hits.

## Grep: wikilink / `[[` occurrences across src/**/*.ts (non-test)
```
src/adapters/CanvasFallbackParser.ts:7:  V1 scope comment
src/adapters/ObsidianLinkProvider.ts:192: doc-comment mention of ![[missing.png]]
src/engine/GraphTruncator.ts:82: unrelated (Map literal syntax, false positive on [[)
src/engine/VicinityTraversal.ts:102: unrelated (Map literal syntax, false positive)
src/engine/types.ts:59: doc-comment example text
src/view/ObsidianNoteNavigator.ts:38: doc-comment mention of [[Note#Heading]]
src/view/outlineEntryLabel.ts:3,17,18,25,26,41: THE wikilink regex, see PUBLIC §6
src/view/edgeGeometry.ts:44,58: doc-comment self-references to a ticket name, unrelated
```
Conclusion: exactly one real wikilink-matching regex in the whole `src/` tree,
and it's in `view/` (unreachable from `adapters/` per layering).

## `MetadataCachePort` full definition (obsidianPorts.ts L69-74)
```ts
export interface MetadataCachePort {
	readonly resolvedLinks: Record<string, Record<string, number>>;
	getFileCache(file: VaultFilePort): CachedMetadataPort | null;
	getFirstLinkpathDest(linkpath: string, sourcePath: string): VaultFilePort | null;
}
```
No `getBacklinksForFile` here — that's accessed via an unsafe cast in
BacklinksAdapter.ts (structurally optional, checked at runtime). Nothing else
needed for text-node resolution; `getFirstLinkpathDest` is already present and
already used at ObsidianLinkProvider.ts:213.

## `ObsidianLinkProvider.resolveReference` (the exact call pattern to mirror)
```ts
// L211-214
private resolveReference(link: string, fromPath: string): string | undefined {
    return this.metadataCache.getFirstLinkpathDest(link, fromPath)?.path;
}
```
For canvas text nodes: `this.resolveReference(wikilinkTarget, canvasPath)`
would work verbatim if the extraction step lives in/near ObsidianLinkProvider,
OR if CanvasParseCache/CanvasFallbackParser gains a MetadataCachePort
dependency (design choice flagged in PUBLIC §"hard part" step 2a).

## CanvasFallbackParser current node-type handling (exhaustive)
- `type: "file"` → path from `.file` string field (filePathOfNode, L46-56)
- `type: "text"` → currently IGNORED entirely (no branch at all — falls
  through `filePathOfNode`'s `type !== "file"` guard at L52, returns null)
- `type: "link"` → ignored (same guard)
- `type: "group"` → ignored (same guard)
- malformed / non-object nodes → ignored (L48-50 guard)
Text node shape per board.canvas fixture: `{"id":"n2","type":"text","text":"A wikilink to [[beta]] is skipped in V1", ...}`
— the wikilink body lives in a `.text` string field, analogous to `.file` for
file nodes but requiring REGEX extraction (potentially multiple links per
node) rather than a single string read.

## board.canvas fixture (verbatim, src/adapters/testFixtures/board.canvas)
```json
{
	"nodes": [
		{ "id": "n1", "type": "file", "file": "notes/alpha.md", "x": 0, "y": 0, "width": 400, "height": 400 },
		{ "id": "n2", "type": "text", "text": "A wikilink to [[beta]] is skipped in V1", "x": 500, "y": 0, "width": 250, "height": 60 },
		{ "id": "n3", "type": "file", "file": "images/pic.png", "x": 0, "y": 500, "width": 400, "height": 400 },
		{ "id": "n4", "type": "link", "url": "https://example.com", "x": 500, "y": 500, "width": 250, "height": 60 },
		{ "id": "n5", "type": "group", "x": -100, "y": -100, "width": 1000, "height": 1200, "label": "group" },
		{ "id": "n6", "type": "file", "file": "notes/alpha.md", "x": 900, "y": 0, "width": 400, "height": 400 }
	],
	"edges": [...]
}
```
NOTE: this fixture's own doc-comment in CanvasFallbackParser.test.ts (L17-18)
says "WHEN a text node contains a wikilink THEN it is skipped (V1 scope)" and
its own text literally says "is skipped in V1" — BOTH the fixture prose and
the test assertion (L28-31, `expect(paths).not.toContain("beta")`) need to
flip once text-node scanning ships. There's no fixture file for a canvas with
an alias/subpath wikilink (`[[beta|Alias]]`, `[[beta#Heading]]`) or multiple
wikilinks in one text node, or `![[embed]]` in a text node — implementation
should add such fixtures/cases.

## ObsidianLinkProvider.test.ts — canvas TEXT-node characterization tests (verbatim, L140-173)
```ts
/**
 * CHARACTERIZATION, not endorsement: the two canvas regimes do NOT agree, and which one
 * a rebuild lands in is decided per build from a racing `metadataCache.resolvedLinks`
 * (`ObsidianLinkProvider.create` → `CanvasCapabilityDetector`). These two tests pin the
 * exact difference — a wikilink inside a canvas TEXT node — so it is visible in `npm test`
 * instead of only as an e2e flake. WHICH behaviour is correct is a product decision,
 * tracked in ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`; neither test asserts a preference.
 */
describe("ObsidianLinkProvider canvas TEXT-node wikilinks (the two regimes disagree)", () => {
	const files = [
		{ path: "note-a.md" },
		{ path: "note-b.md" },
		{
			path: "board.canvas",
			content:
				'{"nodes": [{"type": "file", "file": "note-a.md"}, {"type": "text", "text": "see [[note-b]]"}]}',
		},
	];

	it("WHEN the canvas is NOT core-indexed THEN the text-node wikilink produces no edge (fallback V1 scope)", async () => {
		const provider = await providerOver({ files, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md"]);
	});

	it("WHEN the canvas IS core-indexed THEN the text-node wikilink produces an edge (core reports it)", async () => {
		const provider = await providerOver({
			files,
			resolvedLinks: { "board.canvas": { "note-a.md": 1, "note-b.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md", "note-b.md"]);
	});
});
```
Implementation must update the FIRST test's expectation to include `"note-b.md"`
(exact array shape/order TBD by the implementer's chosen ordering scheme — see
PUBLIC §7) and should probably rename the `describe` block (it currently says
"the two regimes disagree" — post-fix they agree) and/or fold it back into the
main `"ObsidianLinkProvider canvas handling"` describe block. The doc-comment
citing "CHARACTERIZATION, not endorsement" is now obsolete language.

## Full describe/it list for ObsidianLinkProvider.test.ts (all sections, for orientation)
(see PUBLIC file — reproduced via grep, not re-pasted here to avoid duplication;
grep command used: `grep -n "it(\"WHEN\|describe(\"" src/adapters/ObsidianLinkProvider.test.ts`)

## `FakeObsidianSpec` shape (obsidianPorts test double, full)
```ts
export interface FakeObsidianSpec {
	readonly files: readonly FakeObsidianFileSpec[];
	readonly fileCaches?: Readonly<Record<string, CachedMetadataPort>>;
	readonly resolvedLinks?: Readonly<Record<string, Readonly<Record<string, number>>>>;
	readonly resolutions?: Readonly<Record<string, string>>;   // <-- backs getFirstLinkpathDest
	readonly backlinks?: Readonly<Record<string, readonly string[]>>;
}
```
`resolutions` (link text → target path) is exactly what a new text-node test
would populate for a resolving case; unresolved cases just omit the key
(mirrors existing "unresolvable reference" tests elsewhere in the suite, e.g.
L44-47 "WHEN a link text does not resolve THEN it is dropped").

## Ticket acceptance criteria (verbatim, from _tickets/...md L76-84)
```
- The canvas link regime no longer varies between sessions for the same vault (repeat the 5x e2e measurement above and get one capability / one edge count).
- The chosen text-node-wikilink semantics are recorded in `docs-internal/plan/high-level-plan.md` and covered by an adapter test in `src/adapters/ObsidianLinkProvider.test.ts` for BOTH regimes.
- `src/adapters/CanvasFallbackParser.ts` header no longer describes a V1 skip that contradicts the shipped behaviour.
- The e2e eval row is re-baselined and its now-vestigial workaround removed: with the regime pinned in the
  plugin, `ensureCanvasFixtureIsIndexed()` in `e2e/edgeRoutingEval.e2e.ts` exists only to force
  `core-indexed`, so delete it and update the expected `[eval] force/sparse` edge count (11 today under
  `core-indexed`; 10 if the decision is that text-node wikilinks produce no edge).
```
Last bullet: since the human decision IS "text-node wikilinks produce edges",
expected count is 11 (matching what core-indexed already produces) — this is
squarely the e2e/doc-surface sibling agent's territory but noted here for
cross-check since it directly validates the code-path fix.

## Open questions for the implementation agent (not resolved by this exploration)
1. Does core-indexed Obsidian resolve `![[embed]]` syntax (not just `[[link]]`)
   inside canvas text nodes as an outgoing link? Not verified against a real
   install in this pass (`ticket-step-03-human-smoke-run.md` observation only
   covered file-node canvases). If yes, the extraction regex needs `!?\[\[...\]\]`
   like `outlineEntryLabel.ts`'s `WIKILINK` regex already does (L26:
   `/!?\[\[([^\]]+)\]\]/g`).
2. Does core-indexed Obsidian resolve wikilinks inside canvas node/edge
   `label` fields, or only `type: "text"` node `.text` bodies? Not
   investigated (no fixture/test covers labels).
3. Ordering scheme for unified canvas outgoing links: no existing contract to
   preserve beyond "file nodes in node-array order" (asserted by
   CanvasFallbackParser.test.ts L20-26) — pick single-pass encounter order
   across mixed node types unless a reason emerges to do otherwise.
4. Where resolution should live (ObsidianLinkProvider vs. threading
   MetadataCachePort into CanvasParseCache/CanvasFallbackParser) — recommended
   default is keeping resolution in ObsidianLinkProvider (see PUBLIC "hard
   part" step 2a) but not conclusively mandated; worth a quick design note in
   the implementation plan doc.
