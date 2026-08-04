import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

/**
 * Guards the ONE drift risk of running e2e against more than one Obsidian build:
 * the DEFAULT run must stay reproducible (pinned 1.12.7), and the FLOOR run must
 * be the manifest's `minAppVersion` — derived, never a second literal.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupScript = fs.readFileSync(path.join(REPO_ROOT, "scripts", "setup-obsidian-bin.sh"), "utf8");

describe("scripts/setup-obsidian-bin.sh", () => {
	/**
	 * Source scan (WHY-NOT executing it: every other path in that script downloads
	 * ~200MB or fails on the network). The exact `:-` default form is what makes the
	 * version BOTH overridable and pinned, so assert the form itself.
	 */
	it("WHEN read THEN OBSIDIAN_VERSION is an env knob defaulting to the pinned build", () => {
		expect(setupScript).toContain('OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"');
	});

	it("WHEN read THEN it declares the pinned default exactly once (no second literal to drift)", () => {
		expect(setupScript.match(/OBSIDIAN_VERSION="[^"]*1\.12\.7/g)).toHaveLength(1);
	});
});

describe("scripts/obsidian-floor-version.sh", () => {
	it("WHEN run THEN it prints the manifest's minAppVersion", () => {
		expect(runFloorVersionScript()).toBe(manifest.minAppVersion);
	});
});

describe("scripts/run-e2e-floor.sh", () => {
	const floorRunScript = fs.readFileSync(path.join(REPO_ROOT, "scripts", "run-e2e-floor.sh"), "utf8");

	it("WHEN read THEN it names NO version literal (the floor comes from the manifest)", () => {
		expect(floorRunScript).not.toMatch(/\d+\.\d+\.\d+/);
	});

	it("WHEN read THEN it exports OBSIDIAN_VERSION so the setup script downloading the binary sees it", () => {
		expect(floorRunScript).toContain("export OBSIDIAN_VERSION");
	});
});

function runFloorVersionScript(): string {
	return execFileSync("bash", [path.join(REPO_ROOT, "scripts", "obsidian-floor-version.sh")], {
		encoding: "utf8",
	}).trim();
}
