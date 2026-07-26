import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { CanvasParseCache } from "./CanvasParseCache";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
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
	return ObsidianLinkProvider.create(ports.vault, ports.metadataCache, new CanvasParseCache());
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
				frontmatterLinks: [{ link: "prop" }],
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

	it("WHEN no .canvas keys exist in resolvedLinks THEN capability is fallback-required", async () => {
		expect((await providerOver(fallbackSpec)).canvasCapability).toBe("fallback-required");
	});

	it("WHEN in fallback mode THEN canvas outgoing links come from the parsed file nodes (resolved only)", async () => {
		const provider = await providerOver(fallbackSpec);
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md", "pic.png"]);
	});

	it("WHEN in fallback mode THEN a note's incoming links include the canvases referencing it", async () => {
		const provider = await providerOver(fallbackSpec);
		expect(provider.getIncomingLinks(asVaultPath("note-a.md"))).toEqual(["board.canvas"]);
	});

	it("WHEN canvas is core-indexed THEN canvas outgoing links flow from resolvedLinks (parser dormant)", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "board.canvas", content: CANVAS_JSON }],
			resolvedLinks: { "board.canvas": { "note-a.md": 1 } },
		});
		expect(provider.getOutgoingLinks(asVaultPath("board.canvas"))).toEqual(["note-a.md"]);
	});

	it("WHEN canvas is core-indexed THEN the fallback does not double-report incoming links", async () => {
		const provider = await providerOver({
			files: [{ path: "note-a.md" }, { path: "board.canvas", content: CANVAS_JSON }],
			resolvedLinks: { "board.canvas": { "note-a.md": 1 } },
		});
		expect(provider.getIncomingLinks(asVaultPath("note-a.md"))).toEqual(["board.canvas"]);
	});
});

/**
 * CHARACTERIZATION, not endorsement: the two canvas regimes do NOT agree, and which one
 * a rebuild lands in is decided per build from a racing `metadataCache.resolvedLinks`
 * (`ObsidianLinkProvider.create` → `CanvasCapabilityDetector`). These two tests pin the
 * exact difference — a wikilink inside a canvas TEXT node — so it is visible in `npm test`
 * instead of only as an e2e flake. WHICH behaviour is correct is a product decision,
 * tracked in ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`; neither test asserts a preference.
 */
describe("ObsidianLinkProvider canvas TEXT-node wikilinks (the two regimes disagree)", () => {
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

	it("WHEN a fallback-parsed canvas references the same note twice THEN getLinkCount reports 2", async () => {
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
		// view's call (`nodePreviewChoice`), driven by `imagePrecedesOutline`.
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
					"note.md": { headings: [heading("Intro", 1, 0)], frontmatterLinks: [{ link: "pic.png" }] },
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
					"note.md": { headings: [heading("Intro", 1, 0)], frontmatterLinks: [{ link: "pic.png" }] },
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
