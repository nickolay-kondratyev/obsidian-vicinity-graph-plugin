import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards `scripts/run-all-tests.sh`, the `npm run test:all` backend.
 *
 * WHY an EXECUTED guard, not only a source scan: the script's whole contract is
 * honest EXIT CODES — a failed stage must surface as the STAGE's own status, never
 * a flat `exit 1` (a wrapper that rewrites the code its child failed with hides
 * what tsc/Playwright reported). Only running it conveys that, exactly why the
 * run-e2e-floor refusal guard in `e2e/obsidianVersionKnob.test.ts` executes
 * rather than scans.
 *
 * WHY `npm` is stubbed as an EXPORTED bash function and not as a file on PATH:
 * the e2e source scan in `e2e/vaultTarget.test.ts` forbids mutating `fs` calls
 * outside the harness's sandbox roots, and a fake-npm FILE would have to live
 * somewhere — rooting it in `.tmp/e2e/` or `.out/` would be a semantic lie about
 * what those dirs are. An exported function writes nothing and shadows the real
 * `npm` (functions resolve before PATH binaries), so the real suite never starts.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN_ALL_SCRIPT = path.join(REPO_ROOT, "scripts", "run-all-tests.sh");

/**
 * A `npm` stub whose stage call exits with a per-stage code from the env
 * (`FAKE_NPM_*_EXIT`, default 0). Exported so the child bash running
 * run-all-tests.sh sees it as a function.
 */
const FAKE_NPM_FUNCTION = `npm() {
  case "$*" in
    "run check") return "\${FAKE_NPM_CHECK_EXIT:-0}" ;;
    "test") return "\${FAKE_NPM_TEST_EXIT:-0}" ;;
    "run test:e2e") return "\${FAKE_NPM_E2E_EXIT:-0}" ;;
    "run test:e2e:floor") return "\${FAKE_NPM_FLOOR_EXIT:-0}" ;;
    *) echo "fake-npm: unexpected args: $*" >&2; return 125 ;;
  esac
}
export -f npm`;

/** Run run-all-tests.sh with the stubbed npm and return its exit status. */
function runAllStatus(args: readonly string[], stageExits: Record<string, number>): number {
	const env: NodeJS.ProcessEnv = { ...process.env };
	for (const [key, value] of Object.entries(stageExits)) {
		env[key] = String(value);
	}
	const command = `${FAKE_NPM_FUNCTION}\nexec bash "${RUN_ALL_SCRIPT}" ${args.map((arg) => `'${arg}'`).join(" ")}`;
	try {
		execFileSync("bash", ["-c", command], {
			env,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			timeout: 20_000,
			killSignal: "SIGKILL",
		});
		return 0;
	} catch (err) {
		return (err as { status?: number }).status ?? -1;
	}
}

describe("scripts/run-all-tests.sh", () => {
	it("WHEN the check stage exits 42 THEN the script exits 42 — the stage's own code, not a flat 1", () => {
		// Distinct codes for every later stage: 42 can only be the check failure,
		// which proves BOTH code preservation AND that the script stops there.
		expect(runAllStatus([], { FAKE_NPM_CHECK_EXIT: 42, FAKE_NPM_TEST_EXIT: 7, FAKE_NPM_E2E_EXIT: 11 })).toBe(42);
	});

	it("WHEN check passes and the vitest stage exits 7 THEN the script exits 7", () => {
		expect(runAllStatus([], { FAKE_NPM_TEST_EXIT: 7, FAKE_NPM_E2E_EXIT: 11 })).toBe(7);
	});

	it("WHEN an unknown flag is passed THEN the script exits 2", () => {
		expect(runAllStatus(["--bogus"], {})).toBe(2);
	});

	it("WHEN --with-floor is passed and the floor stage exits 9 THEN the script exits 9", () => {
		expect(runAllStatus(["--with-floor"], { FAKE_NPM_FLOOR_EXIT: 9 })).toBe(9);
	});

	it("WHEN --with-floor is omitted THEN the floor stage never runs", () => {
		// The floor stage would exit 9 if invoked; exit 0 proves it was not reached.
		expect(runAllStatus([], { FAKE_NPM_FLOOR_EXIT: 9 })).toBe(0);
	});

	it("WHEN read THEN the stages are ordered cheapest-first: check → vitest → e2e", () => {
		const script = fs.readFileSync(RUN_ALL_SCRIPT, "utf8");
		const check = script.indexOf('run_stage "check');
		const unit = script.indexOf('run_stage "unit');
		const e2e = script.indexOf('run_stage "e2e');
		expect(check).toBeGreaterThanOrEqual(0);
		expect(unit).toBeGreaterThan(check);
		expect(e2e).toBeGreaterThan(unit);
	});
});
