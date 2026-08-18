import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { CanvasParseCache } from "./CanvasParseCache";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import { FolderNoteIndex } from "./FolderNoteIndex";
import { FrontmatterIdIndex } from "./FrontmatterIdIndex";
import { NamedRelationshipsIndex } from "./NamedRelationshipsIndex";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";
import type { HeadingPort, ReferencePort } from "./obsidianPorts";

function ref(link: string, offset: number): ReferencePort {
	return { link, position: { start: { offset } } };
}

function heading(text: string, level: number, offset: number): HeadingPort {
	return { heading: text, level, position: { start: { offset } } };
}

async function providerOver(spec: FakeObsidianSpec): Promise<ObsidianLinkProvider> {
	const ports = new FakeObsidianPorts(spec);
	const idIndex = new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => spec.idRefFields ?? "");
	const folderNoteIndex = new FolderNoteIndex(ports.vault);
	return ObsidianLinkProvider.create(
		ports.vault,
		ports.metadataCache,
		new CanvasParseCache(),
		idIndex,
		folderNoteIndex,
		new NamedRelationshipsIndex(ports.vault, ports.metadataCache),
	);
}

const CANVAS_JSON = '{"nodes": [{"type": "file", "file": "note-a.md"}, {"type": "file", "file": "pic.png"}]}';

describe("ObsidianLinkProvider outgoing links (markdown)", () => {
	// GIVEN a note whose cache lists an embed BEFORE a link by offset, plus a
	// frontmatter link and an unresolvable link text.
	const spec: FakeObsidianSpec = {
		files: [{ path: "source.md" }, { path: "target.md" }, { path: "pic.png" }, { path: "prop.md" }],
		fileCaches: {
			"source.md": {
				links: [ref("target", 40), ref("ghost", 50), ref("target", 60)],
				embeds: [ref("pic.png", 20)],
				frontmatterLinks: [{ link: "prop", key: "up" }],
			},
		},
		resolutions: { target: "target.md", "pic.png": "pic.png", prop: "prop.md" },
	};

	it("WHEN the cache has ordered references THEN targets come back in reference order", async () => {
		const provider = await providerOver(spec);
		expect(provider.getOutgoingLinks(asVaultPath("source.md"))).toEqual(["prop.md", "pic.png", "target.md"]);
	});

	it("WHEN a link text does not resolve THEN it is dropped (only resolved targets surface)", async () => {
		const provider = await providerOver(spec);
		expect(provider.getOutgoingLinks(asVaultPath("source.md"))).not.toContain("ghost");
	});

	it("WHEN the file has no cache entry THEN resolvedLinks keys are the fallback", async () => {
		const provider = await providerOver({
			files: [{ path: "uncached.md" }, { path: "t.md" }],
			resolvedLinks: { "uncached.md": { "t.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("uncached.md"))).toEqual(["t.md"]);
	});

	it("WHEN the path is unknown to the vault THEN there are no outgoing links", async () => {
		const provider = await providerOver({ files: [] });
		expect(provider.getOutgoingLinks(asVaultPath("missing.md"))).toEqual([]);
	});
});

describe("ObsidianLinkProvider incoming links", () => {
	it("WHEN getBacklinksForFile is available THEN it answers incoming queries", async () => {
		const provider = await providerOver({
			files: [{ path: "target.md" }, { path: "linker.md" }],
			backlinks: { "target.md": ["linker.md"] },
		});
		expect(provider.getIncomingLinks(asVaultPath("target.md"))).toEqual(["linker.md"]);
	});

	it("WHEN a nonexistent path is queried first THEN the API still answers later queries (no accidental inversion flip)", async () => {
		// GIVEN resolvedLinks empty on purpose: an inversion would answer [] here,
		// so a non-empty result proves the API is still the serving mode.
		const provider = await providerOver({
			files: [{ path: "target.md" }, { path: "linker.md" }],
			backlinks: { "target.md": ["linker.md"] },
		});
		provider.getIncomingLinks(asVaultPath("ghost.md"));
		expect(provider.getIncomingLinks(asVaultPath("target.md"))).toEqual(["linker.md"]);
	});

	it("WHEN the API is absent THEN inverting resolvedLinks answers incoming queries", async () => {
		const provider = await providerOver({
			files: [{ path: "target.md" }, { path: "linker.md" }],
			resolvedLinks: { "linker.md": { "target.md": 2 } },
		});
		expect(provider.getIncomingLinks(asVaultPath("target.md"))).toEqual(["linker.md"]);
	});
});

describe("ObsidianLinkProvider canvas handling", () => {
	// GIVEN an install WITHOUT .canvas keys in resolvedLinks (the target
	// install, CLARIFICATION Q2) and a canvas referencing a note, an image and
	// a missing file.
	const fallbackSpec: FakeObsidianSpec = {
		files: [
			{ path: "note-a.md" },
			{ path: "pic.png" },
			{
				path: "board.canvas",
				content:
					'{"nodes": [{"type": "file", "file": "note-a.md"}, {"type": "file", "file": "pic.png"}, {"type": "file", "file": "gone.md"}]}',
			},
		],
		resolvedLinks: { "note-a.md": {} },
	};

	it("WHEN the vault holds a canvas THEN this provider parses it", async () => {
		expect((await providerOver(fallbackSpec)).parsedCanvasPaths).toEqual(["board.canvas"]);
	});

	it("WHEN a canvas is parsed THEN its outgoing links come from the parsed file nodes (resolved only)", async () => {
		const provider = await providerOver(fallbackSpec);
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md", "pic.png"]);
	});

	it("WHEN a canvas is parsed THEN a note's incoming links include the canvases referencing it", async () => {
		const provider = await providerOver(fallbackSpec);
		expect(provider.getIncomingLinks(asVaultPath("note-a.md"))).toEqual(["board.canvas"]);
	});

	it("WHEN a canvas is ALSO core-indexed THEN our parser still answers its outgoing links", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "board.canvas", content: CANVAS_JSON }],
			resolvedLinks: { "board.canvas": { "note-a.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md"]);
	});

	it("WHEN a canvas is ALSO core-indexed THEN its incoming links are not double-reported", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "board.canvas", content: CANVAS_JSON }],
			resolvedLinks: { "board.canvas": { "note-a.md": 1 } },
		});
		expect(provider.getIncomingLinks(asVaultPath("note-a.md"))).toEqual(["board.canvas"]);
	});
});

