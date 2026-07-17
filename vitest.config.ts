import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only OUR tests. The submodule's suite needs its own setup (obsidian
		// runtime mock alias, own devDeps) and runs via `npm run test:sublib`.
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
