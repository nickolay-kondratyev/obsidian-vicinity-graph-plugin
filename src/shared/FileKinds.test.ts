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

describe("FileKinds.isImagePath", () => {
	it("WHEN the path has an image extension THEN it is an image", () => {
		expect(FileKinds.isImagePath("shots/pic.JPG")).toBe(true);
	});

	it("WHEN the path is a pdf THEN it is not an image", () => {
		expect(FileKinds.isImagePath("doc.pdf")).toBe(false);
	});
});