/**
 * ALWAYS-PARSE (option 3a of ticket `nid_fay1hu5sxcoygizopkkg0f0d7_e`). Obsidian indexes
 * canvases ONE FILE AT A TIME, and a canvas the boot sweep missed can stay unindexed
 * indefinitely (measured while building the e2e harness: indexed in 4 of 8 launches, never
 * later in the misses). So "does core index canvases?" has no vault-wide answer — and it has
 * no answer we ACT on either: we parse every canvas and never ask. That makes canvas edges
 * (and, decisively, their link KINDS — `resolvedLinks` merges links and embeds) independent
 * of boot timing, which is the permanent fix shape for the race in ticket
 * `nid_s676x55uojmtcwh9t4l9mc6zl_e`.
 *
 * REPLACES the former "canvas regime is decided PER CANVAS" suite, which pinned the deleted
 * behavior that a canvas present in `resolvedLinks` was served from it and NOT parsed —
 * including a case where core's empty index entry deliberately suppressed the parser's
 * answer. That behavior is gone by design; these cases pin what replaced it.
 */
describe("ObsidianLinkProvider parses EVERY canvas (resolvedLinks is never consulted for canvas links)", () => {
	// GIVEN a vault where core has indexed a.canvas but not b.canvas.
	const spec: FakeObsidianSpec = {
		files: [
			{ path: "note-a.md" },
			{ path: "note-b.md" },
			{ path: "a.canvas", content: '{"nodes": [{"type": "file", "file": "note-a.md"}]}' },
			{ path: "b.canvas", content: '{"nodes": [{"type": "file", "file": "note-b.md"}]}' },
		],
		resolvedLinks: { "a.canvas": { "note-a.md": 1 } },
	};

	it("WHEN a canvas is core-indexed THEN it is parsed all the same", async () => {
		expect((await providerOver(spec)).parsedCanvasPaths).toEqual(["a.canvas", "b.canvas"]);
	});

	it("WHEN a canvas is core-indexed THEN its links come from the parse", async () => {
		const provider = await providerOver(spec);
		expect(provider.getOutgoingLinks(asVaultPath("a.canvas"))).toEqual(["note-a.md"]);
	});

	it("WHEN a SIBLING canvas is not indexed yet THEN it is parsed too (no blank canvas)", async () => {
		const provider = await providerOver(spec);
		expect(provider.getOutgoingLinks(asVaultPath("b.canvas"))).toEqual(["note-b.md"]);
	});

	it("WHEN a canvas is core-indexed THEN the parse is the ONLY count reported (no double-reporting)", async () => {
		const provider = await providerOver(spec);
		expect(provider.getLinkCount(asVaultPath("a.canvas"), asVaultPath("note-a.md"))).toBe(1);
	});

	it("WHEN core's index entry for a canvas is EMPTY but the canvas has a file node THEN the parsed link wins", async () => {
		// The case that used to go the other way: an indexed-but-empty entry (`{}`) suppressed
		// the parser. Respecting it made the edge set depend on WHEN core got to the file, and
		// it left the reference with no reportable kind. Our parse is now the answer.
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "a.canvas", content: '{"nodes": [{"type": "file", "file": "note-a.md"}]}' }],
			resolvedLinks: { "a.canvas": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("a.canvas"))).toEqual(["note-a.md"]);
	});

	it("WHEN a canvas is not markdown-cached at all THEN it never falls back to resolvedLinks keys", async () => {
		// A canvas whose JSON names nothing must report nothing, even when resolvedLinks
		// claims an edge — otherwise the deleted regime leaks back in through the fallback.
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "a.canvas", content: "{}" }],
			resolvedLinks: { "a.canvas": { "note-a.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("a.canvas"))).toEqual([]);
	});
});

/**
 * SETTLED SEMANTICS (human decision on ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`): a wikilink
 * written inside a canvas TEXT node DOES produce a graph edge. Since we now parse every canvas,
 * our answer no longer DEPENDS on `resolvedLinks` — but it must still MATCH what core reports,
 * because that is the edge set users see elsewhere in Obsidian. Each pair below therefore asserts
 * the same answer with and without core's index entry present: the presence of the entry must
 * make no difference (it used to decide everything), and the answer must be core's answer.
 */
describe("ObsidianLinkProvider canvas TEXT-node wikilinks (must match what core reports)", () => {
	// GIVEN one canvas with a FILE node pointing at note-a and a TEXT node whose body
	// carries a `[[note-b]]` wikilink.
	const files = [
		{ path: "note-a.md" },
		{ path: "note-b.md" },
		{
			path: "board.canvas",
			content:
				'{"nodes": [{"type": "file", "file": "note-a.md"}, {"type": "text", "text": "see [[note-b]]"}]}',
		},
	];
	const resolutions = { "note-b.md": "note-b.md", "note-b": "note-b.md" };

	it("WHEN core has NOT indexed the canvas THEN the text-node wikilink produces an edge", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md", "note-b.md"]);
	});

	it("WHEN core HAS indexed the canvas THEN the text-node wikilink still produces the same edge", async () => {
		const provider = await providerOver({
			files,
			resolutions,
			resolvedLinks: { "board.canvas": { "note-a.md": 1, "note-b.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md", "note-b.md"]);
	});

	it("WHEN core has NOT indexed the canvas THEN the text-node target counts the canvas as a backlink", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getIncomingLinks(asVaultPath("note-b.md"))).toEqual(["board.canvas"]);
	});
});

/**
 * The reconciliation cases behind the settled semantics above: each pins one way our parse could
 * silently differ from what Obsidian's own indexer reports for the same canvas.
 */
