import { describe, expect, it } from "vitest";
import { ChildNoteNaming } from "./ChildNoteNaming";

/**
 * Untitled child-note dedupe (Obsidian core naming), from a fake existence set
 * alone — the adapter supplies a live vault read for `exists` at click time.
 */
describe("ChildNoteNaming untitled dedupe", () => {
	const existsIn = (taken: readonly string[]) => (path: string): boolean => taken.includes(path);

	it("WHEN nothing is taken THEN the first child is `<folder>/Untitled.md`", () => {
		expect(ChildNoteNaming.untitledChildPath("Jon", existsIn([]))).toBe("Jon/Untitled.md");
	});

	it("WHEN `Untitled.md` is taken THEN it dedupes to `Untitled 1.md`", () => {
		expect(ChildNoteNaming.untitledChildPath("Jon", existsIn(["Jon/Untitled.md"]))).toBe("Jon/Untitled 1.md");
	});

	it("WHEN `Untitled.md` and `Untitled 1.md` are taken THEN it dedupes to `Untitled 2.md`", () => {
		expect(
			ChildNoteNaming.untitledChildPath("Jon", existsIn(["Jon/Untitled.md", "Jon/Untitled 1.md"])),
		).toBe("Jon/Untitled 2.md");
	});

	it("WHEN a nested folder owns the child THEN the deduped path keeps the full folder prefix", () => {
		expect(ChildNoteNaming.untitledChildPath("A/B/Jon", existsIn(["A/B/Jon/Untitled.md"]))).toBe(
			"A/B/Jon/Untitled 1.md",
		);
	});
});
