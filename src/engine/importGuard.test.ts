import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Step-02 exit criterion: ZERO `obsidian` / `obsidian-id-lib` / react imports
 * anywhere under src/engine/ — the engine must stay pure. Enforced as a test
 * because the repo has no ESLint yet (see ticket-eslint-adoption).
 */

const ENGINE_DIR = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN_MODULE_PREFIXES = ["obsidian", "obsidian-id-lib", "react", "react-dom"];

// Static imports/re-exports, side-effect imports, dynamic import(...) and require(...).
const MODULE_SPECIFIER_PATTERNS = [
	/(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g,
	// Side-effect import (review finding 2): the quoted specifier follows the keyword directly.
	/import\s*["']([^"']+)["']/g,
	/import\s*\(\s*["']([^"']+)["']\s*\)/g,
	/require\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function tsFilesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
		.map((entry) => join(entry.parentPath, entry.name));
}

function moduleSpecifiersIn(source: string): string[] {
	const specifiers: string[] = [];
	for (const pattern of MODULE_SPECIFIER_PATTERNS) {
		for (const match of source.matchAll(pattern)) {
			const specifier = match[1];
			if (specifier !== undefined) {
				specifiers.push(specifier);
			}
		}
	}
	return specifiers;
}

function forbiddenSpecifiersAmong(specifiers: readonly string[]): string[] {
	return specifiers.filter((specifier) =>
		FORBIDDEN_MODULE_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`)),
	);
}

function forbiddenImportsIn(filePath: string): string[] {
	return forbiddenSpecifiersAmong(moduleSpecifiersIn(readFileSync(filePath, "utf8")));
}

describe("engine import guard", () => {
	it("WHEN scanning src/engine THEN there is at least one file (guard is not vacuous)", () => {
		expect(tsFilesUnder(ENGINE_DIR).length).toBeGreaterThan(0);
	});

	it("WHEN scanning every engine file THEN no obsidian/obsidian-id-lib/react import exists", () => {
		const offenders = tsFilesUnder(ENGINE_DIR)
			.map((file) => ({ file, forbidden: forbiddenImportsIn(file) }))
			.filter((entry) => entry.forbidden.length > 0);
		expect(offenders).toEqual([]);
	});
});

/**
 * Quotes a module specifier for a fixture snippet. Fixtures are assembled via
 * template interpolation so THIS file's raw source never contains a matchable
 * `import "..."` form — the guard scans itself, and literal fixtures would
 * (correctly!) trip it.
 */
function q(specifier: string): string {
	return `"${specifier}"`;
}

// The guard is only as good as its matcher — prove every import form is caught
// (review finding 2: side-effect imports used to slip through).
describe("engine import guard matcher", () => {
	it("WHEN a named import is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`import { Notice } from ${q("obsidian")};`)).toEqual(["obsidian"]);
	});

	it("WHEN a default import is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`import React from ${q("react")};`)).toEqual(["react"]);
	});

	it("WHEN a type-only import is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`import type { App } from ${q("obsidian")};`)).toEqual(["obsidian"]);
	});

	it("WHEN a side-effect import is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`import ${q("obsidian")};`)).toEqual(["obsidian"]);
	});

	it("WHEN a deep-path import is scanned THEN its specifier is extracted and flagged", () => {
		expect(forbiddenSpecifiersAmong(moduleSpecifiersIn(`import { x } from ${q("obsidian/foo")};`))).toEqual([
			"obsidian/foo",
		]);
	});

	it("WHEN a re-export is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`export * from ${q("react-dom")};`)).toEqual(["react-dom"]);
	});

	it("WHEN a multiline import is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`import {\n\tNotice,\n\tApp,\n} from ${q("obsidian")};`)).toEqual(["obsidian"]);
	});

	it("WHEN a dynamic import is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`const mod = await import(${q("obsidian")});`)).toEqual(["obsidian"]);
	});

	it("WHEN a require call is scanned THEN its specifier is extracted", () => {
		expect(moduleSpecifiersIn(`const mod = require(${q("obsidian-id-lib")});`)).toEqual(["obsidian-id-lib"]);
	});

	it("WHEN a relative import is scanned THEN it is extracted but NOT flagged as forbidden", () => {
		expect(forbiddenSpecifiersAmong(moduleSpecifiersIn(`import { GraphNode } from ${q("./types")};`))).toEqual(
			[],
		);
	});

	it("WHEN a module merely PREFIXED by a forbidden name is scanned THEN it is not flagged", () => {
		expect(forbiddenSpecifiersAmong(["obsidianite", "reactive-lib"])).toEqual([]);
	});
});