describe("ObsidianLinkProvider canvas TEXT-node link reconciliation", () => {
	function canvasWith(text: string) {
		return {
			path: "board.canvas",
			content: JSON.stringify({ nodes: [{ type: "text", text }] }),
		};
	}

	it("WHEN a text-node wikilink resolves to nothing THEN it produces no edge", async () => {
		// Core only ever reports RESOLVED links in `resolvedLinks`; a dangling link must not
		// conjure an edge to a document that does not exist.
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, canvasWith("see [[ghost]]")],
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual([]);
	});

	it("WHEN a text node EMBEDS a note THEN the embed produces an edge like any other link", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "pic.png" }, canvasWith("![[pic.png]]")],
			resolutions: { "pic.png": "pic.png" },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["pic.png"]);
	});

	it("WHEN a text-node wikilink carries an alias and a subpath THEN it resolves to the document", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "note-b.md" }, canvasWith("see [[note-b#Section|Alias]]")],
			resolutions: { "note-b": "note-b.md" },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-b.md"]);
	});

	it("WHEN a file node and a text node point at the SAME note THEN the edge is reported once", async () => {
		const provider = await providerOver({
			files: [
				{ path: "note-b.md" },
				{
					path: "board.canvas",
					content: JSON.stringify({
						nodes: [
							{ type: "file", file: "note-b.md" },
							{ type: "text", text: "see [[note-b]]" },
						],
					}),
				},
			],
			resolutions: { "note-b": "note-b.md" },
			resolvedLinks: { "note-b.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-b.md"]);
	});

	it("WHEN a note is reached twice by one canvas THEN the link COUNT reports both occurrences", async () => {
		const provider = await providerOver({
			files: [{ path: "note-b.md" }, canvasWith("[[note-b]] and again [[note-b]]")],
			resolutions: { "note-b": "note-b.md" },
			resolvedLinks: { "note-b.md": {} },
		});
		expect(provider.getLinkCount(asVaultPath("board.canvas"), asVaultPath("note-b.md"))).toBe(2);
	});

	it("WHEN a text-node link is resolved THEN it is resolved relative to the CANVAS itself", async () => {
		// Obsidian resolves shortest-path link text against the file it was written in, so
		// passing any other source path would silently resolve links from the wrong place.
		// Only `board.canvas` as source resolves `note-b` here.
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "note-b.md" }, canvasWith("see [[note-b]]")],
			resolutionsFrom: { "board.canvas": { "note-b": "note-b.md" } },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-b.md"]);
	});

	it("WHEN a text node links another CANVAS THEN that edge is reported too", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "other.canvas", content: "{}" }, canvasWith("see [[other]]")],
			resolutions: { other: "other.canvas" },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["other.canvas"]);
	});
});

/**
 * Canvas text nodes are markdown, so core indexes the markdown-style inline links written
 * there just as it indexes wikilinks (ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`). Same guard as
 * the wikilink parity block above: our parse must report core's edge set, and core's index entry
 * must make no difference to it.
 */
describe("ObsidianLinkProvider canvas TEXT-node markdown-style links (must match what core reports)", () => {
	// GIVEN one canvas whose TEXT node carries a `[label](note-b.md)` inline link.
	const files = [
		{ path: "note-a.md" },
		{ path: "note-b.md" },
		{
			path: "board.canvas",
			content: JSON.stringify({ nodes: [{ type: "text", text: "see [label](note-b.md)" }] }),
		},
	];
	const resolutions = { "note-b.md": "note-b.md" };

	it("WHEN core has NOT indexed the canvas THEN the markdown-style link produces an edge", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-b.md"]);
	});

	it("WHEN core HAS indexed the canvas THEN the markdown-style link still produces the same edge", async () => {
		const provider = await providerOver({
			files,
			resolutions,
			resolvedLinks: { "board.canvas": { "note-b.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-b.md"]);
	});

	it("WHEN core has NOT indexed the canvas THEN the markdown-style target counts the canvas as a backlink", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getIncomingLinks(asVaultPath("note-b.md"))).toEqual(["board.canvas"]);
	});
});

/** The reconciliation cases specific to the markdown-style syntax's own rules. */
describe("ObsidianLinkProvider canvas TEXT-node markdown-style link reconciliation", () => {
	function canvasWith(text: string) {
		return {
			path: "board.canvas",
			content: JSON.stringify({ nodes: [{ type: "text", text }] }),
		};
	}

	it("WHEN a markdown-style destination is percent-encoded THEN it resolves to the note on disk", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "my note.md" }, canvasWith("[a](my%20note.md)")],
			resolutions: { "my note.md": "my note.md" },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["my note.md"]);
	});

	it("WHEN a markdown-style destination is an external URL THEN it produces no edge", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, canvasWith("[a](https://example.com)")],
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual([]);
	});

	it("WHEN a text node EMBEDS an image markdown-style THEN the embed produces an edge", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "pic.png" }, canvasWith("![alt](pic.png)")],
			resolutions: { "pic.png": "pic.png" },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["pic.png"]);
	});

	it("WHEN a wikilink and a markdown-style link name the SAME note THEN the link COUNT reports both", async () => {
		const provider = await providerOver({
			files: [{ path: "note-b.md" }, canvasWith("[[note-b]] and again [again](note-b.md)")],
			resolutions: { "note-b": "note-b.md", "note-b.md": "note-b.md" },
			resolvedLinks: { "note-b.md": {} },
		});
		expect(provider.getLinkCount(asVaultPath("board.canvas"), asVaultPath("note-b.md"))).toBe(2);
	});

	it("WHEN a markdown-style link is resolved THEN it is resolved relative to the CANVAS itself", async () => {
		// The SAME resolution seam wikilinks use — a destination is link text, not a
		// literal path, so relative and shortest-path targets behave identically.
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "sub/note-b.md" }, canvasWith("[a](note-b.md)")],
			resolutionsFrom: { "board.canvas": { "note-b.md": "sub/note-b.md" } },
			resolvedLinks: { "note-a.md": {} },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["sub/note-b.md"]);
	});
});

