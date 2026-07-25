import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { TraversalSettingsResolver } from "./TraversalSettingsResolver";
import type { PinnedViewOverride } from "./ViewSettingsResolver";
import { ViewSettingsResolver } from "./ViewSettingsResolver";
import type { SizingSettings, ViewSettings, ViewSettingsOverride } from "./types";
import { asDocId, asVaultPath } from "./types";

// GIVEN a global depth default of outgoing 1 / incoming 1 (EngineDefaults)
describe("TraversalSettingsResolver (depth cascade: own doc override -> global)", () => {
	const global = EngineDefaults.depthSettings();

	it("WHEN a root has no override THEN both fields inherit the global default", () => {
		expect(TraversalSettingsResolver.resolveForRoot(global)).toEqual({ outgoingDepth: 1, incomingDepth: 1 });
	});

	it("WHEN only outgoingDepth is overridden THEN incomingDepth still inherits", () => {
		expect(TraversalSettingsResolver.resolveForRoot(global, { outgoingDepth: 3 })).toEqual({
			outgoingDepth: 3,
			incomingDepth: 1,
		});
	});

	it("WHEN only incomingDepth is overridden THEN outgoingDepth still inherits", () => {
		expect(TraversalSettingsResolver.resolveForRoot(global, { incomingDepth: 4 })).toEqual({
			outgoingDepth: 1,
			incomingDepth: 4,
		});
	});

	it("WHEN both fields are overridden THEN the global default is fully shadowed", () => {
		expect(TraversalSettingsResolver.resolveForRoot(global, { outgoingDepth: 2, incomingDepth: 0 })).toEqual({
			outgoingDepth: 2,
			incomingDepth: 0,
		});
	});

	it("WHEN an override pins a value equal to zero THEN zero is honored (presence = pinned)", () => {
		expect(TraversalSettingsResolver.resolveForRoot(global, { outgoingDepth: 0 }).outgoingDepth).toBe(0);
	});
});

function pinned(
	path: string,
	docid: string,
	pinTimestamp: number,
	override: ViewSettingsOverride,
): PinnedViewOverride {
	return { descriptor: { path: asVaultPath(path), docid: asDocId(docid), pinTimestamp }, override };
}

function customSizing(minPx: number): SizingSettings {
	return { ...EngineDefaults.sizingSettings(), minPx };
}

// GIVEN the global view settings (cap 100, groupByFolder true, default sizing)
describe("ViewSettingsResolver cascade layers", () => {
	const global: ViewSettings = EngineDefaults.viewSettings();

	it("WHEN there are no overrides THEN global settings pass through unchanged", () => {
		expect(ViewSettingsResolver.resolve({ global })).toEqual(global);
	});

	it("WHEN MAIN pins a field THEN it beats both pinned docs and global", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			mainOverride: { nodeCap: 25 },
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { nodeCap: 50 })],
		});
		expect(resolved.nodeCap).toBe(25);
	});

	it("WHEN MAIN leaves a field unset THEN a pinned doc fills the gap", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			mainOverride: { nodeCap: 25 },
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { groupByFolder: false })],
		});
		expect(resolved.groupByFolder).toBe(false);
	});

	it("WHEN neither MAIN nor pinned docs pin a field THEN global supplies it", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			mainOverride: { nodeCap: 25 },
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { groupByFolder: false })],
		});
		expect(resolved.sizing).toEqual(global.sizing);
	});

	it("WHEN MAIN pins the sizing object THEN the whole sizing field is taken from MAIN", () => {
		const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { sizing: customSizing(5) } });
		expect(resolved.sizing.minPx).toBe(5);
	});

	it("WHEN a boolean field is pinned to false THEN false is honored (presence = pinned)", () => {
		const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { groupByFolder: false } });
		expect(resolved.groupByFolder).toBe(false);
	});

	it("WHEN MAIN pins the forceLayout object THEN the whole forceLayout field is taken from MAIN", () => {
		const mainForceLayout = { ...EngineDefaults.forceLayoutSettings(), linkGapPx: 90 };
		const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { forceLayout: mainForceLayout } });
		expect(resolved.forceLayout).toEqual(mainForceLayout);
	});

	it("WHEN only a pinned doc pins forceLayout THEN it fills the gap over global", () => {
		const pinnedForceLayout = { ...EngineDefaults.forceLayoutSettings(), repelStrength: 500 };
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { forceLayout: pinnedForceLayout })],
		});
		expect(resolved.forceLayout.repelStrength).toBe(500);
	});

	it("WHEN MAIN pins edgeVisibility THEN it beats both pinned docs and global", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			mainOverride: { edgeVisibility: "walked-from-center" },
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { edgeVisibility: "all-edges" })],
		});
		expect(resolved.edgeVisibility).toBe("walked-from-center");
	});

	it("WHEN only a pinned doc pins edgeVisibility THEN it fills the gap", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { edgeVisibility: "walked-from-center" })],
		});
		expect(resolved.edgeVisibility).toBe("walked-from-center");
	});
});

