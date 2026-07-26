import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { assertExternalVaultReady, resolveVaultTarget, vaultDirOf } from "./vaultTarget";

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

describe("obsidianHarness destructive calls", () => {
	/**
	 * Source scan (same spirit as `src/engine/importGuard.test.ts`): every
	 * mutating fs call's DESTINATION in the harness must be one of the two
	 * throwaway `.tmp/e2e/` constants, so no code path can reach a real vault.
	 */
	it("WHEN scanning the harness THEN every mutating fs destination is a throwaway .tmp/e2e dir", () => {
		const source = fs.readFileSync(path.join(REPO_ROOT, "e2e", "obsidianHarness.ts"), "utf8");
		// rmSync/mkdirSync/writeFileSync take their target as arg 1; cpSync's
		// destination is arg 2 (its arg 1 is a read-only source).
		const destinations = [
			...source.matchAll(/fs\.(?:rmSync|mkdirSync|writeFileSync)\(([^,)]+)/g),
			...source.matchAll(/fs\.cpSync\([^,]+,\s*([^,)]+)/g),
		].map((match) => match[1]?.trim() ?? "");
		expect(destinations.length).toBeGreaterThan(0);
		for (const destination of destinations) {
			// Peel any `path.join(` / `path.dirname(` wrappers: what matters is the ROOT constant.
			const rootConstant = destination.replace(/^(path\.(?:join|dirname)\()+/, "");
			expect(rootConstant).toMatch(/^(VAULT_COPY_DIR|SANDBOX_CONFIG_DIR)\b/);
		}
	});
});

function listRecursively(dir: string): readonly string[] {
	return fs
		.readdirSync(dir, { recursive: true })
		.map((entry) => String(entry))
		.sort();
}
