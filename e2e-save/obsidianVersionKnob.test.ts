import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

/**
 * Guards the drift risks of running e2e against more than one Obsidian build:
 * the DEFAULT run must stay reproducible (the pinned build below), the FLOOR run
 * must be the manifest's `minAppVersion` — derived, never a second literal — and
 * `test:e2e:floor` must never report a pass it did not obtain on the floor.
 *
 * Bumping the pinned default is a deliberate act: edit the script, then this ONE
 * constant. It is named once here so a bump can never half-land inside this file.
 */
const PINNED_DEFAULT_VERSION = "1.12.7";
const OVERRIDABLE_DEFAULT_LINE = `OBSIDIAN_VERSION="\${OBSIDIAN_VERSION:-${PINNED_DEFAULT_VERSION}}"`;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupScript = readRepoFile("scripts", "setup-obsidian-bin.sh");

describe("scripts/setup-obsidian-bin.sh", () => {
	/**
	 * Source scan (WHY-NOT executing it: every other path in that script downloads
	 * ~200MB or fails on the network). The exact `:-` default form is what makes the
	 * version BOTH overridable and pinned, so assert the form itself.
	 */
	it("WHEN read THEN OBSIDIAN_VERSION is an env knob defaulting to the pinned build", () => {
		expect(setupScript).toContain(OVERRIDABLE_DEFAULT_LINE);
	});

	it("WHEN read THEN it names the pinned version exactly once (no second literal to drift)", () => {
		expect(countOccurrences(setupScript, PINNED_DEFAULT_VERSION)).toBe(1);
	});
});

describe("docs-internal/notes/e2e-obsidian-docker-setup.md", () => {
	/** The note quotes the default line verbatim, so a bump that skips it makes the note lie. */
	it("WHEN read THEN it quotes the pinned default the script actually declares", () => {
		expect(readRepoFile("docs-internal", "notes", "e2e-obsidian-docker-setup.md")).toContain(
			OVERRIDABLE_DEFAULT_LINE,
		);
	});
});

describe("scripts/obsidian-floor-version.sh", () => {
	it("WHEN run THEN it prints the manifest's minAppVersion", () => {
		expect(runScript("obsidian-floor-version.sh")).toBe(manifest.minAppVersion);
	});
});

describe("scripts/run-e2e-floor.sh", () => {
	const floorRunScript = readRepoFile("scripts", "run-e2e-floor.sh");

	it("WHEN read THEN it names NO version literal (the floor comes from the manifest)", () => {
		expect(floorRunScript).not.toMatch(/\d+\.\d+\.\d+/);
	});

	it("WHEN read THEN it exports OBSIDIAN_VERSION so the setup script downloading the binary sees it", () => {
		expect(floorRunScript).toContain("export OBSIDIAN_VERSION");
	});

	/**
	 * The honesty guard: run-e2e.sh honours a set OBSIDIAN_PATH, so proceeding would
	 * run SOME OTHER build and exit 0 — a floor pass that never touched the floor.
	 * Executed, not scanned, because only the exit code carries that meaning. The
	 * timeout bounds the blast radius if the refusal ever regresses (the script would
	 * then `exec` the real suite from inside `npm test`).
	 */
	it("WHEN run with OBSIDIAN_PATH set THEN it refuses instead of running a non-floor build", () => {
		expect(() =>
			runScript("run-e2e-floor.sh", { OBSIDIAN_PATH: "/nonexistent/obsidian-floor-guard" }),
		).toThrowError(/REFUSING/);
	});
});

describe("release_update_tag.sh", () => {
	const releaseScript = readRepoFile("release_update_tag.sh");

	/**
	 * release_update_tag.sh is the release driver whose test gate makes the
	 * floor+pinned pair a matrix (before it bumps + tags). Running BOTH builds is
	 * the whole point of that gate, so guard that it invokes each arm — a silent
	 * drop of either would turn a "two-version gate" back into one.
	 */
	it("WHEN read THEN it runs the pinned-default e2e arm", () => {
		// Match the pinned INVOCATION, not a bare `npm run test:e2e`: that bare
		// substring also lives inside the floor line (`npm run test:e2e:floor`),
		// so a bare `.toContain` would still pass with the pinned arm deleted —
		// the exact silent drop this test claims to guard against.
		expect(releaseScript).toContain("npm run test:e2e || pinned_status=$?");
	});

	it("WHEN read THEN it runs the manifest-floor e2e arm", () => {
		expect(releaseScript).toContain("npm run test:e2e:floor");
	});

	/**
	 * The matrix must survive a red FIRST arm to report the full floor-vs-pinned
	 * picture; a fail-fast between arms would hide whether the floor is also broken.
	 * `|| ..._status=$?` is how each arm is run without `set -e` aborting the script.
	 */
	it("WHEN read THEN each e2e arm is run without aborting the run on failure", () => {
		expect(releaseScript).toContain("|| pinned_status=$?");
		expect(releaseScript).toContain("|| floor_status=$?");
	});
});

function readRepoFile(...segments: readonly string[]): string {
	return fs.readFileSync(path.join(REPO_ROOT, ...segments), "utf8");
}

function runScript(name: string, extraEnv: NodeJS.ProcessEnv = {}): string {
	return execFileSync("bash", [path.join(REPO_ROOT, "scripts", name)], {
		encoding: "utf8",
		env: { ...process.env, ...extraEnv },
		killSignal: "SIGKILL",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 20_000,
	}).trim();
}

function countOccurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}
