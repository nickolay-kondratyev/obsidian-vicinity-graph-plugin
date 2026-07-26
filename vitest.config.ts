import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only OUR tests. The submodule's suite needs its own setup (obsidian
		// runtime mock alias, own devDeps) and runs via `npm run test:sublib`.
		// `e2e/**/*.test.ts` = pure unit tests for e2e HELPERS (no Obsidian, no
		// browser); Playwright only picks up `*.e2e.ts`, so the two never overlap.
		include: ["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"],
	},
});
