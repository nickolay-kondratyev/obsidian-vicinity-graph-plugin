// `import * as fs` is the ONE form `vaultTarget.test.ts`'s destructive-call scan keys off.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Tripwire for the blind spot that let commit `998fdac` strand an e2e assertion:
 * `npm test` (vitest) deliberately excludes `npm run test:e2e` (Playwright,
 * release gate), so removing a rendered element, its CSS class AND its unit tests
 * in one commit keeps the fast gate green BY CONSTRUCTION while the e2e suite
 * goes red — and stays red unnoticed. This scan runs inside `npm test`: every
 * `.vicinity-graph-*` class the e2e sources assert must be produced somewhere
 * under `src/view/`. It is a pure string scan (no Obsidian, no browser,
 * milliseconds) and would have caught `998fdac` in seconds.
 *
 * WHAT IT DOES NOT CATCH — it is a tripwire, NOT a substitute for the release gate:
 * - Text / DOM-structure drift. `toHaveText("solo/Gamma")` going stale when the
 *   `solo/` title prefix is deleted is invisible here (that was the OTHER half of
 *   the same `998fdac` failure).
 * - Whether the class is actually RENDERED at runtime, in the right place, under
 *   the right conditions. A class that survives only in dead code or a stale CSS
 *   rule satisfies this scan.
 * - Attribute selectors, `hasText` filters, and every non-class targeting form.
 */

/** The class-name namespace this plugin owns; anything else in a selector is Obsidian's or React Flow's. */
const OWNED_CLASS_PREFIX = "vicinity-graph-";
/** CSS identifier tail: BEM `__`/`--` segments are covered by `\w` + `-`. */
const CLASS_NAME_TAIL = "[\\w-]+";
/**
 * e2e side: classes appear inside SELECTOR strings, so they carry the leading dot
 * (`page.locator(".vicinity-graph-node")`). The dot is what distinguishes a
 * selector from prose, so we require it here and strip it before comparing.
 */
const SELECTOR_CLASS_PATTERN = new RegExp(`\\.${OWNED_CLASS_PREFIX}${CLASS_NAME_TAIL}`, "g");
/**
 * src side: classes appear as bare string literals with NO dot (`className="…"`,
 * Obsidian's `{ cls: "…" }`) in `.tsx`/`.ts`, and WITH a dot only in `.css` rules.
 * Matching dotless covers both — requiring the dot here would falsely report every
 * JSX-only class as missing.
 */
const PRODUCED_CLASS_PATTERN = new RegExp(`${OWNED_CLASS_PREFIX}${CLASS_NAME_TAIL}`, "g");
/**
 * ABSENCE assertions ("this class must render nowhere") name a class that SHOULD
 * be gone from `src/view/` — exempting them is the whole point, otherwise the
 * breadcrumb guard at `vicinityGraph.e2e.ts` would be a permanent false positive.
 *
 * The exemption is line-scoped, which is sound because every `toHaveCount(0)` in
 * this repo is a single chained `expect(page.locator(SELECTOR)).toHaveCount(0)`
 * statement on one line. Its two honest limits:
 * - A split absence assertion (locator stored in a variable, asserted on a later
 *   line) is NOT exempted — the scan then fails LOUD with a message naming the
 *   line, never silently. `OFFENDER_REMEDIATION` tells the reader to re-chain
 *   it. Loud-and-wrong beats silent-and-wrong.
 * - A presence-asserted class sharing a line with an absence assertion is
 *   exempted too. Narrow, and it only ever UNDER-reports.
 */
const ABSENCE_ASSERTION_PATTERN = /toHaveCount\(\s*0\s*\)/;

const SCANNED_SOURCE_EXTENSIONS = [".ts", ".tsx", ".css"] as const;

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(E2E_DIR, "..");
const VIEW_DIR = path.join(REPO_ROOT, "src", "view");
/** This file's own fixtures name classes on purpose; scanning it would self-trip the guard. */
const SELF_FILE_NAME = path.basename(fileURLToPath(import.meta.url));

const OFFENDER_REMEDIATION = [
	"An e2e spec targets a .vicinity-graph-* class that src/view/ no longer produces —",
	"`npm run test:e2e` would go red. Either restore the class in src/view/,",
	"or update the e2e assertion to the class that replaced it.",
	"If the class is asserted ABSENT on purpose, keep the assertion as a single chained",
	"`expect(<locator>).toHaveCount(0)` on ONE line so this guard can exempt it.",
].join("\n");

/** A `.vicinity-graph-*` class an e2e source requires the plugin to render. */
interface AssertedSelectorClass {
	/** Bare class name, no leading dot — comparable against `src/view/` string literals. */
	readonly className: string;
	/** Repo-relative `file:line`, so a failure points straight at the assertion. */
	readonly location: string;
}

function sourceFilesUnder(dir: string): readonly string[] {
	return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && SCANNED_SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
		.map((entry) => path.join(entry.parentPath, entry.name));
}

