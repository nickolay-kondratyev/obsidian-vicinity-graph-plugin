import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only OUR tests. The submodule's suite needs its own setup (obsidian
		// runtime mock alias, own devDeps) and runs via `npm run test:sublib`.
		// `e2e/**/*.test.ts` = pure unit tests for e2e HELPERS (no Obsidian, no
		// browser); Playwright only picks up `*.e2e.ts`, so the two never overlap.
		include: ["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"],
		coverage: {
			// v8 matches the runtime we ship on; no separate instrumentation step.
			provider: "v8",
			// Report from every shipped source module, so files with NO test at
			// all still show as 0% instead of vanishing from the totals.
			all: true,
			include: ["src/**/*.{ts,tsx}"],
			// Tests, test-only harnesses/fakes, barrels and the plugin entry are
			// not behavior we assert coverage on.
			exclude: [
				"src/**/*.test.{ts,tsx}",
				"src/**/testFixtures/**",
				"src/**/*.d.ts",
				"src/**/index.ts",
				"src/main.ts",
			],
			reportsDirectory: "coverage",
			// `json`/`json-summary` = machine-consumable (CI, dashboards);
			// `text` = console glance; `html`/`lcov` = human + external tooling.
			reporter: ["text", "json", "json-summary", "html", "lcov"],
		},
	},
});
