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

// Static imports/re-exports, dynamic import(...) and require(...).
const MODULE_SPECIFIER_PATTERNS = [
	/(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g,
	/import\s*\(\s*["']([^"']+)["']\s*\)/g,
	/require\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function tsFilesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
		.map((entry) => join(entry.parentPath, entry.name));
}

function forbiddenImportsIn(filePath: string): string[] {
	const source = readFileSync(filePath, "utf8");
	const specifiers: string[] = [];
	for (const pattern of MODULE_SPECIFIER_PATTERNS) {
		for (const match of source.matchAll(pattern)) {
			const specifier = match[1];
			if (specifier !== undefined) {
				specifiers.push(specifier);
			}
		}
	}
	return specifiers.filter((specifier) =>
		FORBIDDEN_MODULE_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`)),
	);
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
