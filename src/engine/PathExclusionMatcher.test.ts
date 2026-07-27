import { describe, expect, it } from "vitest";
import { PathExclusionMatcher } from "./PathExclusionMatcher";
import { asVaultPath } from "./types";

function excludes(patterns: readonly string[], path: string): boolean {
	return PathExclusionMatcher.fromPatterns(patterns).excludes(asVaultPath(path));
}

describe("PathExclusionMatcher unanchored matching", () => {
	it("WHEN pattern 'rel/' THEN it matches a vault-root path segment rel/x.md", () => {
		expect(excludes(["rel/"], "rel/some-relationship.md")).toBe(true);
	});

	it("WHEN pattern 'rel/' THEN it matches a NESTED path a/rel/x.md (unanchored)", () => {
		expect(excludes(["rel/"], "a/rel/x.md")).toBe(true);
	});

	it("WHEN pattern 'rel/' THEN it does NOT match a path without that segment", () => {
		expect(excludes(["rel/"], "notes/x.md")).toBe(false);
	});
});

describe("PathExclusionMatcher anchoring", () => {
	it("WHEN pattern '^rel/' THEN it matches only at the vault root", () => {
		expect(excludes(["^rel/"], "rel/x.md")).toBe(true);
	});

	it("WHEN pattern '^rel/' THEN it does NOT match a nested a/rel/x.md", () => {
		expect(excludes(["^rel/"], "a/rel/x.md")).toBe(false);
	});
});

describe("PathExclusionMatcher case sensitivity", () => {
	it("WHEN pattern 'Rel/' THEN a lowercase 'rel/' path does NOT match (case-sensitive)", () => {
		expect(excludes(["Rel/"], "rel/x.md")).toBe(false);
	});
});

describe("PathExclusionMatcher extension inclusion", () => {
	it("WHEN pattern matches the extension THEN the full path incl. extension is tested", () => {
		expect(excludes(["\\.excalidraw\\.md$"], "drawings/board.excalidraw.md")).toBe(true);
	});
});

describe("PathExclusionMatcher multiple patterns", () => {
	it("WHEN ANY pattern matches THEN the path is excluded", () => {
		expect(excludes(["^archive/", "templates/"], "notes/templates/daily.md")).toBe(true);
	});
});

describe("PathExclusionMatcher invalid patterns", () => {
	it("WHEN a pattern fails to compile THEN it is silently skipped (excludes nothing, no throw)", () => {
		expect(excludes(["("], "rel/x.md")).toBe(false);
	});

	it("WHEN an invalid pattern sits beside a valid one THEN the valid one still matches", () => {
		expect(excludes(["(", "rel/"], "rel/x.md")).toBe(true);
	});
});

describe("PathExclusionMatcher.compileFailure (what a UI may warn about)", () => {
	it("WHEN a pattern is reported as failing THEN that same pattern is one the matcher skips", () => {
		expect(PathExclusionMatcher.compileFailure("(")).toBeDefined();
		expect(excludes(["("], "rel/x.md")).toBe(false);
	});

	it("WHEN a pattern compiles THEN no failure is reported", () => {
		expect(PathExclusionMatcher.compileFailure("^archive/")).toBeUndefined();
	});

	it("WHEN a pattern fails THEN the regex engine's own reason is returned", () => {
		expect(PathExclusionMatcher.compileFailure("(")).toContain("Invalid regular expression");
	});
});

describe("PathExclusionMatcher empty list", () => {
	it("WHEN there are no patterns THEN nothing is excluded (no-op matcher)", () => {
		expect(excludes([], "rel/x.md")).toBe(false);
	});
});
