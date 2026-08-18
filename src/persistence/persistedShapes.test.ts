import { describe, expect, it } from "vitest";
import type { ViewSettings } from "../engine";
import { EngineDefaults, SETTINGS_SPEC, SIZING_RANGES } from "../engine";
import { PersistedShapes, PERSISTED_SHAPE_VERSION, serializePluginData } from "./persistedShapes";

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
			frontmatterLinks: EngineDefaults.frontmatterLinkSettings(),
		});
	});

	it("WHEN a valid shape round-trips through JSON THEN it parses back unchanged", () => {
		const data = {
			version: PERSISTED_SHAPE_VERSION,
			// Every value is NON-default on purpose, so "parsed" cannot be mistaken for
			// "fell back to the spec default".
			globalDepths: {
				linkDepthOut: 3,
				embedDepthOut: 4,
				linkDepthIn: 2,
				descendantDepth: 2,
				ancestorDepth: 1,
				pinnedLinkDepthOut: 5,
				pinnedEmbedDepthOut: 0,
				pinnedLinkDepthIn: 3,
				pinnedDescendantDepth: 1,
				pinnedAncestorDepth: 2,
			},
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 42 },
			pins: [{ docid: "docid_a_e", pinTimestamp: 1000 }],
			nodeExclusion: { enabled: true, patterns: ["^rel/", "templates/"] },
			frontmatterLinks: { idRefFields: "deps, links" },
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

/**
 * Clean break (ticket nid_8f8ey41extajt08zphwwxhnwq_e): `localPins` and
 * `nodeOverrides` MOVED OUT of `data.json` onto the per-file store. The parser is
 * field-allowlisting, so an old file still carrying them ignores them WITHOUT a
 * version bump — exactly the call made for the removed `metrics`/`depthDecayK`
 * keys — which is what keeps the dials AND the pinned set from resetting. The
 * moved facts reset once because the plugin now reads them from the (empty)
 * per-file store, not because of a bump.
 */
describe("PersistedShapes clean break — moved keys ignored, dials + pins preserved", () => {
	const oldDataJson = {
		version: PERSISTED_SHAPE_VERSION,
		globalView: { nodeCap: 7 },
		pins: [{ docid: "docid_a_e", pinTimestamp: 1000 }],
		localPins: { docid_main_e: [{ docid: "docid_x_e", pinTimestamp: 5 }] },
		nodeOverrides: { docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } } },
	};

	it("WHEN an old data.json still carries localPins/nodeOverrides THEN the parsed shape omits both", () => {
		const parsed = PersistedShapes.parsePluginData(oldDataJson);
		expect([parsed]).toEqual([
			{
				...PersistedShapes.defaultPluginData(),
				globalView: { ...EngineDefaults.viewSettings(), nodeCap: 7 },
				pins: [{ docid: "docid_a_e", pinTimestamp: 1000 }],
			},
		]);
	});

	it("WHEN an old data.json still carries the moved keys THEN the global pinned set is preserved (no reset)", () => {
		expect(PersistedShapes.parsePluginData(oldDataJson).pins).toEqual([{ docid: "docid_a_e", pinTimestamp: 1000 }]);
	});

	it("WHEN an old data.json still carries the moved keys THEN the config dials are preserved (no reset)", () => {
		expect(PersistedShapes.parsePluginData(oldDataJson).globalView.nodeCap).toBe(7);
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
	// EXPLICIT ALIGNMENT (nid_cx5zoz7ptucg9nxalibv0mbjb_e): metric/depthDecayK
	// parsing tests left with the removed dials; stale keys in an old data.json
	// are simply never read (deliberate no-version-bump, see persistedShapes.ts).

	it("WHEN a persisted sizing round-trips through JSON THEN it parses back unchanged", () => {
		const sizing = { ...EngineDefaults.viewSettings().sizing, minPx: 55 };
		expect(parsedGlobalView({ sizing: JSON.parse(JSON.stringify(sizing)) }).sizing).toEqual(sizing);
	});

	it("WHEN persisted sizing is partially mangled THEN unusable pieces are repaired from defaults (complete shape out)", () => {
		const raw = { sizing: { minPx: 12, maxPx: "broken" } };
		expect(parsedGlobalView(raw).sizing).toEqual({ ...EngineDefaults.viewSettings().sizing, minPx: 12 });
	});

	it("WHEN persisted sizing carries out-of-range values THEN they are clamped into the input ranges", () => {
		// `-50` is FINITE, so the non-finite gate lets it through: it is the clamp
		// that stops it reaching pixel geometry.
		const parsed = parsedGlobalView({ sizing: { minPx: -50, maxPx: 1e10 } }).sizing;
		expect({ minPx: parsed.minPx, maxPx: parsed.maxPx }).toEqual({
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
			...EngineDefaults.depthSettings(),
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
		showCrossLinks: true,
		groupLabelFullPath: true,
		folderGroupingDepth: 2,
		edgeDepthIntoGroups: 3,
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

	it("WHEN a persisted view stores a nodeCap below the spec minimum THEN it clamps to the minimum on load", () => {
		// Supersedes the loaded-verbatim rule (owner decision 2026-07-29, pre-release
		// clean break): a stored 0 now loads as the min, like every other bounded field.
		expect(parsedGlobalView({ nodeCap: 0 }).nodeCap).toBe(SETTINGS_SPEC.globalView.nodeCap.min);
	});

	it("WHEN a persisted view stores a nodeCap above the spec maximum THEN it clamps to the maximum on load", () => {
		// The typo/paste hole the ceiling closes: a huge stored cap must not silently
		// disable truncation and hand the whole vault to the layout pass.
		expect(parsedGlobalView({ nodeCap: 100000000 }).nodeCap).toBe(SETTINGS_SPEC.globalView.nodeCap.max);
	});

	it("WHEN a persisted view omits a field THEN that field takes the spec default", () => {
		expect(parsedGlobalView({ nodeCap: 10 }).outlineMaxDepth).toBe(SETTINGS_SPEC.globalView.outlineMaxDepth.default);
	});
});

describe("PersistedShapes folder grouping depth parsing", () => {
	it("WHEN globalView carries a valid folderGroupingDepth THEN it round-trips", () => {
		expect(parsedGlobalView({ folderGroupingDepth: 2 }).folderGroupingDepth).toBe(2);
	});

	it("WHEN a stored folderGroupingDepth is 0 THEN zero survives parsing (grouping off is a real value)", () => {
		expect(parsedGlobalView({ folderGroupingDepth: 0 }).folderGroupingDepth).toBe(0);
	});

	it("WHEN a hand-edited folderGroupingDepth exceeds the ceiling THEN parsing clamps it to the spec max", () => {
		expect(parsedGlobalView({ folderGroupingDepth: 999 }).folderGroupingDepth).toBe(
			SETTINGS_SPEC.globalView.folderGroupingDepth.max,
		);
	});

	it("WHEN a persisted view omits folderGroupingDepth THEN it takes the spec default (unlimited, ∞)", () => {
		expect(parsedGlobalView({}).folderGroupingDepth).toBe(SETTINGS_SPEC.globalView.folderGroupingDepth.default);
	});

	it('WHEN a stored folderGroupingDepth is the "Infinity" token THEN it decodes to ∞ (unlimited)', () => {
		expect(parsedGlobalView({ folderGroupingDepth: "Infinity" }).folderGroupingDepth).toBe(Number.POSITIVE_INFINITY);
	});

	it("WHEN a stored folderGroupingDepth is a non-Infinity string THEN it falls back to the ∞ default", () => {
		expect(parsedGlobalView({ folderGroupingDepth: "lots" }).folderGroupingDepth).toBe(
			SETTINGS_SPEC.globalView.folderGroupingDepth.default,
		);
	});

	it("WHEN an ∞ depth is serialized for storage THEN it is written as the explicit Infinity token, not null", () => {
		// JSON.stringify(Infinity) is `null`, so the encode must intervene: the value is
		// expressed in full on disk (ticket nid_rndi5sulwrsx1aq0x4xqcskrb_e), never smuggled
		// through a null the parser would only rescue because the default happens to be ∞.
		const data = { ...PersistedShapes.defaultPluginData() };
		const disk = JSON.parse(JSON.stringify(serializePluginData(data))) as { globalView: { folderGroupingDepth: unknown } };
		expect(disk.globalView.folderGroupingDepth).toBe("Infinity");
	});

	it("WHEN an ∞ depth round-trips through serialize + parse THEN it comes back as ∞", () => {
		const data = { ...PersistedShapes.defaultPluginData() };
		const disk = JSON.parse(JSON.stringify(serializePluginData(data)));
		expect(PersistedShapes.parsePluginData(disk).globalView.folderGroupingDepth).toBe(Number.POSITIVE_INFINITY);
	});

	it("WHEN a FINITE depth is serialized for storage THEN it stays a plain number", () => {
		const data = { ...PersistedShapes.defaultPluginData() };
		data.globalView = { ...data.globalView, folderGroupingDepth: 3 };
		const disk = JSON.parse(JSON.stringify(serializePluginData(data))) as { globalView: { folderGroupingDepth: unknown } };
		expect(disk.globalView.folderGroupingDepth).toBe(3);
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
