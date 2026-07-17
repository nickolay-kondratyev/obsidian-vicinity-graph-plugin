import { describe, expect, it, vi } from "vitest";
import { CanvasParseCache } from "./CanvasParseCache";
import { FakeObsidianPorts } from "./FakeObsidianPorts";

const CANVAS_JSON = '{"nodes": [{"type": "file", "file": "a.md"}]}';
const CHANGED_CANVAS_JSON = '{"nodes": [{"type": "file", "file": "b.md"}]}';

// GIVEN a canvas file served through a fake vault with a spy-able cachedRead
describe("CanvasParseCache", () => {
	function fakeVaultWithCanvas(mtime: number, content: string) {
		const ports = new FakeObsidianPorts({ files: [{ path: "board.canvas", mtime, content }] });
		const readSpy = vi.spyOn(ports.vault, "cachedRead");
		const file = ports.vault.getFileByPath("board.canvas");
		if (file === null) {
			throw new Error("fixture bug: board.canvas not declared");
		}
		return { vault: ports.vault, file, readSpy };
	}

	it("WHEN parsing a canvas THEN its file-node paths are returned", async () => {
		const { vault, file } = fakeVaultWithCanvas(1, CANVAS_JSON);
		expect(await new CanvasParseCache().filePathsOf(vault, file)).toEqual(["a.md"]);
	});

	it("WHEN the mtime is unchanged THEN the second lookup does not re-read the file", async () => {
		const { vault, file, readSpy } = fakeVaultWithCanvas(1, CANVAS_JSON);
		const cache = new CanvasParseCache();
		await cache.filePathsOf(vault, file);
		await cache.filePathsOf(vault, file);
		expect(readSpy).toHaveBeenCalledOnce();
	});

	it("WHEN the mtime changed THEN the canvas is re-read and re-parsed", async () => {
		const cache = new CanvasParseCache();
		const before = fakeVaultWithCanvas(1, CANVAS_JSON);
		await cache.filePathsOf(before.vault, before.file);
		const after = fakeVaultWithCanvas(2, CHANGED_CANVAS_JSON);
		expect(await cache.filePathsOf(after.vault, after.file)).toEqual(["b.md"]);
	});

	it("WHEN a path is evicted THEN the next lookup re-reads even with an unchanged mtime", async () => {
		const { vault, file, readSpy } = fakeVaultWithCanvas(1, CANVAS_JSON);
		const cache = new CanvasParseCache();
		await cache.filePathsOf(vault, file);
		cache.evict("board.canvas");
		await cache.filePathsOf(vault, file);
		expect(readSpy).toHaveBeenCalledTimes(2);
	});
});
