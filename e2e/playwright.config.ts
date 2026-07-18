import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the release-time e2e suite (step-05 Phase C).
 *
 * The suite drives ONE real Obsidian (Electron) instance on a throwaway copy
 * of `.dev-vault` — see `obsidianHarness.ts`. It is intentionally NOT part of
 * `npm test` (unit gate stays fast and hermetic); run it via `npm run test:e2e`
 * with `OBSIDIAN_PATH` pointing at an Obsidian binary.
 */

/** Booting a desktop Electron app + vault index is slow; unit-test timeouts don't apply. */
const TEST_TIMEOUT_MS = 120_000;
/** Graph rebuilds ride a 500ms debounce + metadata reindex; expect-retries need headroom. */
const EXPECT_TIMEOUT_MS = 15_000;

export default defineConfig({
	testDir: ".",
	testMatch: "**/*.e2e.ts",
	timeout: TEST_TIMEOUT_MS,
	expect: { timeout: EXPECT_TIMEOUT_MS },
	// One Obsidian instance, serial tests — parallel workers would fight over
	// the singleton app window and the vault copy.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	reporter: [["list"]],
	outputDir: "../.tmp/e2e-artifacts",
});
