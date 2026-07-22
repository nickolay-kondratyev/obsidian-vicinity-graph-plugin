import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

/**
 * THROWAWAY — Phase 0 spike e2e for ticket edge-routing__00-wasm-spike
 * (nid_pgsj1vjjnmtflf55a4sd9txos_e). Delete alongside the spike command in Phase 1.
 *
 * The ONE thing the vitest spike (node build) cannot reach: proving the base64/
 * data-URL wasm actually loads and routes INSIDE real Obsidian/Electron with NO
 * network. We block all http(s)/ws traffic in the renderer, run the plugin's spike
 * command, and assert the structured result it stashes on `window.__vicinitySpikeResult`.
 * data: URLs are not network requests, so a successful load under a network blackhole
 * is the offline proof.
 */
test.describe.configure({ mode: "serial" });

const SPIKE_COMMAND_ID = `${PLUGIN_ID}:debug-spike-libavoid-routing`;

interface SpikeResult {
	ok: boolean;
	loadPath?: string;
	error?: string;
	obstacle?: { pointCount: number; anyPointInsideObstacle: boolean };
	nested?: { pointCount: number; startsAtChildCentre: boolean; avoidsOutsideObstacle: boolean };
	stress?: { completed: number; allProducedValidRoute: boolean };
}

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
});

test.afterAll(async () => {
	await harness?.close();
});

test("libavoid wasm loads OFFLINE from embedded base64 and routes inside Obsidian", async () => {
	// Network blackhole: any http(s)/ws fetch fails. The wasm is a data: URL, so it
	// must still load — proving zero network dependency.
	await page.route("**/*", (route) => {
		const url = route.request().url();
		if (/^https?:/.test(url) || /^wss?:/.test(url)) {
			return route.abort();
		}
		return route.continue();
	});

	const executed = await page.evaluate(
		(commandId) => (window as unknown as { app: any }).app.commands.executeCommandById(commandId),
		SPIKE_COMMAND_ID,
	);
	expect(executed, "spike command should be registered and invoked").toBe(true);

	// The command's callback is async fire-and-forget; wait for it to stash its result.
	await page.waitForFunction(
		() => (window as unknown as { __vicinitySpikeResult?: unknown }).__vicinitySpikeResult !== undefined,
		undefined,
		{ timeout: 30_000 },
	);

	const result = (await page.evaluate(
		() => (window as unknown as { __vicinitySpikeResult?: SpikeResult }).__vicinitySpikeResult,
	)) as SpikeResult;

	expect(result.ok, `spike failed: ${result.error ?? "unknown"}`).toBe(true);
	expect(result.loadPath).toBe("data-url");
	// Scenario (a): routes around the obstacle.
	expect(result.obstacle?.pointCount).toBeGreaterThan(2);
	expect(result.obstacle?.anyPointInsideObstacle).toBe(false);
	// Scenario (b): nested child routes out and avoids outside obstacles.
	expect(result.nested?.startsAtChildCentre).toBe(true);
	expect(result.nested?.avoidsOutsideObstacle).toBe(true);
	// Scenario (c): 100x create/destroy, no crash.
	expect(result.stress?.completed).toBe(100);
	expect(result.stress?.allProducedValidRoute).toBe(true);
});
