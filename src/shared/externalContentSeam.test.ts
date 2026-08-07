import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXTERNAL_CONTENT_HOSTS } from "./ExternalContentUrls";

/**
 * STRONG BLOCK (ticket `nid_tvtm9gj5zaj4tbfbpti3v6sy2_e`): "OFF means zero network" is only
 * enforceable if the seam is the SOLE place external hosts and network calls can appear.
 * This scan fails the build if any module OUTSIDE the sanctioned seam names an external host
 * literal, an `http(s)://` URL, `requestUrl(`, or `fetch(`. Same repo idiom as
 * `typedNumberFields.test.ts` / the `ACCESSOR_OWNED_SYMBOLS` scan: the both-states unit test
 * (`ExternalContentUrls.test.ts`) proves the seam refuses when OFF; this proves nobody else
 * can route around it.
 *
 * WHY a source scan and not a type: "no other module constructs an external URL" is a claim
 * about every FILE in the bundle, including ones no test renders. A type can force the gate
 * on the seam's own API; only a scan can prove the API is the only door.
 */

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The sanctioned seam — the ONLY non-test source allowed to name external hosts / network
 * calls. `ExternalContentUrls.ts` is the URL builder; the future `requestUrl`/`fetch`
 * adapter (a separate ticket) joins this list when it lands. Paths are relative to `src/`.
 */
const SANCTIONED_SEAM_FILES: readonly string[] = ["shared/ExternalContentUrls.ts"];

/** What the scan hunts for, each with the plain-language complaint a failure prints. */
const FORBIDDEN_PATTERNS: readonly { readonly pattern: RegExp; readonly what: string }[] = [
	{ pattern: /https?:\/\//, what: "an http(s):// URL literal" },
	{ pattern: /\brequestUrl\s*\(/, what: "a requestUrl( network call" },
	{ pattern: /\bfetch\s*\(/, what: "a fetch( network call" },
	...Object.values(EXTERNAL_CONTENT_HOSTS).map((host) => ({
		pattern: new RegExp(host.replace(/[.]/g, "\\.")),
		what: `the external host literal "${host}"`,
	})),
];

function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
		.map((entry) => join(entry.parentPath, entry.name));
}

/** Test files legitimately assert on host literals — they are not part of the shipped bundle. */
function isTestFile(path: string): boolean {
	return path.endsWith(".test.ts") || path.endsWith(".test.tsx");
}

function isSanctionedSeam(path: string): boolean {
	const rel = relative(SRC_DIR, path);
	return SANCTIONED_SEAM_FILES.includes(rel);
}

/**
 * Source with COMMENTS removed, so a URL or `fetch()` mentioned in prose (the libavoid
 * loader documents `fetch(data:)`, for one) is never mistaken for a call. Only line-leading
 * `//` / `*` are dropped: a `//` inside a string literal — a real URL — must survive.
 */
function sourceWithoutComments(path: string): string {
	return readFileSync(path, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.filter((line) => !/^\s*(\/\/|\*)/.test(line))
		.join("\n");
}

/** The non-test, non-seam modules the invariant covers. */
function guardedModules(): string[] {
	return sourceFilesUnder(SRC_DIR).filter((path) => !isTestFile(path) && !isSanctionedSeam(path));
}

describe("external-content seam: it is the only door to the network", () => {
	it("WHEN any non-seam module is scanned THEN it names no external host, URL, fetch or requestUrl", () => {
		const violations = guardedModules().flatMap((path) => {
			const source = sourceWithoutComments(path);
			return FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(
				({ what }) => `${relative(SRC_DIR, path)} references ${what} outside the external-content seam`,
			);
		});
		expect(violations).toEqual([]);
	});

	it("WHEN the scan runs THEN it covered the source tree (the guard is not vacuous)", () => {
		expect(guardedModules().length).toBeGreaterThan(10);
	});

	it("WHEN the seam file itself is scanned THEN it DOES name the hosts (the patterns really match)", () => {
		// Proves the scan would catch a leak: the same patterns fire on the sanctioned file,
		// which is excluded only because it is the sanctioned file.
		const seam = sourceWithoutComments(join(SRC_DIR, SANCTIONED_SEAM_FILES[0] ?? ""));
		const matched = FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(seam));
		expect(matched.length).toBeGreaterThan(0);
	});
});
