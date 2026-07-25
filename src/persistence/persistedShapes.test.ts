import { describe, expect, it } from "vitest";
import { EngineDefaults, SETTINGS_SPEC } from "../engine";
import { PersistedShapes, PERSISTED_SHAPE_VERSION } from "./persistedShapes";

describe("PersistedShapes.parsePluginData", () => {
	it("WHEN loadData yields null (first run) THEN engine-default plugin data is seeded", () => {
		expect(PersistedShapes.parsePluginData(null)).toEqual({
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			pins: [],
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		});
	});

	it("WHEN a valid shape round-trips through JSON THEN it parses back unchanged", () => {
		const data = {
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: { outgoingDepth: 3, incomingDepth: 2 },
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 42 },
			pins: [{ docid: "docid_a_e", pinTimestamp: 1000 }],
			nodeExclusion: { enabled: true, patterns: ["^rel/", "templates/"] },
		};
		expect(PersistedShapes.parsePluginData(JSON.parse(JSON.stringify(data)))).toEqual(data);
	});

	it("WHEN the version is foreign THEN defaults win (no partial trust in unknown shapes)", () => {
		const foreign = { version: 999, globalDepths: { outgoingDepth: 9, incomingDepth: 9 } };
		expect(PersistedShapes.parsePluginData(foreign)).toEqual(PersistedShapes.defaultPluginData());
	});

	it("WHEN a pins entry is malformed THEN only that entry is dropped", () => {
		const raw = {
			version: PERSISTED_SHAPE_VERSION,
			pins: [{ docid: "docid_ok_e", pinTimestamp: 5 }, { docid: 42 }, "garbage"],
		};
		expect(PersistedShapes.parsePluginData(raw).pins).toEqual([{ docid: "docid_ok_e", pinTimestamp: 5 }]);
	});

	it("WHEN globalView carries an unknown edgeVisibility THEN the default mode survives", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { edgeVisibility: "rainbow" } };
		expect(PersistedShapes.parsePluginData(raw).globalView.edgeVisibility).toBe("walked-from-center");
	});

	it("WHEN globalView carries a valid nodePreviewPreference THEN it round-trips", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { nodePreviewPreference: "outline" } };
		expect(PersistedShapes.parsePluginData(raw).globalView.nodePreviewPreference).toBe("outline");
	});

	it("WHEN globalView carries no nodePreviewPreference THEN the spec default applies", () => {
		// The upgrade path: a data.json written before the Preview setting existed.
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { nodeCap: 7 } };
		expect(PersistedShapes.parsePluginData(raw).globalView.nodePreviewPreference).toBe(
			SETTINGS_SPEC.globalView.nodePreviewPreference.default,
		);
	});

	it("WHEN globalView carries an unrecognized nodePreviewPreference THEN the spec default applies", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { nodePreviewPreference: "collage" } };
		expect(PersistedShapes.parsePluginData(raw).globalView.nodePreviewPreference).toBe(
			SETTINGS_SPEC.globalView.nodePreviewPreference.default,
		);
	});

	it("WHEN globalView's nodePreviewPreference is not a string THEN the spec default applies", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { nodePreviewPreference: 3 } };
		expect(PersistedShapes.parsePluginData(raw).globalView.nodePreviewPreference).toBe(
			SETTINGS_SPEC.globalView.nodePreviewPreference.default,
		);
	});

	it("WHEN globalView carries a removed layoutMode field THEN it is ignored without error", () => {
		// layoutMode was removed (force is the only layout); an old persisted value
		// is simply dropped by the per-field parser — the rest of globalView survives.
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { layoutMode: "radial", nodeCap: 7 } };
		const parsed = PersistedShapes.parsePluginData(raw).globalView;
		expect(parsed).not.toHaveProperty("layoutMode");
		expect(parsed.nodeCap).toBe(7);
	});

	it("WHEN globalView carries a removed edgeRouting field THEN it is ignored without error", () => {
		// edgeRouting was removed (obstacle avoidance is always on); an old persisted
		// value is simply dropped by the per-field parser — the rest of globalView survives.
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { edgeRouting: false, nodeCap: 7 } };
		const parsed = PersistedShapes.parsePluginData(raw).globalView;
		expect(parsed).not.toHaveProperty("edgeRouting");
		expect(parsed.nodeCap).toBe(7);
	});
});

