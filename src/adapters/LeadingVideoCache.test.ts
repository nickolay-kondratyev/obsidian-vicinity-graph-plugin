import { describe, expect, it, vi } from "vitest";
import { LeadingVideoCache } from "./LeadingVideoCache";
import { FakeObsidianPorts } from "./FakeObsidianPorts";

const VIDEO_BODY = "![](https://youtu.be/dQw4w9WgXcQ)";
const CHANGED_VIDEO_BODY = "![](https://youtu.be/abcdef12345)";
const NO_VIDEO_BODY = "# Intro\n\nplain body, nothing to embed";

// GIVEN a markdown note served through a fake vault with a spy-able cachedRead
describe("LeadingVideoCache", () => {
	function fakeVaultWithNote(mtime: number, content: string) {
		const ports = new FakeObsidianPorts({ files: [{ path: "note.md", mtime, content }] });
		const readSpy = vi.spyOn(ports.vault, "cachedRead");
		const file = ports.vault.getFileByPath("note.md");
		if (file === null) {
			throw new Error("fixture bug: note.md not declared");
		}
		return { vault: ports.vault, file, readSpy };
	}

	it("WHEN a note carries a leading YouTube embed THEN its identity and offset are returned", async () => {
		const { vault, file } = fakeVaultWithNote(1, VIDEO_BODY);
		expect(await new LeadingVideoCache().leadingEmbedOf(vault, file)).toEqual({
			identity: { videoId: "dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
			offset: 0,
		});
	});

	it("WHEN a note carries no YouTube embed THEN the result is null", async () => {
		const { vault, file } = fakeVaultWithNote(1, NO_VIDEO_BODY);
		expect(await new LeadingVideoCache().leadingEmbedOf(vault, file)).toBeNull();
	});

	it("WHEN the mtime is unchanged THEN the second lookup does not re-read the file", async () => {
		const { vault, file, readSpy } = fakeVaultWithNote(1, VIDEO_BODY);
		const cache = new LeadingVideoCache();
		await cache.leadingEmbedOf(vault, file);
		await cache.leadingEmbedOf(vault, file);
		expect(readSpy).toHaveBeenCalledOnce();
	});

	it("WHEN the mtime changed THEN the note is re-read and re-parsed", async () => {
		const cache = new LeadingVideoCache();
		const before = fakeVaultWithNote(1, VIDEO_BODY);
		await cache.leadingEmbedOf(before.vault, before.file);
		const after = fakeVaultWithNote(2, CHANGED_VIDEO_BODY);
		expect((await cache.leadingEmbedOf(after.vault, after.file))?.identity.videoId).toBe("abcdef12345");
	});

	it("WHEN a path is evicted THEN the next lookup re-reads even with an unchanged mtime", async () => {
		const { vault, file, readSpy } = fakeVaultWithNote(1, VIDEO_BODY);
		const cache = new LeadingVideoCache();
		await cache.leadingEmbedOf(vault, file);
		cache.evict("note.md");
		await cache.leadingEmbedOf(vault, file);
		expect(readSpy).toHaveBeenCalledTimes(2);
	});
});
