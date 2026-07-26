import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { assertExternalLaunchAllowed, assertExternalVaultReady, resolveVaultTarget, vaultDirOf } from "./vaultTarget";

/**
 * Guards the ONE safety property of the e2e vault override: an external vault is
 * never wiped, copied over or written into by the harness.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ID = "vicinity-graph";

// Repo-local scratch space (repo convention: temp files live in $PWD/.tmp).
fs.mkdirSync(path.join(REPO_ROOT, ".tmp"), { recursive: true });
const scratchRoot = fs.mkdtempSync(path.join(REPO_ROOT, ".tmp", "vault-target-test-"));
afterAll(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

/** Builds a scratch vault; `options` control how complete the plugin install is. */
function givenVaultDir(name: string, options: { installed?: boolean; enabled?: boolean } = {}): string {
	const vaultDir = path.join(scratchRoot, name);
	fs.mkdirSync(path.join(vaultDir, ".obsidian"), { recursive: true });
	if (options.installed === true) {
		const pluginDir = path.join(vaultDir, ".obsidian", "plugins", PLUGIN_ID);
		fs.mkdirSync(pluginDir, { recursive: true });
		fs.writeFileSync(path.join(pluginDir, "main.js"), "// stub\n");
	}
	if (options.enabled === true) {
		fs.writeFileSync(path.join(vaultDir, ".obsidian", "community-plugins.json"), JSON.stringify([PLUGIN_ID]));
	}
	return vaultDir;
}

describe("resolveVaultTarget", () => {
	it("WHEN the override is unset THEN it targets the throwaway dev-vault copy", () => {
		expect(resolveVaultTarget(undefined, REPO_ROOT)).toEqual({
			mode: "dev-vault-copy",
			sourceDir: path.join(REPO_ROOT, ".dev-vault"),
			copyDir: path.join(REPO_ROOT, ".tmp", "e2e", "vault"),
		});
	});

	it("WHEN the override is an empty string THEN it targets the throwaway dev-vault copy", () => {
		expect(resolveVaultTarget("", REPO_ROOT).mode).toBe("dev-vault-copy");
	});

	it("WHEN the override is a vault directory THEN it targets that vault in place", () => {
		const vaultDir = givenVaultDir("in-place");
		expect(resolveVaultTarget(vaultDir, REPO_ROOT)).toEqual({ mode: "external-in-place", vaultDir });
	});

	it("WHEN the override is set THEN the target carries NO directory the harness may wipe or copy over", () => {
		const target = resolveVaultTarget(givenVaultDir("no-copy-dir"), REPO_ROOT);
		expect(target).not.toHaveProperty("copyDir");
	});

	it("WHEN the override is relative THEN it resolves against the repo root", () => {
		const vaultDir = givenVaultDir("relative");
		expect(vaultDirOf(resolveVaultTarget(path.relative(REPO_ROOT, vaultDir), REPO_ROOT))).toBe(vaultDir);
	});

	it("WHEN the override path does not exist THEN it throws", () => {
		expect(() => resolveVaultTarget(path.join(scratchRoot, "nope"), REPO_ROOT)).toThrow(/does not exist/);
	});

	it("WHEN the override path is a file THEN it throws", () => {
		const filePath = path.join(scratchRoot, "a-file.md");
		fs.writeFileSync(filePath, "not a vault");
		expect(() => resolveVaultTarget(filePath, REPO_ROOT)).toThrow(/not a directory/);
	});

	it("WHEN the override directory has no .obsidian/ THEN it throws", () => {
		const notAVault = path.join(scratchRoot, "not-a-vault");
		fs.mkdirSync(notAVault, { recursive: true });
		expect(() => resolveVaultTarget(notAVault, REPO_ROOT)).toThrow(/not an Obsidian vault/);
	});
});

describe("assertExternalLaunchAllowed", () => {
	const vaultDir = "/home/someone/RealVault";

	it("WHEN a spec did not opt in THEN launching against an external vault is refused", () => {
		expect(() => assertExternalLaunchAllowed(vaultDir, {})).toThrow(/not vault-agnostic/);
	});

	it("WHEN a spec did not opt in THEN the refusal names the spec to run instead", () => {
		expect(() => assertExternalLaunchAllowed(vaultDir, {})).toThrow(/externalVault\.e2e\.ts/);
	});

	it("WHEN a spec opts in THEN it is allowed", () => {
		expect(() => assertExternalLaunchAllowed(vaultDir, { allowExternalVault: true })).not.toThrow();
	});

	it("WHEN an opted-in spec also passes fixtures THEN it is refused (fixtures would write notes into the vault)", () => {
		expect(() =>
			assertExternalLaunchAllowed(vaultDir, { allowExternalVault: true, extraFixtures: { "a.md": "x" } }),
		).toThrow(/extraFixtures/);
	});
});

describe("assertExternalVaultReady", () => {
	it("WHEN the plugin is installed and enabled THEN it passes", () => {
		const vaultDir = givenVaultDir("ready", { installed: true, enabled: true });
		expect(() => assertExternalVaultReady(vaultDir, PLUGIN_ID, REPO_ROOT)).not.toThrow();
	});

	it("WHEN the plugin bundle is missing THEN it throws with an install command", () => {
		const vaultDir = givenVaultDir("no-plugin", { enabled: true });
		expect(() => assertExternalVaultReady(vaultDir, PLUGIN_ID, REPO_ROOT)).toThrow(/ln -s/);
	});

	it("WHEN the plugin is installed but not enabled THEN it throws", () => {
		const vaultDir = givenVaultDir("not-enabled", { installed: true });
		expect(() => assertExternalVaultReady(vaultDir, PLUGIN_ID, REPO_ROOT)).toThrow(/not enabled/);
	});

	it("WHEN assertions run THEN the vault directory is left untouched", () => {
		const vaultDir = givenVaultDir("untouched", { installed: true, enabled: true });
		const before = listRecursively(vaultDir);
		assertExternalVaultReady(vaultDir, PLUGIN_ID, REPO_ROOT);
		expect(listRecursively(vaultDir)).toEqual(before);
	});
});

