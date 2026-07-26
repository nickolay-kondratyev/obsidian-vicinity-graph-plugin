import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import { NOTE_OVERRIDE_ENV_VAR, VAULT_OVERRIDE_ENV_VAR } from "./vaultTarget";

/**
 * Repro harness for "the graph looks wrong in MY vault": drives an arbitrary
 * vault (`VICINITY_E2E_VAULT`) in place, opens one note in it
 * (`VICINITY_E2E_NOTE`) and screenshots the graph to `.out/` for eyeballing.
 *
 * NOT a regression test — it asserts only that a graph renders, because the
 * vault's content is unknown. It SKIPS entirely when the vault var is unset, so
 * the default suite is unaffected.
 *
 * Safety: the harness never writes into that vault (no copy, no wipe, no
 * fixtures). Obsidian itself still writes `.obsidian/workspace.json` and the
 * plugin's `data.json` there — see the README caveat.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");
const SCREENSHOT_PATH = path.join(OUT_DIR, "external-vault-graph.png");

const vaultDir = process.env[VAULT_OVERRIDE_ENV_VAR];
const notePath = process.env[NOTE_OVERRIDE_ENV_VAR];

test.describe.configure({ mode: "serial" });
test.skip(vaultDir === undefined || vaultDir === "", `set ${VAULT_OVERRIDE_ENV_VAR} to run this spec`);

let harness: ObsidianHarness;

test.beforeAll(async () => {
	if (notePath === undefined || notePath === "") {
		throw new Error(
			`${NOTE_OVERRIDE_ENV_VAR} is not set. Point it at a VAULT-RELATIVE note to centre the graph on, e.g.\n` +
				`  ${NOTE_OVERRIDE_ENV_VAR}='projects/some-note.md' ${VAULT_OVERRIDE_ENV_VAR}='${vaultDir}' npm run test:e2e -- externalVault.e2e.ts`,
		);
	}
	harness = await ObsidianHarness.launch();
	await harness.openGraphView();
	// openFile itself throws with the offending path when the note is missing.
	await harness.openFile(notePath);
});

test.afterAll(async () => {
	await harness?.close();
});

test(`WHEN ${VAULT_OVERRIDE_ENV_VAR} points at a vault THEN its graph renders and is screenshotted`, async () => {
	const flow = harness.page.locator(".vicinity-graph-flow");
	await expect(flow.locator(".vicinity-graph-node").first()).toBeVisible();
	fs.mkdirSync(OUT_DIR, { recursive: true });
	await flow.screenshot({ path: SCREENSHOT_PATH });
});
