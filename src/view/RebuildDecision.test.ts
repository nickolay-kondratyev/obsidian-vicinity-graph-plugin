import { describe, expect, it } from "vitest";
import { decideActiveFileRebuild } from "./RebuildDecision";

describe("decideActiveFileRebuild", () => {
	it("WHEN a different markdown file becomes active THEN it rebuilds with that path as MAIN", () => {
		expect(decideActiveFileRebuild("notes/b.md", "notes/a.md")).toEqual({ kind: "rebuild", mainPath: "notes/b.md" });
	});

	it("WHEN a canvas file becomes active THEN it rebuilds (canvas is node-bearing)", () => {
		expect(decideActiveFileRebuild("board.canvas", null)).toEqual({ kind: "rebuild", mainPath: "board.canvas" });
	});

	it("WHEN there is no active file THEN it ignores", () => {
		expect(decideActiveFileRebuild(null, "notes/a.md")).toEqual({ kind: "ignore" });
	});

	it("WHEN the active file is a non-node-bearing attachment THEN it ignores", () => {
		expect(decideActiveFileRebuild("assets/pic.png", "notes/a.md")).toEqual({ kind: "ignore" });
	});

	it("WHEN the active file is already MAIN THEN it ignores", () => {
		expect(decideActiveFileRebuild("notes/a.md", "notes/a.md")).toEqual({ kind: "ignore" });
	});
});