describe("PersistedShapes node-exclusion parsing", () => {
	it("WHEN nodeExclusion is absent THEN it defaults to disabled with no patterns", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION };
		expect(PersistedShapes.parsePluginData(raw).nodeExclusion).toEqual({ enabled: false, patterns: [] });
	});

	it("WHEN a valid nodeExclusion round-trips through JSON THEN it parses back unchanged", () => {
		const nodeExclusion = { enabled: true, patterns: ["^rel/", "\\.excalidraw\\.md$"] };
		const raw = { version: PERSISTED_SHAPE_VERSION, nodeExclusion: JSON.parse(JSON.stringify(nodeExclusion)) };
		expect(PersistedShapes.parsePluginData(raw).nodeExclusion).toEqual(nodeExclusion);
	});

	it("WHEN enabled is not a boolean THEN it degrades to the default enabled flag", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, nodeExclusion: { enabled: "yes", patterns: ["a"] } };
		expect(PersistedShapes.parsePluginData(raw).nodeExclusion).toEqual({ enabled: false, patterns: ["a"] });
	});

	it("WHEN patterns is not an array THEN it degrades to an empty pattern list", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, nodeExclusion: { enabled: true, patterns: "rel/" } };
		expect(PersistedShapes.parsePluginData(raw).nodeExclusion).toEqual({ enabled: true, patterns: [] });
	});

	it("WHEN patterns contains non-string entries THEN only the strings survive", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, nodeExclusion: { enabled: true, patterns: ["ok", 42, null] } };
		expect(PersistedShapes.parsePluginData(raw).nodeExclusion.patterns).toEqual(["ok"]);
	});
});

describe("PersistedShapes sizing parsing", () => {
	// Sizing replaces the default WHOLESALE in the view cascade, so a parsed
	// sizing must always be complete — mangled pieces are repaired from defaults.

	it("WHEN a persisted sizing round-trips through JSON THEN it parses back unchanged", () => {
		const sizing = {
			...EngineDefaults.viewSettings().sizing,
			depthDecayK: 0.75,
			metrics: { ...EngineDefaults.viewSettings().sizing.metrics, "backlink-count": { enabled: false, weight: 2 } },
		};
		const raw = { version: PERSISTED_SHAPE_VERSION, view: { sizing: JSON.parse(JSON.stringify(sizing)) } };
		expect(PersistedShapes.parseDocData(raw)?.view?.sizing).toEqual(sizing);
	});

	it("WHEN persisted sizing is partially mangled THEN unusable pieces are repaired from defaults (complete shape out)", () => {
		const raw = {
			version: PERSISTED_SHAPE_VERSION,
			view: { sizing: { depthDecayK: "broken", minPx: 12, metrics: { "backlink-count": { enabled: true } } } },
		};
		const defaults = EngineDefaults.viewSettings().sizing;
		expect(PersistedShapes.parseDocData(raw)?.view?.sizing).toEqual({ ...defaults, minPx: 12 });
	});

	it("WHEN persisted sizing is not an object THEN the sizing field inherits (absent)", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, view: { nodeCap: 5, sizing: "scrambled" } };
		expect(PersistedShapes.parseDocData(raw)?.view).toEqual({ nodeCap: 5 });
	});
});