/**
 * A link written inside a code span or a fenced block is SAMPLE TEXT, and real Obsidian core
 * indexes none of it — measured, not assumed, by `e2e/canvasMarkdownLinkIndexing.e2e.ts`
 * (ticket `nid_869bt9d9rlrbr8of1403dnmf3_e`). Same parity guard as the blocks above: our parse
 * masks code regions so it reports the same empty edge set core does.
 */
describe("ObsidianLinkProvider canvas TEXT-node links inside CODE regions (must match what core reports)", () => {
	// GIVEN one canvas whose TEXT node's only links — one of each syntax — sit inside an
	// inline code span and a fenced block, with both targets present in the vault.
	const files = [
		{ path: "note-a.md" },
		{ path: "note-b.md" },
		{
			path: "board.canvas",
			content: JSON.stringify({
				nodes: [
					{
						type: "text",
						text: ["sample `[[note-a]]` and `[l](note-b.md)`", "```", "[[note-a]]", "```"].join("\n"),
					},
				],
			}),
		},
	];
	const resolutions = { "note-a": "note-a.md", "note-b.md": "note-b.md" };

	it("WHEN core has NOT indexed the canvas THEN a code-region link produces no edge", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual([]);
	});

	it("WHEN core HAS indexed the canvas THEN a code-region link still produces no edge (core reports none either)", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "board.canvas": {} } });
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual([]);
	});

	it("WHEN core has NOT indexed the canvas THEN a code-region target gains no backlink", async () => {
		const provider = await providerOver({ files, resolutions, resolvedLinks: { "note-a.md": {} } });
		expect(provider.getIncomingLinks(asVaultPath("note-b.md"))).toEqual([]);
	});
});

describe("ObsidianLinkProvider file metadata", () => {
	const spec: FakeObsidianSpec = {
		files: [
			{ path: "root.md", size: 123 },
			{ path: "folder/nested.md" },
			{ path: "folder/pic.png" },
			{ path: "doc.pdf" },
		],
		fileCaches: {
			"root.md": { links: [ref("doc.pdf", 10)], embeds: [ref("folder/pic.png", 5)] },
		},
		resolutions: { "doc.pdf": "doc.pdf", "folder/pic.png": "folder/pic.png" },
	};

	it("WHEN the file sits at the vault root THEN Obsidian's '/' parent maps to the engine's ''", async () => {
		const provider = await providerOver(spec);
		expect(provider.getFileMetadata(asVaultPath("root.md"))?.folder).toBe("");
	});

	it("WHEN the file sits in a folder THEN the folder path is reported as-is", async () => {
		const provider = await providerOver(spec);
		expect(provider.getFileMetadata(asVaultPath("folder/nested.md"))?.folder).toBe("folder");
	});

	it("WHEN asked for size THEN the vault stat size is reported", async () => {
		const provider = await providerOver(spec);
		expect(provider.getFileMetadata(asVaultPath("root.md"))?.sizeBytes).toBe(123);
	});

	it("WHEN the file is markdown THEN it is node-bearing; an image is not", async () => {
		const provider = await providerOver(spec);
		expect([
			provider.getFileMetadata(asVaultPath("root.md"))?.isNodeBearing,
			provider.getFileMetadata(asVaultPath("folder/pic.png"))?.isNodeBearing,
		]).toEqual([true, false]);
	});

	it("WHEN outgoing refs include non-node-bearing files THEN they surface as attachments in reference order", async () => {
		const provider = await providerOver(spec);
		expect(provider.getFileMetadata(asVaultPath("root.md"))?.attachments).toEqual([
			{ path: "folder/pic.png", isImage: true },
			{ path: "doc.pdf", isImage: false },
		]);
	});

	it("WHEN the path is unknown to the vault THEN metadata is undefined", async () => {
		const provider = await providerOver(spec);
		expect(provider.getFileMetadata(asVaultPath("nope.md"))).toBeUndefined();
	});
});

describe("ObsidianLinkProvider link counts (step-05, CLARIFICATION Q1)", () => {
	it("WHEN resolvedLinks reports 3 links for a pair THEN getLinkCount reports 3", async () => {
		const provider = await providerOver({
			files: [{ path: "source.md" }, { path: "target.md" }],
			resolvedLinks: { "source.md": { "target.md": 3 } },
		});
		expect(provider.getLinkCount(asVaultPath("source.md"), asVaultPath("target.md"))).toBe(3);
	});

	it("WHEN a pair has no resolved link THEN getLinkCount reports 0", async () => {
		const provider = await providerOver({
			files: [{ path: "source.md" }, { path: "target.md" }],
			resolvedLinks: {},
		});
		expect(provider.getLinkCount(asVaultPath("source.md"), asVaultPath("target.md"))).toBe(0);
	});

	it("WHEN a parsed canvas references the same note twice THEN getLinkCount reports 2", async () => {
		const provider = await providerOver({
			files: [
				{ path: "note-a.md" },
				{
					path: "board.canvas",
					content: '{"nodes": [{"type": "file", "file": "note-a.md"}, {"type": "file", "file": "note-a.md"}]}',
				},
			],
		});
		expect(provider.getLinkCount(asVaultPath("board.canvas"), asVaultPath("note-a.md"))).toBe(2);
	});

	it("WHEN a core-indexed canvas's own count DISAGREES with our parse THEN the parsed count is reported", async () => {
		// The declared behavior change of option 3a, pinned where it is user-visible (the
		// edge-count badge). Pre-3a this canvas was served by resolvedLinks and the badge
		// read 1; now the badge reads what the canvas actually says. Sourcing the count
		// from core while the edge SET comes from our parse would split one edge across
		// two authorities and re-expose the badge to the canvas-indexing boot race.
		const provider = await providerOver({
			files: [
				{ path: "note-a.md" },
				{
					path: "board.canvas",
					content: JSON.stringify({
						nodes: [
							{ type: "file", file: "note-a.md" },
							{ type: "text", text: "[[note-a]] and again [[note-a]]" },
						],
					}),
				},
			],
			resolutions: { "note-a": "note-a.md" },
			resolvedLinks: { "board.canvas": { "note-a.md": 1 } },
		});
		expect(provider.getLinkCount(asVaultPath("board.canvas"), asVaultPath("note-a.md"))).toBe(3);
	});
});

