import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SINGLE-SOURCE GUARD for "what is a settings default".
 *
 * `EngineDefaults.*Settings()` answers that question, and `settingsResetPlan.ts`
 * is the ONE module allowed to turn that answer into a user-visible restore.
 * A view module that calls a defaults factory itself becomes a second opinion on
 * what a default is — identical today, silently divergent the day a default
 * moves. That is exactly what the panel's force-layout "Restore defaults" button
 * was before this guard existed.
 *
 * Guarded as a source scan for the same reason `importGuard`, `selectorGuard`
 * and `vaultTarget` are: the repo has no ESLint, and an import rule must hold in
 * every module, not just the ones a rendered suite happens to mount.
 */

const VIEW_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Any of the five factories — `depth`/`view`/`sizing`/`forceLayout`/`nodeExclusion`.
 *
 * Matched against raw source, comments included. Deliberately conservative: a
 * prose mention of the call form inside a comment also trips this, which costs a
 * reword. Stripping comments first would instead risk a false NEGATIVE (a real
 * call trailing a string that contains `//`), and a guard that misses a call is
 * worth less than nothing. If this fires on prose, name the factory without its
 * parentheses.
 */
const DEFAULTS_CALL = /EngineDefaults\.[a-zA-Z]+Settings\s*\(/;

/**
 * The ONLY non-test view modules allowed to read a defaults factory directly.
 * Each entry states WHY, so the exemption is reviewable rather than arbitrary —
 * and the last test below fails if an entry outlives its call site, which is how
 * source-scan allowlists otherwise rot.
 */
const ALLOWED_MODULES: Readonly<Record<string, string>> = {
	// THE reset plan — this IS the single source every other module routes through.
	"settingsResetPlan.ts": "owns the restore-defaults contract",
	// A parameter default for a rendering fallback, not a settings write.
	"GraphLayoutRunner.ts": "parameter default for a layout fallback",
	// Pre-load placeholder state, before persistence has answered. Never user-visible.
	"GraphViewController.ts": "pre-load placeholder before persistence answers",
};

/**
 * Test modules are excluded deliberately, not incidentally: 12 view test files
 * legitimately build fixtures from these factories, so scanning them would make
 * the guard red for entirely correct reasons. `testFixtures/` is the same
 * exclusion one level up — test-support modules nothing in the plugin bundle
 * imports (e.g. `settingsPanelHarness.tsx` seeds component-test state from the
 * shipped defaults).
 */
function viewModulesUnderScan(): string[] {
	return readdirSync(VIEW_DIR, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
		.map((entry) => relative(VIEW_DIR, `${entry.parentPath}/${entry.name}`))
		.filter((module) => !module.startsWith("testFixtures/"));
}

function readsDefaultsFactory(module: string): boolean {
	return DEFAULTS_CALL.test(readFileSync(`${VIEW_DIR}/${module}`, "utf8"));
}

describe("EngineDefaults single-source guard", () => {
	it("WHEN src/view is scanned THEN only the allowlisted modules read EngineDefaults settings factories", () => {
		const offenders = viewModulesUnderScan().filter(
			(module) => readsDefaultsFactory(module) && ALLOWED_MODULES[module] === undefined,
		);
		expect(offenders).toEqual([]);
	});

	it("WHEN the scan runs THEN it finds view modules (the guard is not vacuous)", () => {
		expect(viewModulesUnderScan().length).toBeGreaterThan(0);
	});

	it("WHEN the allowlist is checked THEN every entry still reads a defaults factory (no stale exemption)", () => {
		const stale = Object.keys(ALLOWED_MODULES).filter((module) => !readsDefaultsFactory(module));
		expect(stale).toEqual([]);
	});
});