/**
 * `fs` members that cannot mutate anything. ALLOWLIST on purpose: anything not
 * listed here (`unlinkSync`, `renameSync`, a newly used API, …) counts as a
 * mutator and must prove its destination, so the guard bites for calls nobody
 * anticipated.
 */
const READ_ONLY_FS_MEMBERS = new Set(["existsSync", "statSync", "lstatSync", "realpathSync", "readFileSync", "readdirSync"]);
/**
 * Which argument positions of a mutator are paths it WRITES. Default `[0]`;
 * copy/link-shaped calls write their second argument (the first is a read
 * source), and `renameSync` writes both (it removes the original).
 */
const DESTINATION_ARG_INDICES: Record<string, readonly number[]> = {
	cpSync: [1],
	copyFileSync: [1],
	linkSync: [1],
	symlinkSync: [1],
	renameSync: [0, 1],
};
const DEFAULT_DESTINATION_ARG_INDICES: readonly number[] = [0];
/**
 * The only roots the node-side e2e code may write to: the throwaway vault copy
 * and sandbox config (`.tmp/e2e/`), plus the repo's screenshot dir (`.out/`).
 * None of them can ever BE the vault under `VICINITY_E2E_VAULT`.
 */
const SAFE_WRITE_ROOTS = /^(VAULT_COPY_DIR|SANDBOX_CONFIG_DIR|OUT_DIR)\b/;

describe("e2e harness destructive calls", () => {
	/**
	 * Source scan (same spirit as `src/engine/importGuard.test.ts`) over the
	 * node-side e2e sources: every mutating `fs` call must target one of the two
	 * throwaway `.tmp/e2e/` constants, so no code path can write to a real vault.
	 *
	 * Scope: node-side `fs` only. Writes Obsidian/the plugin perform in-app (via
	 * `page.evaluate`) are NOT visible here — those are governed by the
	 * `allowExternalVault` opt-in and the README caveat. This file itself is
	 * excluded: it deliberately builds scratch vaults under `.tmp/`.
	 */
	const scannedFiles = fs
		.readdirSync(path.join(REPO_ROOT, "e2e"))
		.filter((name) => name.endsWith(".ts") && name !== path.basename(import.meta.url));

	it("WHEN scanning the e2e sources THEN every mutating fs destination roots at a safe write dir", () => {
		const offenders = scannedFiles.flatMap((name) =>
			mutatingDestinations(fs.readFileSync(path.join(REPO_ROOT, "e2e", name), "utf8")).filter(
				// Peel `path.join(` / `path.dirname(` wrappers: what matters is the ROOT constant.
				(destination) => !SAFE_WRITE_ROOTS.test(destination.replace(/^(path\.(?:join|dirname|resolve)\()+/, "")),
			),
		);
		expect(offenders).toEqual([]);
	});

	it("WHEN scanning the e2e sources THEN none of them import the async fs API (which this scan cannot see)", () => {
		const importers = scannedFiles.filter((name) =>
			/from "node:fs\/promises"|require\("node:fs\/promises"\)/.test(fs.readFileSync(path.join(REPO_ROOT, "e2e", name), "utf8")),
		);
		expect(importers).toEqual([]);
	});

	it("WHEN scanning a harness that wrote to an arbitrary path THEN the scan reports it", () => {
		expect(mutatingDestinations('fs.unlinkSync(path.join(target.vaultDir, "note.md"));')).toEqual([
			'path.join(target.vaultDir, "note.md")',
		]);
	});
});

/**
 * Paths every non-read-only `fs.*` call in `source` writes to, as written in the
 * source text (arg 1, plus arg 2 for two-path mutators).
 */
function mutatingDestinations(source: string): readonly string[] {
	const destinations: string[] = [];
	for (const call of source.matchAll(/fs\.(\w+)\(/g)) {
		const member = call[1] ?? "";
		if (READ_ONLY_FS_MEMBERS.has(member)) {
			continue;
		}
		const args = topLevelArguments(source.slice(call.index + call[0].length));
		for (const index of DESTINATION_ARG_INDICES[member] ?? DEFAULT_DESTINATION_ARG_INDICES) {
			destinations.push(args[index] ?? "");
		}
	}
	return destinations;
}

/** Splits an argument list (text AFTER the opening paren) on commas at nesting depth 0. */
function topLevelArguments(afterOpenParen: string): readonly string[] {
	const args: string[] = [];
	let depth = 0;
	let current = "";
	for (const character of afterOpenParen) {
		if (character === ")" && depth === 0) {
			break;
		}
		if (character === "," && depth === 0) {
			args.push(current.trim());
			current = "";
			continue;
		}
		if ("([{".includes(character)) {
			depth += 1;
		}
		if (")]}".includes(character)) {
			depth -= 1;
		}
		current += character;
	}
	args.push(current.trim());
	return args;
}

function listRecursively(dir: string): readonly string[] {
	return fs
		.readdirSync(dir, { recursive: true })
		.map((entry) => String(entry))
		.sort();
}