describe("ObsidianLinkProvider frontmatter display title (step-05 human decision)", () => {
	async function titleOf(frontmatter: Record<string, unknown> | undefined): Promise<string | undefined> {
		const provider = await providerOver({
			files: [{ path: "note.md" }],
			fileCaches: frontmatter === undefined ? {} : { "note.md": { frontmatter } },
		});
		return provider.getFileMetadata(asVaultPath("note.md"))?.frontmatterTitle;
	}

	it("WHEN frontmatter has a title THEN it becomes the frontmatter title", async () => {
		expect(await titleOf({ title: "My Title" })).toBe("My Title");
	});

	it("WHEN frontmatter has only a name THEN name becomes the frontmatter title", async () => {
		expect(await titleOf({ name: "My Name" })).toBe("My Name");
	});

	it("WHEN frontmatter has both title and name THEN title wins (precedence)", async () => {
		expect(await titleOf({ name: "My Name", title: "My Title" })).toBe("My Title");
	});

	it("WHEN the title is not a string THEN it is skipped in favor of name", async () => {
		expect(await titleOf({ title: 42, name: "My Name" })).toBe("My Name");
	});

	it("WHEN the title is a blank string THEN it is skipped in favor of name", async () => {
		expect(await titleOf({ title: "   ", name: "My Name" })).toBe("My Name");
	});

	it("WHEN the title has surrounding whitespace THEN it is trimmed", async () => {
		expect(await titleOf({ title: "  My Note  " })).toBe("My Note");
	});

	it("WHEN no title-bearing property exists THEN there is no frontmatter title", async () => {
		expect(await titleOf({ tags: ["x"] })).toBeUndefined();
	});

	it("WHEN the file has no cache entry THEN there is no frontmatter title", async () => {
		expect(await titleOf(undefined)).toBeUndefined();
	});

	it("WHEN the file is a canvas THEN there is no frontmatter title (markdown only)", async () => {
		const provider = await providerOver({ files: [{ path: "board.canvas" }] });
		expect(provider.getFileMetadata(asVaultPath("board.canvas"))?.frontmatterTitle).toBeUndefined();
	});
});

/**
 * The note outline offered as a node's in-node preview. The adapter owns
 * ELIGIBILITY only (markdown minus excalidraw, headings present) — never the
 * image-vs-outline choice, which the view makes from the separately reported
 * `imagePrecedesOutline` fact (see the describe below).
 */
