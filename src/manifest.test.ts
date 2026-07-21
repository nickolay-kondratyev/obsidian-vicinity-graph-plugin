import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

// GIVEN the committed manifest.json (single source of truth: esbuild.config.mjs derives
// the dev-vault plugin dir from manifest.id, and Obsidian matches folder name to id).
describe("manifest.json", () => {
	it("WHEN read THEN the plugin id is the approved 'vicinity-graph'", () => {
		expect(manifest.id).toBe("vicinity-graph");
	});

	// WHY 1.12.4: first public release with core canvas link indexing (see src/main.ts note).
	// A floor only — bump deliberately, never add an upper bound.
	it("WHEN read THEN minAppVersion is the approved floor 1.12.4", () => {
		expect(manifest.minAppVersion).toBe("1.12.4");
	});
});