describe("PersistedShapes force-layout parsing", () => {
	// forceLayout replaces the default WHOLESALE in the view cascade (like
	// sizing), so a parsed value must always be complete AND inside the slider
	// ranges — mangled pieces are repaired from defaults, excesses are clamped.

	it("WHEN a persisted forceLayout round-trips through JSON THEN it parses back unchanged", () => {
		const forceLayout = { ...EngineDefaults.forceLayoutSettings(), repelStrength: 500, linkGapPx: 60 };
		const raw = { version: PERSISTED_SHAPE_VERSION, view: { forceLayout: JSON.parse(JSON.stringify(forceLayout)) } };
		expect(PersistedShapes.parseDocData(raw)?.view?.forceLayout).toEqual(forceLayout);
	});

	it("WHEN persisted forceLayout is partially mangled THEN unusable pieces are repaired from defaults (complete shape out)", () => {
		const raw = {
			version: PERSISTED_SHAPE_VERSION,
			view: { forceLayout: { repelStrength: "broken", linkGapPx: 60 } },
		};
		const defaults = EngineDefaults.forceLayoutSettings();
		expect(PersistedShapes.parseDocData(raw)?.view?.forceLayout).toEqual({ ...defaults, linkGapPx: 60 });
	});

	it("WHEN persisted forceLayout carries out-of-range values THEN they are clamped into the slider ranges", () => {
		const raw = {
			version: PERSISTED_SHAPE_VERSION,
			view: { forceLayout: { centerPullStrength: 99, repelStrength: -5 } },
		};
		expect(PersistedShapes.parseDocData(raw)?.view?.forceLayout).toEqual({
			...EngineDefaults.forceLayoutSettings(),
			centerPullStrength: 0.15,
			repelStrength: 50,
		});
	});

	it("WHEN persisted forceLayout is not an object THEN the forceLayout field inherits (absent)", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, view: { nodeCap: 5, forceLayout: "scrambled" } };
		expect(PersistedShapes.parseDocData(raw)?.view).toEqual({ nodeCap: 5 });
	});

	it("WHEN an old data.json lacks forceLayout THEN the global view gets the engine default (backward compatible, no version bump)", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { nodeCap: 7 } };
		expect(PersistedShapes.parsePluginData(raw).globalView.forceLayout).toEqual(
			EngineDefaults.forceLayoutSettings(),
		);
	});

	it("WHEN a forceLayout persisted before the edge-clearance field is read THEN only that field defaults, the user's other values survive", () => {
		// The explicit call behind adding `edgeRoutingClearancePx` WITHOUT bumping
		// PERSISTED_SHAPE_VERSION (edge-routing__06): per-field defaulting already makes an
		// older file forward-compatible, whereas a bump would discard every stored setting
		// (parsePluginData returns defaults wholesale on a version mismatch).
		const defaults = EngineDefaults.forceLayoutSettings();
		const { edgeRoutingClearancePx: _absent, ...persistedBeforeTheField } = { ...defaults, repelStrength: 500 };
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { forceLayout: persistedBeforeTheField } };
		expect(PersistedShapes.parsePluginData(raw).globalView.forceLayout).toEqual({
			...defaults,
			repelStrength: 500,
		});
	});
});

describe("PersistedShapes.parseDocData", () => {
	it("WHEN a doc override round-trips through JSON THEN it parses back unchanged", () => {
		const doc = {
			version: PERSISTED_SHAPE_VERSION,
			depths: { outgoingDepth: 2 },
			view: { nodeCap: 10, groupByFolder: false },
			centralDepths: { docid_c_e: { incomingDepth: 0 } },
		};
		expect(PersistedShapes.parseDocData(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
	});

	it("WHEN the version is foreign THEN the doc data is unusable (null)", () => {
		expect(PersistedShapes.parseDocData({ version: 999, depths: { outgoingDepth: 1 } })).toBeNull();
	});

	it("WHEN the content is not an object THEN the doc data is unusable (null)", () => {
		expect(PersistedShapes.parseDocData("scrambled")).toBeNull();
	});

	it("WHEN depth fields carry wrong types THEN they are dropped field-by-field", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: "3", incomingDepth: 1 } };
		expect(PersistedShapes.parseDocData(raw)).toEqual({
			version: PERSISTED_SHAPE_VERSION,
			depths: { incomingDepth: 1 },
		});
	});

	it("WHEN a zero depth was pinned THEN zero survives parsing (presence = pinned)", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 0 } };
		expect(PersistedShapes.parseDocData(raw)?.depths).toEqual({ outgoingDepth: 0 });
	});
});

describe("PersistedShapes outline depth parsing", () => {
	function parsedDepth(globalView: unknown): number {
		return PersistedShapes.parsePluginData({ version: PERSISTED_SHAPE_VERSION, globalView }).globalView
			.outlineMaxDepth;
	}

	it("WHEN globalView carries a valid outlineMaxDepth THEN it round-trips", () => {
		expect(parsedDepth({ outlineMaxDepth: 4 })).toBe(4);
	});

	it("WHEN a hand-edited outlineMaxDepth is 0 THEN parsing clamps it to the spec min (no silent off-switch)", () => {
		expect(parsedDepth({ outlineMaxDepth: 0 })).toBe(SETTINGS_SPEC.globalView.outlineMaxDepth.min);
	});

	it("WHEN a hand-edited outlineMaxDepth is 99 THEN parsing clamps it to the spec max", () => {
		expect(parsedDepth({ outlineMaxDepth: 99 })).toBe(SETTINGS_SPEC.globalView.outlineMaxDepth.max);
	});

	it("WHEN outlineMaxDepth is absent THEN the default applies", () => {
		expect(parsedDepth({ nodeCap: 7 })).toBe(SETTINGS_SPEC.globalView.outlineMaxDepth.default);
	});

	it("WHEN outlineMaxDepth is not a number THEN the default applies", () => {
		expect(parsedDepth({ outlineMaxDepth: "deep" })).toBe(SETTINGS_SPEC.globalView.outlineMaxDepth.default);
	});
});