describe("ObsidianLinkProvider note outline", () => {
	async function outlineOf(spec: FakeObsidianSpec, path: string) {
		const provider = await providerOver(spec);
		return provider.getFileMetadata(asVaultPath(path))?.outline;
	}

	// GIVEN a plain note with two headings and no references at all.
	const headingsOnly: FakeObsidianSpec = {
		files: [{ path: "note.md" }],
		fileCaches: { "note.md": { headings: [heading("Intro", 1, 10), heading("Background", 2, 40)] } },
	};

	it("WHEN a markdown file's cache carries headings THEN the outline lists their raw text in document order", async () => {
		expect((await outlineOf(headingsOnly, "note.md"))?.map((entry) => entry.rawText)).toEqual([
			"Intro",
			"Background",
		]);
	});

	it("WHEN a markdown file's cache carries headings THEN each entry carries the heading level", async () => {
		expect((await outlineOf(headingsOnly, "note.md"))?.map((entry) => entry.level)).toEqual([1, 2]);
	});

	it("WHEN a heading's source contains inline markdown THEN rawText preserves it verbatim (it is the link key)", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }],
				fileCaches: { "note.md": { headings: [heading("Status of [[note1]] **today**", 2, 0)] } },
			},
			"note.md",
		);
		expect(outline?.[0]?.rawText).toBe("Status of [[note1]] **today**");
	});

	it("WHEN the file is a canvas THEN the outline is empty (canvas has no headings)", async () => {
		expect(await outlineOf({ files: [{ path: "board.canvas" }] }, "board.canvas")).toEqual([]);
	});

	it("WHEN the file is an excalidraw drawing THEN the outline is empty (CLARIFICATION Q4)", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "draw/x.excalidraw.md" }],
				fileCaches: { "draw/x.excalidraw.md": { headings: [heading("Text Elements", 1, 0)] } },
			},
			"draw/x.excalidraw.md",
		);
		expect(outline).toEqual([]);
	});

	it("WHEN the file is an excalidraw drawing THEN it is STILL node-bearing (excluded from outline parsing only)", async () => {
		const provider = await providerOver({ files: [{ path: "draw/x.excalidraw.md" }] });
		expect(provider.getFileMetadata(asVaultPath("draw/x.excalidraw.md"))?.isNodeBearing).toBe(true);
	});

	it("WHEN the cache carries no headings key THEN the outline is empty", async () => {
		const outline = await outlineOf(
			{ files: [{ path: "note.md" }], fileCaches: { "note.md": { links: [ref("other", 5)] } } },
			"note.md",
		);
		expect(outline).toEqual([]);
	});

	it("WHEN the file has no cache entry at all THEN the outline is empty", async () => {
		expect(await outlineOf({ files: [{ path: "note.md" }] }, "note.md")).toEqual([]);
	});

	it("WHEN the note has headings and NO image THEN the outline carries the headings", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }, { path: "doc.pdf" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 10)], links: [ref("doc.pdf", 2)] },
				},
				resolutions: { "doc.pdf": "doc.pdf" },
			},
			"note.md",
		);
		expect(outline?.map((entry) => entry.rawText)).toEqual(["Intro"]);
	});

	it("WHEN the note's first image is embedded BEFORE the first heading THEN the outline STILL carries the headings", async () => {
		// The adapter no longer deletes the losing side: which region wins is the
		// engine's call (`nodePreviewKind`), driven by `imagePrecedesOutline`.
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 30)], embeds: [ref("pic.png", 5)] },
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(outline?.map((entry) => entry.rawText)).toEqual(["Intro"]);
	});

	it("WHEN the note's first image is embedded AFTER the first heading THEN the outline carries the headings", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 5)], embeds: [ref("pic.png", 30)] },
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(outline?.map((entry) => entry.rawText)).toEqual(["Intro"]);
	});

	it("WHEN the note's image is a FRONTMATTER link THEN the outline STILL carries the headings", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 0)], frontmatterLinks: [{ link: "pic.png", key: "cover" }] },
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(outline?.map((entry) => entry.rawText)).toEqual(["Intro"]);
	});

	it("WHEN the note has an image and no headings THEN the outline is empty", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: { "note.md": { embeds: [ref("pic.png", 5)] } },
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(outline).toEqual([]);
	});

	it("WHEN a NON-image attachment precedes the first heading but the first image follows it THEN the outline carries the headings", async () => {
		const outline = await outlineOf(
			{
				files: [{ path: "note.md" }, { path: "doc.pdf" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": {
						headings: [heading("Intro", 1, 20)],
						links: [ref("doc.pdf", 5)],
						embeds: [ref("pic.png", 50)],
					},
				},
				resolutions: { "doc.pdf": "doc.pdf", "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(outline?.map((entry) => entry.rawText)).toEqual(["Intro"]);
	});

	it("WHEN a file carries an outline THEN its attachments keep their exact reference order", async () => {
		// The outline refactor shares ONE resolution pass with attachments; a
		// reordering here would silently move `firstImagePath` (the thumbnail).
		const provider = await providerOver({
			files: [{ path: "note.md" }, { path: "doc.pdf" }, { path: "pic.png" }],
			fileCaches: {
				"note.md": {
					headings: [heading("Intro", 1, 0)],
					links: [ref("doc.pdf", 30)],
					embeds: [ref("pic.png", 10)],
				},
			},
			resolutions: { "doc.pdf": "doc.pdf", "pic.png": "pic.png" },
		});
		expect(provider.getFileMetadata(asVaultPath("note.md"))?.attachments).toEqual([
			{ path: "pic.png", isImage: true },
			{ path: "doc.pdf", isImage: false },
		]);
	});
});

/**
 * The document-position FACT the view's preview rule consumes: "a resolved image
 * reference sits above this note's first heading". The adapter reports it; it
 * decides nothing (the `Auto` preference is what acts on it).
 */
describe("ObsidianLinkProvider imagePrecedesOutline", () => {
	async function imagePrecedesOutlineOf(spec: FakeObsidianSpec, path: string) {
		const provider = await providerOver(spec);
		return provider.getFileMetadata(asVaultPath(path))?.imagePrecedesOutline;
	}

	it("WHEN an image is embedded BEFORE the first heading THEN imagePrecedesOutline is true", async () => {
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 30)], embeds: [ref("pic.png", 5)] },
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(fact).toBe(true);
	});

	it("WHEN the image sits AFTER the first heading THEN imagePrecedesOutline is false", async () => {
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 5)], embeds: [ref("pic.png", 30)] },
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(fact).toBe(false);
	});

	it("WHEN the image is linked from FRONTMATTER THEN imagePrecedesOutline is true (frontmatter sits above all body content)", async () => {
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 0)], frontmatterLinks: [{ link: "pic.png", key: "cover" }] },
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(fact).toBe(true);
	});

	it("WHEN a NON-image attachment precedes the first heading and the first image follows it THEN imagePrecedesOutline is false", async () => {
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "note.md" }, { path: "doc.pdf" }, { path: "pic.png" }],
				fileCaches: {
					"note.md": {
						headings: [heading("Intro", 1, 20)],
						links: [ref("doc.pdf", 5)],
						embeds: [ref("pic.png", 50)],
					},
				},
				resolutions: { "doc.pdf": "doc.pdf", "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(fact).toBe(false);
	});

	it("WHEN the note has an image but NO headings THEN imagePrecedesOutline is false (nothing to precede)", async () => {
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "note.md" }, { path: "pic.png" }],
				fileCaches: { "note.md": { embeds: [ref("pic.png", 5)] } },
				resolutions: { "pic.png": "pic.png" },
			},
			"note.md",
		);
		expect(fact).toBe(false);
	});

	it("WHEN the reference above the first heading does NOT resolve THEN imagePrecedesOutline is false", async () => {
		// An unresolvable `![[missing.png]]` produces no thumbnail, so it must not
		// be allowed to claim the slot — the node would render blank.
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "note.md" }],
				fileCaches: {
					"note.md": { headings: [heading("Intro", 1, 30)], embeds: [ref("missing.png", 5)] },
				},
			},
			"note.md",
		);
		expect(fact).toBe(false);
	});

	it("WHEN the file is an excalidraw drawing THEN imagePrecedesOutline is false (not outline-bearing)", async () => {
		const fact = await imagePrecedesOutlineOf(
			{
				files: [{ path: "draw/x.excalidraw.md" }, { path: "pic.png" }],
				fileCaches: {
					"draw/x.excalidraw.md": {
						headings: [heading("Text Elements", 1, 30)],
						embeds: [ref("pic.png", 5)],
					},
				},
				resolutions: { "pic.png": "pic.png" },
			},
			"draw/x.excalidraw.md",
		);
		expect(fact).toBe(false);
	});

	it("WHEN the file has no cache entry THEN imagePrecedesOutline is false (nothing is KNOWN to sit above a heading)", async () => {
		expect(await imagePrecedesOutlineOf({ files: [{ path: "note.md" }] }, "note.md")).toBe(false);
	});
});

/**
 * The kind each OUTGOING reference carries (Stage 1 of ticket
 * `nid_fay1hu5sxcoygizopkkg0f0d7_e`). Nothing consumes it yet — these cases are the
 * contract Stage 3's per-channel traversal will read.
 */