/** Owned classes this line's selector strings target, excluding absence assertions. */
function assertedClassesOnLine(line: string): readonly string[] {
	if (ABSENCE_ASSERTION_PATTERN.test(line)) {
		return [];
	}
	return [...line.matchAll(SELECTOR_CLASS_PATTERN)].map((match) => match[0].slice(".".length));
}

function assertedSelectorClassesIn(source: string, fileLabel: string): readonly AssertedSelectorClass[] {
	return source.split("\n").flatMap((line, index) =>
		assertedClassesOnLine(line).map((className) => ({
			className,
			location: `${fileLabel}:${index + 1}`,
		})),
	);
}

/** Owned classes a `src/view/` source produces — as JSX/`cls` literals or as CSS rules. */
function producedClassesIn(source: string): readonly string[] {
	return [...source.matchAll(PRODUCED_CLASS_PATTERN)].map((match) => match[0]);
}

const assertedSelectorClasses: readonly AssertedSelectorClass[] = sourceFilesUnder(E2E_DIR)
	.filter((file) => path.basename(file) !== SELF_FILE_NAME)
	.flatMap((file) => assertedSelectorClassesIn(fs.readFileSync(file, "utf8"), path.relative(REPO_ROOT, file)));

const producedClasses: ReadonlySet<string> = new Set(
	sourceFilesUnder(VIEW_DIR).flatMap((file) => producedClassesIn(fs.readFileSync(file, "utf8"))),
);

describe("e2e selector guard", () => {
	it("WHEN scanning the e2e sources THEN they assert at least one owned class (guard is not vacuous)", () => {
		expect(assertedSelectorClasses.length).toBeGreaterThan(0);
	});

	it("WHEN scanning src/view THEN it produces at least one owned class (guard is not vacuous)", () => {
		expect(producedClasses.size).toBeGreaterThan(0);
	});

	it("WHEN an e2e source asserts an owned class THEN src/view still produces it", () => {
		const offenders = assertedSelectorClasses
			.filter((asserted) => !producedClasses.has(asserted.className))
			.map((asserted) => `${asserted.location} asserts .${asserted.className}, produced nowhere under src/view/`);
		expect(offenders, OFFENDER_REMEDIATION).toEqual([]);
	});
});

/**
 * The guard is only as good as its matcher. Fixtures are plain strings here —
 * safe because the scan above excludes this file by name.
 */
describe("e2e selector guard matcher", () => {
	it("WHEN a plain locator string is scanned THEN its class is extracted without the leading dot", () => {
		expect(assertedClassesOnLine('page.locator(".vicinity-graph-node")')).toEqual(["vicinity-graph-node"]);
	});

	it("WHEN a selector interpolates an attribute value THEN the static class prefix is still extracted", () => {
		expect(assertedClassesOnLine("page.locator(`.vicinity-graph-node[data-path=\"${path}\"]`)")).toEqual([
			"vicinity-graph-node",
		]);
	});

	it("WHEN a descendant selector mixes owned and foreign classes THEN only the owned one is extracted", () => {
		expect(assertedClassesOnLine('".vicinity-graph-flow .react-flow__edge-path"')).toEqual([
			"vicinity-graph-flow",
		]);
	});

	it("WHEN one selector chains several owned classes THEN every one is extracted", () => {
		expect(assertedClassesOnLine('".vicinity-graph-toolbar__body > .vicinity-graph-disclosure"')).toEqual([
			"vicinity-graph-toolbar__body",
			"vicinity-graph-disclosure",
		]);
	});

	it("WHEN a tag qualifies the class THEN the class is still extracted", () => {
		expect(assertedClassesOnLine('page.locator("button.vicinity-graph-attachment")')).toEqual([
			"vicinity-graph-attachment",
		]);
	});

	it("WHEN a line asserts a class is ABSENT THEN it is exempt from the guard", () => {
		expect(assertedClassesOnLine('await expect(page.locator(".vicinity-graph-gone")).toHaveCount(0);')).toEqual([]);
	});

	it("WHEN a line asserts a NON-ZERO count THEN it is not treated as an absence assertion", () => {
		expect(assertedClassesOnLine('await expect(page.locator(".vicinity-graph-node")).toHaveCount(2);')).toEqual([
			"vicinity-graph-node",
		]);
	});

	it("WHEN src renders a class as a dotless JSX literal THEN it counts as produced", () => {
		expect(producedClassesIn('<div className="vicinity-graph-sizing">')).toEqual(["vicinity-graph-sizing"]);
	});

	it("WHEN src declares a class only as a CSS rule THEN it counts as produced", () => {
		expect(producedClassesIn(".vicinity-graph-flow { height: 100%; }")).toEqual(["vicinity-graph-flow"]);
	});

	it("WHEN src names a class via Obsidian's cls option THEN it counts as produced", () => {
		expect(producedClassesIn('createDiv({ cls: "vicinity-graph-settings-section" })')).toEqual([
			"vicinity-graph-settings-section",
		]);
	});
});
