import { describe, expect, it } from "vitest";
import { FileKinds } from "./FileKinds";

describe("FileKinds.isNodeBearingPath", () => {
	it("WHEN the path is a markdown note THEN it is node-bearing", () => {
		expect(FileKinds.isNodeBearingPath("folder/note.md")).toBe(true);
	});

	it("WHEN the path is a canvas THEN it is node-bearing", () => {
		expect(FileKinds.isNodeBearingPath("board.canvas")).toBe(true);
	});

	it("WHEN the path is an image THEN it is NOT node-bearing", () => {
		expect(FileKinds.isNodeBearingPath("pic.png")).toBe(false);
	});
});

describe("FileKinds.isOutlineBearingPath", () => {
	it("WHEN the path is a markdown note THEN it is outline-bearing", () => {
		expect(FileKinds.isOutlineBearingPath("notes/a.md")).toBe(true);
	});

	it("WHEN the path is an excalidraw drawing THEN it is NOT outline-bearing", () => {
		expect(FileKinds.isOutlineBearingPath("draw/x.excalidraw.md")).toBe(false);
	});

	it("WHEN the excalidraw suffix is upper-cased THEN it is still NOT outline-bearing", () => {
		expect(FileKinds.isOutlineBearingPath("draw/X.Excalidraw.MD")).toBe(false);
	});

	it("WHEN the path is a canvas THEN it is NOT outline-bearing (canvas has no headings)", () => {
		expect(FileKinds.isOutlineBearingPath("board.canvas")).toBe(false);
	});

	it("WHEN the path is an excalidraw drawing THEN it is STILL node-bearing (excluded from outline parsing only)", () => {
		expect(FileKinds.isNodeBearingPath("draw/x.excalidraw.md")).toBe(true);
	});
});

describe("FileKinds.isImagePath", () => {
	it("WHEN the path has an image extension THEN it is an image", () => {
		expect(FileKinds.isImagePath("shots/pic.JPG")).toBe(true);
	});

	it("WHEN the path is a pdf THEN it is not an image", () => {
		expect(FileKinds.isImagePath("doc.pdf")).toBe(false);
	});
});
