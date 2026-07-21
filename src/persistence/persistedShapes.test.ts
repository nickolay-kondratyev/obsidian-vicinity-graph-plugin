import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { PersistedShapes, PERSISTED_SHAPE_VERSION } from "./persistedShapes";

describe("PersistedShapes.parsePluginData", () => {
	it("WHEN loadData yields null (first run) THEN engine-default plugin data is seeded", () => {
		expect(PersistedShapes.parsePluginData(null)).toEqual({
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			pins: [],
		});
	});

	it("WHEN a valid shape round-trips through JSON THEN it parses back unchanged", () => {
		const data = {
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: { outgoingDepth: 3, incomingDepth: 2 },
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 42 },
			pins: [{ docid: "docid_a_e", pinTimestamp: 1000 }],
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

	it("WHEN globalView carries an unknown layoutMode THEN the default mode survives", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { layoutMode: "spiral" } };
		expect(PersistedShapes.parsePluginData(raw).globalView.layoutMode).toBe("radial");
	});

	it("WHEN globalView carries a known layoutMode THEN it survives", () => {
		const raw = { version: PERSISTED_SHAPE_VERSION, globalView: { layoutMode: "force" } };
		expect(PersistedShapes.parsePluginData(raw).globalView.layoutMode).toBe("force");
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
		expect(PersistedShapes.parseDocData({ version: 2, depths: { outgoingDepth: 1 } })).toBeNull();
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
