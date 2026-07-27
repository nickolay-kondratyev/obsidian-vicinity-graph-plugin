import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the ONE consistency property of the throwaway vault copy's plugin-state
 * reseed: the per-doc persistence dir the harness wipes must be the dir the plugin
 * actually writes. The name is spelled twice today — once by the plugin (the
 * authoritative producer) and once by the harness — so a rename on the plugin side
 * that the harness does not follow silently re-introduces the leak this wipe closes
 * (a pin made during manual `.dev-vault` QA reaching an e2e run) with nothing else
 * failing.
 *
 * WHY a stringly-typed source scan instead of one shared constant: sharing it needs a
 * RUNTIME import from `src/` into the node-side harness process (`e2e/` imports from
 * `src/` type-only today, and `src/persistence/` has no barrel) — a new precedent,
 * deliberately deferred to ticket `nid_7fq9y51mbucmduzf9z31hmwmq_e`. DELETE this guard
 * when that ticket lands: the shared constant makes it redundant.
 *
 * Read-only by construction (`readFileSync` only), so the destructive-call source scan
 * in `vaultTarget.test.ts` — which also covers this file — stays satisfied.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Matches `` return `${pluginDir}/doc-data`; `` in `VicinityGraphPlugin.docDataDirPath()`. */
const DOC_DATA_DIR_IN_PLUGIN_SOURCE = /\$\{pluginDir\}\/([\w-]+)`/;

/** The per-doc dir name as the PLUGIN spells it; throws loudly if its shape moved. */
function docDataDirNameFromPluginSource(): string {
	const pluginSource = fs.readFileSync(path.join(REPO_ROOT, "src", "main.ts"), "utf8");
	const dirName = pluginSource.match(DOC_DATA_DIR_IN_PLUGIN_SOURCE)?.[1];
	if (dirName === undefined) {
		throw new Error(
			`Cannot find the per-doc dir name in src/main.ts: pattern=[${DOC_DATA_DIR_IN_PLUGIN_SOURCE.source}]. ` +
				"If docDataDirPath() was refactored, update this guard (or delete it once the shared constant exists).",
		);
	}
	return dirName;
}

describe("e2e vault-copy reseed", () => {
	it("WHEN the plugin's per-doc dir name changes THEN the e2e vault-copy wipe names the same dir", () => {
		const harnessSource = fs.readFileSync(path.join(REPO_ROOT, "e2e", "obsidianHarness.ts"), "utf8");
		expect(harnessSource).toContain(`PLUGIN_ID, "${docDataDirNameFromPluginSource()}"`);
	});
});
