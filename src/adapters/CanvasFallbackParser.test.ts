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
// node containing a wikilink, a link node and a group node.
describe("CanvasFallbackParser on a valid canvas", () => {
	it("WHEN parsing THEN exactly the file-type node paths are returned, in node order", () => {
		expect(CanvasFallbackParser.parseFilePaths("board.canvas", fixture("board.canvas"))).toEqual([
			"notes/alpha.md",
			"images/pic.png",
			"notes/alpha.md",
		]);
	});

	it("WHEN a text node contains a wikilink THEN it is skipped (V1 scope)", () => {
		const paths = CanvasFallbackParser.parseFilePaths("board.canvas", fixture("board.canvas"));
		expect(paths).not.toContain("beta");
	});
});

// GIVEN the malformed.canvas fixture (truncated JSON)
describe("CanvasFallbackParser on malformed content", () => {
	it("WHEN parsing malformed JSON THEN it does not throw and yields no links", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(CanvasFallbackParser.parseFilePaths("malformed.canvas", fixture("malformed.canvas"))).toEqual([]);
	});

	it("WHEN parsing malformed JSON THEN the skip is reported via console.error", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		CanvasFallbackParser.parseFilePaths("malformed.canvas", fixture("malformed.canvas"));
		expect(errorSpy).toHaveBeenCalledOnce();
	});
});

describe("CanvasFallbackParser on degenerate shapes", () => {
	it("WHEN the canvas is an empty object THEN no links are returned", () => {
		expect(CanvasFallbackParser.parseFilePaths("empty.canvas", "{}")).toEqual([]);
	});

	it("WHEN nodes is not an array THEN no links are returned", () => {
		expect(CanvasFallbackParser.parseFilePaths("odd.canvas", '{"nodes": {"n1": {}}}')).toEqual([]);
	});

	it("WHEN a file node lacks a string file field THEN that node is skipped", () => {
		const raw = '{"nodes": [{"type": "file", "file": 42}, {"type": "file", "file": "ok.md"}, null]}';
		expect(CanvasFallbackParser.parseFilePaths("odd.canvas", raw)).toEqual(["ok.md"]);
	});

	it("WHEN the JSON root is not an object THEN no links are returned", () => {
		expect(CanvasFallbackParser.parseFilePaths("odd.canvas", '"just a string"')).toEqual([]);
	});
});