describe("ObsidianLinkProvider outgoing reference kinds (markdown)", () => {
	async function referencesOf(spec: FakeObsidianSpec, path: string) {
		return (await providerOver(spec)).getOutgoingReferences(asVaultPath(path));
	}

	// GIVEN a note that plainly links target.md, embeds pic.png, and carries a property link.
	const spec: FakeObsidianSpec = {
		files: [{ path: "source.md" }, { path: "target.md" }, { path: "pic.png" }, { path: "prop.md" }],
		fileCaches: {
			"source.md": {
				links: [ref("target", 40)],
				embeds: [ref("pic.png", 20)],
				frontmatterLinks: [{ link: "prop", key: "up" }],
			},
		},
		resolutions: { target: "target.md", "pic.png": "pic.png", prop: "prop.md" },
	};

	it("WHEN a body reference comes from cache.links THEN it is reported as a plain link", async () => {
		expect(await referencesOf(spec, "source.md")).toContainEqual({ target: "target.md", kind: "link" });
	});

	it("WHEN a body reference comes from cache.embeds THEN it is reported as an embed", async () => {
		expect(await referencesOf(spec, "source.md")).toContainEqual({ target: "pic.png", kind: "embed" });
	});

	it("WHEN a reference is a frontmatter property link THEN it is a plain link CARRYING the field-key relation", async () => {
		expect(await referencesOf(spec, "source.md")).toContainEqual({
			target: "prop.md",
			kind: "link",
			relations: [{ name: "up" }],
		});
	});

	it("WHEN kinds are attached THEN reference ORDER is unchanged (frontmatter, then body by offset)", async () => {
		expect(await referencesOf(spec, "source.md")).toEqual([
			{ target: "prop.md", kind: "link", relations: [{ name: "up" }] },
			{ target: "pic.png", kind: "embed" },
			{ target: "target.md", kind: "link" },
		]);
	});

	it("WHEN a note both links and embeds the SAME target THEN both references survive", async () => {
		const references = await referencesOf(
			{
				files: [{ path: "source.md" }, { path: "note-b.md" }],
				fileCaches: { "source.md": { links: [ref("note-b", 40)], embeds: [ref("note-b", 10)] } },
				resolutions: { "note-b": "note-b.md" },
			},
			"source.md",
		);
		expect(references).toEqual([
			{ target: "note-b.md", kind: "embed" },
			{ target: "note-b.md", kind: "link" },
		]);
	});

	it("WHEN the file has no cache entry THEN resolvedLinks keys degrade to plain links (that record merges kinds)", async () => {
		// The ONE remaining kind-unknown path, and a transient one: it is markdown that
		// getFileCache has not seen yet. Canvases never land here — they are always parsed.
		//
		// CONSEQUENCE, deliberately accepted (see the DECIDED block on
		// `outgoingReferencesOf`): during that boot window an authored `![[note]]` from
		// this source is traversed on the outgoing-LINK channel, so `embedDepthOut: 0`
		// does not suppress it. This test is the tripwire: if the fallback ever starts
		// returning `[]` (the rejected alternative), it fails here rather than silently
		// emptying a graph.
		const references = await referencesOf(
			{ files: [{ path: "uncached.md" }, { path: "t.md" }], resolvedLinks: { "uncached.md": { "t.md": 1 } } },
			"uncached.md",
		);
		expect(references).toEqual([{ target: "t.md", kind: "link" }]);
	});
});

describe("ObsidianLinkProvider frontmatter named relationships", () => {
	async function referencesOf(spec: FakeObsidianSpec, path: string) {
		return (await providerOver(spec)).getOutgoingReferences(asVaultPath(path));
	}

	it("WHEN a frontmatter field is link-valued THEN the edge carries the field key as its relation name", async () => {
		const references = await referencesOf(
			{
				files: [{ path: "child.md" }, { path: "parent.md" }],
				fileCaches: { "child.md": { frontmatterLinks: [{ link: "parent", key: "up" }] } },
				resolutions: { parent: "parent.md" },
			},
			"child.md",
		);
		expect(references).toEqual([{ target: "parent.md", kind: "link", relations: [{ name: "up" }] }]);
	});

	it("WHEN a frontmatter list field flattens to up.0/up.1 THEN both targets share the ONE relation name", async () => {
		const references = await referencesOf(
			{
				files: [{ path: "child.md" }, { path: "a.md" }, { path: "b.md" }],
				fileCaches: {
					"child.md": {
						frontmatterLinks: [
							{ link: "a", key: "up.0" },
							{ link: "b", key: "up.1" },
						],
					},
				},
				resolutions: { a: "a.md", b: "b.md" },
			},
			"child.md",
		);
		expect(references).toEqual([
			{ target: "a.md", kind: "link", relations: [{ name: "up" }] },
			{ target: "b.md", kind: "link", relations: [{ name: "up" }] },
		]);
	});

	// PARITY (this ticket's acceptance): a frontmatter relation and the equivalent
	// inline `::` statement must reach edge assembly as the SAME labeled reference —
	// they are two sources feeding one merge, not two edge shapes.
	it("WHEN a relation is named in frontmatter vs inline THEN both produce the same labeled reference", async () => {
		const frontmatterSide = await referencesOf(
			{
				files: [{ path: "fm.md" }, { path: "t.md" }],
				fileCaches: { "fm.md": { frontmatterLinks: [{ link: "t", key: "up" }] } },
				resolutions: { t: "t.md" },
			},
			"fm.md",
		);
		const inlineSide = await referencesOf(
			{
				files: [{ path: "inline.md", content: "up::[[t]]" }, { path: "t.md" }],
				fileCaches: { "inline.md": { links: [ref("t", 0)] } },
				resolutions: { t: "t.md" },
			},
			"inline.md",
		);
		expect(frontmatterSide).toEqual(inlineSide);
		expect(frontmatterSide).toEqual([{ target: "t.md", kind: "link", relations: [{ name: "up" }] }]);
	});
});

