import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { settingsWriteScope } from "./settingsWriteScope";

/**
 * One test per {@link SettingsCommand} kind: the classifier is the single place
 * that decides whether a write refreshes every open view, so each kind's verdict
 * is pinned individually rather than through a table that a wrong entry could
 * hide in.
 */
describe("settingsWriteScope", () => {
	it("WHEN the command writes MAIN's own depth field THEN the scope is per-doc", () => {
		expect(settingsWriteScope({ kind: "doc-depth-field", field: "outgoingDepth", value: 2 })).toBe("per-doc");
	});

	it("WHEN the command writes a pinned central's depth field THEN the scope is per-doc", () => {
		expect(
			settingsWriteScope({
				kind: "central-depth-field",
				centralDocid: "docid_a_e",
				field: "outgoingDepth",
				value: 2,
			}),
		).toBe("per-doc");
	});

	it("WHEN the command writes the global depths THEN the scope is global", () => {
		expect(settingsWriteScope({ kind: "global-depths", depths: EngineDefaults.depthSettings() })).toBe("global");
	});

	it("WHEN the command writes the global view settings THEN the scope is global", () => {
		expect(settingsWriteScope({ kind: "global-view", view: EngineDefaults.viewSettings() })).toBe("global");
	});

	it("WHEN the command writes the node exclusion settings THEN the scope is global", () => {
		expect(
			settingsWriteScope({ kind: "node-exclusion", nodeExclusion: EngineDefaults.nodeExclusionSettings() }),
		).toBe("global");
	});
});
