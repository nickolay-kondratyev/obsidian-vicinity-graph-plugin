import { describe, expect, it } from "vitest";
import type { ViewSettings } from "../engine";
import { EngineDefaults, SETTINGS_SPEC, SIZING_RANGES } from "../engine";
import { PersistedShapes, PERSISTED_SHAPE_VERSION } from "./persistedShapes";

/** The parsed `globalView` — the one surface every view field is stored on. */
function parsedGlobalView(globalView: unknown): ViewSettings {
	return PersistedShapes.parsePluginData({ version: PERSISTED_SHAPE_VERSION, globalView }).globalView;
}

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
			// Every value is NON-default on purpose, so "parsed" cannot be mistaken for
			// "fell back to the spec default".
			globalDepths: { linkDepthOut: 3, embedDepthOut: 4, linkDepthIn: 2 },
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 42 },
			pins: [{ docid: "docid_a_e", pinTimestamp: 1000 }],
			nodeExclusion: { enabled: true, patterns: ["^rel/", "templates/"] },
		};
		expect(PersistedShapes.parsePluginData(JSON.parse(JSON.stringify(data)))).toEqual(data);
	});

	it("WHEN the version is foreign THEN defaults win (no partial trust in unknown shapes)", () => {
		const foreign = { version: 999, globalDepths: { linkDepthOut: 9, linkDepthIn: 9 } };
		expect(PersistedShapes.parsePluginData(foreign)).toEqual(PersistedShapes.defaultPluginData());
	});

	it("WHEN a pins entry is malformed THEN only that entry is dropped", () => {
		const raw = {
			version: PERSISTED_SHAPE_VERSION,
			pins: [{ docid: "docid_ok_e", pinTimestamp: 5 }, { docid: 42 }, "garbage"],
		};
		expect(PersistedShapes.parsePluginData(raw).pins).toEqual([{ docid: "docid_ok_e", pinTimestamp: 5 }]);
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

	it("WHEN globalView carries the removed groupByFolder/edgeVisibility fields THEN they are ignored without error", () => {
		// Both were orphan settings with no UI: grouping is always on and only walked
		// edges render, so old persisted values are dropped and the rest survives.
		const raw = {
			version: PERSISTED_SHAPE_VERSION,
			globalView: { groupByFolder: false, edgeVisibility: "all-edges", nodeCap: 7 },
		};
		const parsed = PersistedShapes.parsePluginData(raw).globalView;
		expect(parsed).not.toHaveProperty("groupByFolder");
		expect(parsed).not.toHaveProperty("edgeVisibility");
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
	// Sizing replaces the default WHOLESALE, so a parsed sizing must always be
	// complete — mangled pieces are repaired from defaults.

	it("WHEN a persisted sizing round-trips through JSON THEN it parses back unchanged", () => {
		const sizing = {
			...EngineDefaults.viewSettings().sizing,
			depthDecayK: 0.75,
			metrics: { ...EngineDefaults.viewSettings().sizing.metrics, "backlink-count": { enabled: false, weight: 2 } },
		};
		expect(parsedGlobalView({ sizing: JSON.parse(JSON.stringify(sizing)) }).sizing).toEqual(sizing);
	});

	it("WHEN persisted sizing is partially mangled THEN unusable pieces are repaired from defaults (complete shape out)", () => {
		const raw = { sizing: { depthDecayK: "broken", minPx: 12, metrics: { "backlink-count": { enabled: true } } } };
		expect(parsedGlobalView(raw).sizing).toEqual({ ...EngineDefaults.viewSettings().sizing, minPx: 12 });
	});

	it("WHEN persisted sizing carries out-of-range values THEN they are clamped into the input ranges", () => {
		// `-1` is FINITE, so the non-finite gate lets it through: it is the clamp
		// that stops `depthDecayK = -1` reaching `1 / (1 + k * minDepth)`.
		const parsed = parsedGlobalView({ sizing: { depthDecayK: -1, minPx: -50, maxPx: 1e10 } }).sizing;
		expect({ depthDecayK: parsed.depthDecayK, minPx: parsed.minPx, maxPx: parsed.maxPx }).toEqual({
			depthDecayK: SIZING_RANGES.depthDecayK.min,
			minPx: SIZING_RANGES.minPx.min,
			maxPx: SIZING_RANGES.maxPx.max,
		});
	});

	it("WHEN a hand-edited data.json inverts the size pair THEN maxPx loads RAISED to minPx", () => {
		// The engine backstop behind both settings surfaces' refusal: nothing typed can
		// invert the pair, but a hand-edited file can, and an inverted pair runs the size
		// ramp backwards (most relevant note drawn smallest).
		const parsed = parsedGlobalView({ sizing: { minPx: 200, maxPx: 40 } }).sizing;
		expect(parsed.maxPx).toBe(200);
	});

	it("WHEN a hand-edited data.json inverts the size pair THEN minPx loads exactly as stored (the rule RAISES)", () => {
		expect(parsedGlobalView({ sizing: { minPx: 200, maxPx: 40 } }).sizing.minPx).toBe(200);
	});

	it("WHEN a persisted metric weight is out of range THEN it is clamped into the weight range", () => {
		const raw = { sizing: { metrics: { "backlink-count": { enabled: true, weight: -3 } } } };
		expect(parsedGlobalView(raw).sizing.metrics["backlink-count"].weight).toBe(SIZING_RANGES.metricWeight.min);
	});

	it("WHEN persisted sizing is not an object THEN the whole default sizing applies", () => {
		expect(parsedGlobalView({ nodeCap: 5, sizing: "scrambled" }).sizing).toEqual(
			EngineDefaults.viewSettings().sizing,
		);
	});

	it("WHEN persisted sizing is unusable THEN its SIBLING fields still survive", () => {
		expect(parsedGlobalView({ nodeCap: 5, sizing: "scrambled" }).nodeCap).toBe(5);
	});
});

describe("PersistedShapes force-layout parsing", () => {
	// forceLayout replaces the default WHOLESALE (like sizing), so a parsed value
	// must always be complete AND inside the slider ranges — mangled pieces are
	// repaired from defaults, excesses are clamped.

	it("WHEN a persisted forceLayout round-trips through JSON THEN it parses back unchanged", () => {
		const forceLayout = { ...EngineDefaults.forceLayoutSettings(), repelStrength: 500, linkGapPx: 60 };
		expect(parsedGlobalView({ forceLayout: JSON.parse(JSON.stringify(forceLayout)) }).forceLayout).toEqual(
			forceLayout,
		);
	});

	it("WHEN persisted forceLayout is partially mangled THEN unusable pieces are repaired from defaults (complete shape out)", () => {
		const raw = { forceLayout: { repelStrength: "broken", linkGapPx: 60 } };
		expect(parsedGlobalView(raw).forceLayout).toEqual({ ...EngineDefaults.forceLayoutSettings(), linkGapPx: 60 });
	});

	it("WHEN persisted forceLayout carries out-of-range values THEN they are clamped into the slider ranges", () => {
		const raw = { forceLayout: { centerPullStrength: 99, repelStrength: -5 } };
		expect(parsedGlobalView(raw).forceLayout).toEqual({
			...EngineDefaults.forceLayoutSettings(),
			centerPullStrength: 0.15,
			repelStrength: 50,
		});
	});

	it("WHEN persisted forceLayout is not an object THEN the whole default forceLayout applies", () => {
		expect(parsedGlobalView({ nodeCap: 5, forceLayout: "scrambled" }).forceLayout).toEqual(
			EngineDefaults.forceLayoutSettings(),
		);
	});

	it("WHEN an old data.json lacks forceLayout THEN the global view gets the engine default (backward compatible, no version bump)", () => {
		expect(parsedGlobalView({ nodeCap: 7 }).forceLayout).toEqual(EngineDefaults.forceLayoutSettings());
	});

	it("WHEN a forceLayout persisted before the edge-clearance field is read THEN only that field defaults, the user's other values survive", () => {
		// The explicit call behind adding `edgeRoutingClearancePx` WITHOUT bumping
		// PERSISTED_SHAPE_VERSION (edge-routing__06): per-field defaulting already makes an
		// older file forward-compatible, whereas a bump would discard every stored setting
		// (parsePluginData returns defaults wholesale on a version mismatch).
		const defaults = EngineDefaults.forceLayoutSettings();
		const { edgeRoutingClearancePx: _absent, ...persistedBeforeTheField } = { ...defaults, repelStrength: 500 };
		expect(parsedGlobalView({ forceLayout: persistedBeforeTheField }).forceLayout).toEqual({
			...defaults,
			repelStrength: 500,
		});
	});
});

describe("PersistedShapes global depth parsing", () => {
	function parsedGlobalDepths(globalDepths: unknown) {
		return PersistedShapes.parsePluginData({ version: PERSISTED_SHAPE_VERSION, globalDepths }).globalDepths;
	}

	it("WHEN a depth field carries the wrong type THEN only that field falls back to the default", () => {
		expect(parsedGlobalDepths({ linkDepthOut: "3", embedDepthOut: 3, linkDepthIn: 2 })).toEqual({
			linkDepthOut: EngineDefaults.depthSettings().linkDepthOut,
			embedDepthOut: 3,
			linkDepthIn: 2,
		});
	});

	it("WHEN a stored depth is zero THEN zero survives parsing (a real value, never an absence)", () => {
		expect(parsedGlobalDepths({ linkDepthOut: 0 }).linkDepthOut).toBe(0);
	});
});

/**
 * The RUNTIME companion to the `ParsedViewFields` compile guard: the compile
 * guard proves every view field is PARSED; these prove a parsed field is KEPT
 * (never quietly replaced by its default) and that a stored FALSY value is not
 * mistaken for an absence.
 */
describe("PersistedShapes view field presence semantics", () => {
	/**
	 * Every view field at a NON-default value. Typed as the complete
	 * {@link ViewSettings} on purpose: a newly added field is a compile error here
	 * until it gets a value, so the round-trip below keeps covering every field.
	 */
	const NON_DEFAULT_VIEW: ViewSettings = {
		nodeCap: 7,
		outlineMaxDepth: 4,
		nodePreviewPreference: "image",
		sizing: { ...EngineDefaults.viewSettings().sizing, minPx: 30 },
		forceLayout: { ...EngineDefaults.forceLayoutSettings(), linkGapPx: 60 },
	};

	it("WHEN the fixture is compared to the defaults THEN every field differs (else the round-trip proves nothing)", () => {
		const defaults = EngineDefaults.viewSettings();
		const same = Object.keys(defaults).filter(
			(key) =>
				JSON.stringify(NON_DEFAULT_VIEW[key as keyof ViewSettings]) ===
				JSON.stringify(defaults[key as keyof ViewSettings]),
		);
		expect(same).toEqual([]);
	});

	it("WHEN every view field is persisted at a non-default value THEN all of them survive parsing", () => {
		expect(parsedGlobalView(JSON.parse(JSON.stringify(NON_DEFAULT_VIEW)))).toEqual(NON_DEFAULT_VIEW);
	});

	it("WHEN a persisted view stores nodeCap zero THEN the zero survives (a real value, not an absence)", () => {
		expect(parsedGlobalView({ nodeCap: 0 }).nodeCap).toBe(0);
	});

	it("WHEN a persisted view omits a field THEN that field takes the spec default", () => {
		expect(parsedGlobalView({ nodeCap: 10 }).outlineMaxDepth).toBe(SETTINGS_SPEC.globalView.outlineMaxDepth.default);
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
