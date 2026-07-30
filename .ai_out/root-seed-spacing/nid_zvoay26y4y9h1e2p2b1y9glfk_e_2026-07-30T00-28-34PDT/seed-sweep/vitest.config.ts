import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	root: fileURLToPath(new URL("../..", import.meta.url)),
	test: {
		include: [".tmp/seed-sweep/*.sweep.ts"],
		testTimeout: 600_000,
	},
});
