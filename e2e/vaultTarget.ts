import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Resolves WHICH vault the e2e harness drives, as a discriminated union.
 *
 * WHY a union rather than a `vaultDir` parameter: the default mode wipes and
 * re-copies its vault directory (`rm -rf` + `cpSync`). Modelling the override as
 * a SEPARATE variant means the destructive branch never even sees an external
 * path — pointing the suite at someone's real vault cannot delete it by
 * construction, not by convention.
 *
 * This module is pure: it validates (existence / directory / vault shape) and
 * NEVER creates, writes or deletes anything.
 */

/** Env var holding an absolute (or repo-root-relative) path to a vault to drive IN PLACE. */
export const VAULT_OVERRIDE_ENV_VAR = "VICINITY_E2E_VAULT";
/** Env var holding the vault-relative note path the external-vault spec opens. */
export const NOTE_OVERRIDE_ENV_VAR = "VICINITY_E2E_NOTE";

/** Default mode: throwaway copy of `.dev-vault`; the ONLY mode allowed to delete/seed files. */
export interface DevVaultCopyTarget {
	readonly mode: "dev-vault-copy";
	/** Read-only source (`<repo>/.dev-vault`). */
	readonly sourceDir: string;
	/** Wiped + re-created every launch (`<repo>/.tmp/e2e/vault`). */
	readonly copyDir: string;
}

/** Override mode: Obsidian opens the user's vault directly; the harness writes nothing into it. */
export interface ExternalVaultTarget {
	readonly mode: "external-in-place";
	readonly vaultDir: string;
}

export type VaultTarget = DevVaultCopyTarget | ExternalVaultTarget;

/** Vault dir Obsidian should open, regardless of mode. */
export function vaultDirOf(target: VaultTarget): string {
	return target.mode === "dev-vault-copy" ? target.copyDir : target.vaultDir;
}

/**
 * @param vaultOverride raw `VICINITY_E2E_VAULT` value (unset/empty ⇒ dev-vault copy mode).
 *   Relative paths resolve against `repoRoot` (`scripts/run-e2e.sh` runs from there).
 * @throws with an actionable message when the override is not a usable vault.
 */
export function resolveVaultTarget(vaultOverride: string | undefined, repoRoot: string): VaultTarget {
	if (vaultOverride === undefined || vaultOverride === "") {
		return {
			mode: "dev-vault-copy",
			sourceDir: path.join(repoRoot, ".dev-vault"),
			copyDir: path.join(repoRoot, ".tmp", "e2e", "vault"),
		};
	}
	const vaultDir = path.resolve(repoRoot, vaultOverride);
	if (!fs.existsSync(vaultDir)) {
		throw new Error(`${VAULT_OVERRIDE_ENV_VAR} does not exist: vaultDir=[${vaultDir}]`);
	}
	if (!fs.statSync(vaultDir).isDirectory()) {
		throw new Error(`${VAULT_OVERRIDE_ENV_VAR} is not a directory: vaultDir=[${vaultDir}]`);
	}
	if (!fs.existsSync(path.join(vaultDir, ".obsidian"))) {
		throw new Error(
			`${VAULT_OVERRIDE_ENV_VAR} is not an Obsidian vault (no .obsidian/): vaultDir=[${vaultDir}]\n` +
				"Open the folder once in Obsidian to initialise it, then re-run.",
		);
	}
	return { mode: "external-in-place", vaultDir };
}

/** Options a spec passes to `ObsidianHarness.launch`. */
export interface LaunchOptions {
	/** Extra `vaultRelativePath → content` notes seeded into the throwaway dev-vault copy. */
	readonly extraFixtures?: Record<string, string>;
	/**
	 * Per-spec opt-in to `VICINITY_E2E_VAULT`. Only set it in a spec that is
	 * VAULT-AGNOSTIC and changes no plugin settings — see
	 * {@link assertExternalLaunchAllowed}.
	 */
	readonly allowExternalVault?: true;
}

/**
 * Gates which specs may run against a real vault.
 *
 * WHY: the env var is global, so a bare `npm run test:e2e` with it exported would
 * point EVERY spec at the user's vault — and most of ours drive the app into
 * writing plugin state there (restore-defaults, exclusion patterns, pins).
 * The harness cannot delete that vault by construction, but Obsidian and the
 * plugin can still rewrite the human's saved settings, so external runs are
 * opt-in per spec rather than opt-out.
 */
export function assertExternalLaunchAllowed(vaultDir: string, options: LaunchOptions): void {
	if (options.allowExternalVault !== true) {
		throw new Error(
			`This spec is not vault-agnostic and would write plugin settings into your vault, so it refuses to run ` +
				`with ${VAULT_OVERRIDE_ENV_VAR}. vaultDir=[${vaultDir}]\n` +
				"Run only the spec that opts in:\n" +
				"  npm run test:e2e -- externalVault.e2e.ts",
		);
	}
	if (options.extraFixtures !== undefined) {
		throw new Error(
			`extraFixtures cannot be used with ${VAULT_OVERRIDE_ENV_VAR}: writing fixture notes would mutate ` +
				`your vault. vaultDir=[${vaultDir}]`,
		);
	}
}

/**
 * Requires the plugin to be ALREADY installed and enabled in an external vault.
 *
 * WHY pre-enablement rather than enabling it ourselves: (a) we only turn on the
 * community-plugins MASTER switch, which is sandbox-local and merely loads what
 * this vault's `community-plugins.json` already lists — so without the human's
 * own enablement nothing loads at all; and (b) loading our plugin code into a
 * vault where the human has not enabled it would start writing plugin state
 * (`data.json`) there behind their back.
 */
export function assertExternalVaultReady(vaultDir: string, pluginId: string, repoRoot: string): void {
	const pluginDir = path.join(vaultDir, ".obsidian", "plugins", pluginId);
	const mainJs = path.join(pluginDir, "main.js");
	if (!fs.existsSync(mainJs)) {
		throw new Error(
			`Plugin not installed in the ${VAULT_OVERRIDE_ENV_VAR} vault: file=[${mainJs}]\n` +
				// Per-artifact symlinks, NOT `ln -s <repoRoot> <pluginDir>`: with the repo AS the
				// plugin dir, Obsidian writes the vault's plugin state (data.json) into
				// the checkout.
				"Install it (symlinks keep it in sync with your builds):\n" +
				`  npm run build && mkdir -p ${pluginDir} && \\\n` +
				`    for f in main.js manifest.json styles.css; do ln -sf ${repoRoot}/$f ${pluginDir}/$f; done`,
		);
	}
	const communityPluginsFile = path.join(vaultDir, ".obsidian", "community-plugins.json");
	if (!fs.existsSync(communityPluginsFile) || !readEnabledPluginIds(communityPluginsFile).includes(pluginId)) {
		throw new Error(
			`Plugin not enabled in the ${VAULT_OVERRIDE_ENV_VAR} vault: file=[${communityPluginsFile}]\n` +
				`Enable "${pluginId}" in that vault's Settings → Community plugins (the harness deliberately\n` +
				"does not write to your vault's config), then re-run.",
		);
	}
}

/** `community-plugins.json` is a bare JSON array of enabled plugin ids. */
function readEnabledPluginIds(communityPluginsFile: string): readonly string[] {
	const parsed: unknown = JSON.parse(fs.readFileSync(communityPluginsFile, "utf8"));
	return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
}
