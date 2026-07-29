import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasFallbackParser } from "./CanvasFallbackParser";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "testFixtures");

function fixture(name: string): string {
	return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

afterEach(() => {
	vi.restoreAllMocks();
});

// GIVEN the board.canvas fixture: file nodes (md + png, one duplicated), a text
// node containing a wikilink and an embed, a link node and a group node.
describe("CanvasFallbackParser on a valid canvas", () => {
	it("WHEN parsing THEN file nodes and text-node links are returned together, in node order", () => {
		expect(CanvasFallbackParser.parseReferences("board.canvas", fixture("board.canvas"))).toEqual([
			{ kind: "file-node", filePath: "notes/alpha.md" },
			{ kind: "text-node-link", linkText: "beta" },
			{ kind: "text-node-link", linkText: "images/pic.png" },
			{ kind: "file-node", filePath: "images/pic.png" },
			{ kind: "file-node", filePath: "notes/alpha.md" },
		]);
	});

	it("WHEN a text node contains a wikilink THEN it is reported as link TEXT, not as a path", () => {
		// The distinction is load-bearing: `beta` still needs Obsidian's link
		// resolution, while a file node's `file` is already a vault path.
		expect(CanvasFallbackParser.parseReferences("board.canvas", fixture("board.canvas"))).toContainEqual({
			kind: "text-node-link",
			linkText: "beta",
		});
	});

	it("WHEN a text node contains a markdown-style link THEN it is reported as link TEXT too", () => {
		// A canvas text node is markdown, so core indexes `[a](b.md)` there just like a
		// wikilink; the destination arrives normalised (decoded, no title) as link text.
		const raw = '{"nodes": [{"type": "text", "text": "see [label](my%20note.md)"}]}';
		expect(CanvasFallbackParser.parseReferences("board.canvas", raw)).toEqual([
			{ kind: "text-node-link", linkText: "my note.md" },
		]);
	});

	it("WHEN a text node's markdown-style link is external THEN it references no vault document", () => {
		const raw = '{"nodes": [{"type": "text", "text": "see [label](https://example.com)"}]}';
		expect(CanvasFallbackParser.parseReferences("board.canvas", raw)).toEqual([]);
	});

	it("WHEN a text node's only links sit in an inline code span THEN nothing is referenced (core indexes none)", () => {
		const raw = '{"nodes": [{"type": "text", "text": "sample: `[[beta]]` and `[l](beta.md)`"}]}';
		expect(CanvasFallbackParser.parseReferences("board.canvas", raw)).toEqual([]);
	});

	it("WHEN a text node's only links sit in a fenced block THEN nothing is referenced (core indexes none)", () => {
		const raw = JSON.stringify({
			nodes: [{ type: "text", text: ["```md", "[[beta]]", "[l](beta.md)", "```"].join("\n") }],
		});
		expect(CanvasFallbackParser.parseReferences("board.canvas", raw)).toEqual([]);
	});

	it("WHEN a text node mixes prose and code links THEN only the prose ones are referenced", () => {
		const raw = JSON.stringify({
			nodes: [{ type: "text", text: "real [[beta]], sample `[[gamma]]`" }],
		});
		expect(CanvasFallbackParser.parseReferences("board.canvas", raw)).toEqual([
			{ kind: "text-node-link", linkText: "beta" },
		]);
	});

	it("WHEN a node is an external link node THEN it references no vault document", () => {
		const references = CanvasFallbackParser.parseReferences("board.canvas", fixture("board.canvas"));
		expect(JSON.stringify(references)).not.toContain("example.com");
	});
});

// GIVEN the malformed.canvas fixture (truncated JSON)
describe("CanvasFallbackParser on malformed content", () => {
	it("WHEN parsing malformed JSON THEN it does not throw and yields no links", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(CanvasFallbackParser.parseReferences("malformed.canvas", fixture("malformed.canvas"))).toEqual([]);
	});

	it("WHEN parsing malformed JSON THEN the skip is reported via console.error", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		CanvasFallbackParser.parseReferences("malformed.canvas", fixture("malformed.canvas"));
		expect(errorSpy).toHaveBeenCalledOnce();
	});
});

describe("CanvasFallbackParser on degenerate shapes", () => {
	it("WHEN the canvas is an empty object THEN no links are returned", () => {
		expect(CanvasFallbackParser.parseReferences("empty.canvas", "{}")).toEqual([]);
	});

	it("WHEN nodes is not an array THEN no links are returned", () => {
		expect(CanvasFallbackParser.parseReferences("odd.canvas", '{"nodes": {"n1": {}}}')).toEqual([]);
	});

	it("WHEN a file node lacks a string file field THEN that node is skipped", () => {
		const raw = '{"nodes": [{"type": "file", "file": 42}, {"type": "file", "file": "ok.md"}, null]}';
		expect(CanvasFallbackParser.parseReferences("odd.canvas", raw)).toEqual([
			{ kind: "file-node", filePath: "ok.md" },
		]);
	});

	it("WHEN a text node lacks a string text field THEN that node is skipped", () => {
		expect(CanvasFallbackParser.parseReferences("odd.canvas", '{"nodes": [{"type": "text", "text": 42}]}')).toEqual(
			[],
		);
	});

	it("WHEN a text node carries no link of either syntax THEN it contributes nothing", () => {
		const raw = '{"nodes": [{"type": "text", "text": "just prose"}]}';
		expect(CanvasFallbackParser.parseReferences("odd.canvas", raw)).toEqual([]);
	});

	it("WHEN the JSON root is not an object THEN no links are returned", () => {
		expect(CanvasFallbackParser.parseReferences("odd.canvas", '"just a string"')).toEqual([]);
	});
});