describe("ViewSettingsResolver multi-pin conflicts (via the shared priority chain)", () => {
	const global: ViewSettings = EngineDefaults.viewSettings();

	it("WHEN two pinned docs pin the same field THEN the most recently pinned wins", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [
				pinned("old.md", "docid_old_e", 100, { nodeCap: 11 }),
				pinned("new.md", "docid_new_e", 200, { nodeCap: 22 }),
			],
		});
		expect(resolved.nodeCap).toBe(22);
	});

	it("WHEN pin timestamps tie THEN the lexicographically smaller docid wins", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [
				pinned("b.md", "docid_bbb_e", 100, { nodeCap: 11 }),
				pinned("a.md", "docid_aaa_e", 100, { nodeCap: 22 }),
			],
		});
		expect(resolved.nodeCap).toBe(22);
	});

	it("WHEN the winning pinned doc lacks a field THEN the next-ranked pinned doc fills it", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [
				pinned("winner.md", "docid_w_e", 200, { nodeCap: 22 }),
				pinned("runnerup.md", "docid_r_e", 100, { groupByFolder: false }),
			],
		});
		expect(resolved.groupByFolder).toBe(false);
	});

	it("WHEN fields come from three layers at once THEN each field resolves independently", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			mainOverride: { nodeCap: 25 },
			pinnedOverrides: [pinned("p.md", "docid_p_e", 100, { groupByFolder: false })],
		});
		expect({
			nodeCap: resolved.nodeCap,
			groupByFolder: resolved.groupByFolder,
			sizingFromGlobal: resolved.sizing === global.sizing,
		}).toEqual({ nodeCap: 25, groupByFolder: false, sizingFromGlobal: true });
	});
});

describe("ViewSettingsResolver outline depth cascade", () => {
	const global: ViewSettings = EngineDefaults.viewSettings();

	it("WHEN MAIN pins outlineMaxDepth THEN the resolved value is MAIN's", () => {
		const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { outlineMaxDepth: 4 } });
		expect(resolved.outlineMaxDepth).toBe(4);
	});

	it("WHEN nobody pins outlineMaxDepth THEN the resolved value is the global one", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [pinned("p.md", "docid_p_e", 1, { nodeCap: 5 })],
		});
		expect(resolved.outlineMaxDepth).toBe(global.outlineMaxDepth);
	});
});

describe("ViewSettingsResolver node preview cascade", () => {
	const global: ViewSettings = EngineDefaults.viewSettings();

	it("WHEN MAIN pins nodePreviewPreference THEN the resolved value is MAIN's", () => {
		const resolved = ViewSettingsResolver.resolve({ global, mainOverride: { nodePreviewPreference: "image" } });
		expect(resolved.nodePreviewPreference).toBe("image");
	});

	it("WHEN nobody pins nodePreviewPreference THEN the resolved value is the global one", () => {
		const resolved = ViewSettingsResolver.resolve({
			global,
			pinnedOverrides: [pinned("p.md", "docid_p_e", 1, { nodeCap: 5 })],
		});
		expect(resolved.nodePreviewPreference).toBe(global.nodePreviewPreference);
	});
});