describe("ObsidianLinkProvider outgoing reference kinds (canvas)", () => {
	async function kindsByTargetOf(canvasJson: string, extra: Partial<FakeObsidianSpec> = {}) {
		const provider = await providerOver({
			files: [{ path: "note-b.md" }, { path: "pic.png" }, { path: "board.canvas", content: canvasJson }],
			resolutions: { "note-b": "note-b.md", "note-b.md": "note-b.md", "pic.png": "pic.png" },
			...extra,
		});
		return provider.getOutgoingReferences(asVaultPath("board.canvas"));
	}

	it("WHEN a canvas FILE node points at a note THEN the reference is an embed (it renders inline)", async () => {
		expect(await kindsByTargetOf('{"nodes": [{"type": "file", "file": "note-b.md"}]}')).toEqual([
			{ target: "note-b.md", kind: "embed" },
		]);
	});

	it("WHEN a canvas TEXT node writes ![[x]] THEN the reference is an embed", async () => {
		expect(await kindsByTargetOf('{"nodes": [{"type": "text", "text": "![[note-b]]"}]}')).toEqual([
			{ target: "note-b.md", kind: "embed" },
		]);
	});

	it("WHEN a canvas TEXT node writes [[x]] THEN the reference is a plain link", async () => {
		expect(await kindsByTargetOf('{"nodes": [{"type": "text", "text": "[[note-b]]"}]}')).toEqual([
			{ target: "note-b.md", kind: "link" },
		]);
	});

	it("WHEN a canvas TEXT node writes ![](x) THEN the reference is an embed", async () => {
		expect(await kindsByTargetOf('{"nodes": [{"type": "text", "text": "![alt](pic.png)"}]}')).toEqual([
			{ target: "pic.png", kind: "embed" },
		]);
	});

	it("WHEN a canvas both embeds and links the same note THEN both references survive", async () => {
		expect(
			await kindsByTargetOf(
				JSON.stringify({
					nodes: [
						{ type: "file", file: "note-b.md" },
						{ type: "text", text: "[[note-b]]" },
					],
				}),
			),
		).toEqual([
			{ target: "note-b.md", kind: "embed" },
			{ target: "note-b.md", kind: "link" },
		]);
	});

	it("WHEN core has ALSO indexed the canvas THEN the kinds are unchanged (never boot-timing-dependent)", async () => {
		// The whole point of always-parse: `resolvedLinks` could only ever have said
		// "some link", so a core-served canvas would have reported every embed as a link.
		expect(
			await kindsByTargetOf('{"nodes": [{"type": "file", "file": "note-b.md"}]}', {
				resolvedLinks: { "board.canvas": { "note-b.md": 1 } },
			}),
		).toEqual([{ target: "note-b.md", kind: "embed" }]);
	});
});

/**
 * Frontmatter-id links (ticket `nid_phu0llxhfptse000j66ezrhh3_e`): a note's
 * configured `idRefFields` reference another note's `id`, and the provider merges
 * those into the same link streams as wikilinks — both directions, riding the
 * same counts.
 */
describe("ObsidianLinkProvider frontmatter id-ref edges", () => {
	// GIVEN referrer.md's `deps` points at owner.md's `id`, and NO wikilink between them.
	const idRefSpec: FakeObsidianSpec = {
		files: [{ path: "owner.md" }, { path: "referrer.md" }],
		fileCaches: {
			"owner.md": { frontmatter: { id: "owner-id" } },
			"referrer.md": { frontmatter: { id: "referrer-id", deps: ["owner-id"] } },
		},
		idRefFields: "deps, links",
	};

	it("WHEN a configured field references a note's id THEN it is an outgoing link edge", async () => {
		const provider = await providerOver(idRefSpec);
		expect(provider.getOutgoingReferences(asVaultPath("referrer.md"))).toEqual([
			{ target: "owner.md", kind: "link" },
		]);
	});

	it("WHEN a note's id is referenced elsewhere THEN the referrer is an incoming link", async () => {
		const provider = await providerOver(idRefSpec);
		expect(provider.getIncomingLinks(asVaultPath("owner.md"))).toEqual(["referrer.md"]);
	});

	it("WHEN a pair is joined only by an id-ref THEN its link count reports the occurrence", async () => {
		const provider = await providerOver(idRefSpec);
		expect(provider.getLinkCount(asVaultPath("referrer.md"), asVaultPath("owner.md"))).toBe(1);
	});

	it("WHEN a pair is BOTH wikilinked and id-referenced THEN the counts add up", async () => {
		// GIVEN a wikilink referrer→owner AND a `deps` id-ref to the same note.
		const provider = await providerOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": {
					frontmatter: { deps: ["owner-id"] },
					links: [{ link: "owner", position: { start: { offset: 0 } } }],
				},
			},
			resolutions: { owner: "owner.md" },
			resolvedLinks: { "referrer.md": { "owner.md": 1 } },
			idRefFields: "deps",
		});
		expect(provider.getLinkCount(asVaultPath("referrer.md"), asVaultPath("owner.md"))).toBe(2);
	});

	it("WHEN the same target is both wikilinked and id-referenced THEN the link edge is not duplicated", async () => {
		const provider = await providerOver({
			files: [{ path: "owner.md" }, { path: "referrer.md" }],
			fileCaches: {
				"owner.md": { frontmatter: { id: "owner-id" } },
				"referrer.md": {
					frontmatter: { deps: ["owner-id"] },
					links: [{ link: "owner", position: { start: { offset: 0 } } }],
				},
			},
			resolutions: { owner: "owner.md" },
			idRefFields: "deps",
		});
		expect(provider.getOutgoingReferences(asVaultPath("referrer.md"))).toEqual([
			{ target: "owner.md", kind: "link" },
		]);
	});

	it("WHEN the feature is OFF (no configured fields) THEN id-refs add no edges", async () => {
		const provider = await providerOver({ ...idRefSpec, idRefFields: "" });
		expect(provider.getOutgoingReferences(asVaultPath("referrer.md"))).toEqual([]);
	});
});
