import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { PERSISTED_SHAPE_VERSION } from "../persistence/persistedShapes";
import type { GraphRequestInputs } from "./GraphRequestAssembler";
import { GraphRequestAssembler } from "./GraphRequestAssembler";

const PIN_PATHS: Record<string, string> = { docid_pin_e: "pinned.md" };

function inputs(partial: Partial<GraphRequestInputs> = {}): GraphRequestInputs {
	return {
		mainPath: "main.md",
		mainDocId: "docid_main_e",
		mainPersistable: true,
		mainDocData: null,
		pins: [],
		resolvePinPath: (docid) => PIN_PATHS[docid],
		docDataByDocid: new Map(),
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		...partial,
	};
}

describe("GraphRequestAssembler pins", () => {
	it("WHEN a pin's docid resolves THEN it becomes a path-keyed pinned descriptor", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ pins: [{ docid: "docid_pin_e", pinTimestamp: 42 }] }),
		);
		expect(request.pinned).toEqual([{ path: "pinned.md", docid: "docid_pin_e", pinTimestamp: 42 }]);
	});

	it("WHEN a pin's docid does not resolve (cold map / deleted doc) THEN the pin is skipped", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ pins: [{ docid: "docid_ghost_e", pinTimestamp: 1 }] }),
		);
		expect(request.pinned).toBeUndefined();
	});

	it("WHEN a pin resolves to the main doc THEN it is skipped (already central)", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_main_e", pinTimestamp: 1 }],
				resolvePinPath: () => "main.md",
			}),
		);
		expect(request.pinned).toBeUndefined();
	});

	it("WHEN the main doc has no docid THEN its descriptor carries none (graph still builds)", () => {
		expect(GraphRequestAssembler.assemble(inputs({ mainDocId: null })).main).toEqual({ path: "main.md" });
	});

	it("WHEN inputs carry node exclusion THEN it is threaded onto the request unchanged", () => {
		const nodeExclusion = { enabled: true, patterns: ["^rel/"] };
		expect(GraphRequestAssembler.assemble(inputs({ nodeExclusion })).nodeExclusion).toEqual(nodeExclusion);
	});
});

describe("GraphRequestAssembler depth overrides", () => {
	it("WHEN the main doc persisted depths THEN they land under the main path", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ mainDocData: { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 3 } } }),
		);
		expect(request.depthOverridesByRoot).toEqual(new Map([["main.md", { outgoingDepth: 3 }]]));
	});

	it("WHEN MAIN adjusted a pinned central's depth THEN that field beats the pin's own persisted depth PER-FIELD", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_pin_e", pinTimestamp: 1 }],
				mainDocData: {
					version: PERSISTED_SHAPE_VERSION,
					centralDepths: { docid_pin_e: { outgoingDepth: 0 } },
				},
				docDataByDocid: new Map([
					["docid_pin_e", { version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 5, incomingDepth: 2 } }],
				]),
			}),
		);
		expect(request.depthOverridesByRoot).toEqual(
			new Map([["pinned.md", { outgoingDepth: 0, incomingDepth: 2 }]]),
		);
	});

	it("WHEN neither main nor pins persisted depths THEN there are no overrides at all", () => {
		expect(GraphRequestAssembler.assemble(inputs()).depthOverridesByRoot).toBeUndefined();
	});
});

describe("GraphRequestAssembler view overrides", () => {
	it("WHEN the main doc persisted view fields THEN they become the main view override", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ mainDocData: { version: PERSISTED_SHAPE_VERSION, view: { nodeCap: 12 } } }),
		);
		expect(request.mainViewOverride).toEqual({ nodeCap: 12 });
	});

	it("WHEN a pinned doc persisted view fields THEN its override is tied to its descriptor", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_pin_e", pinTimestamp: 7 }],
				docDataByDocid: new Map([
					["docid_pin_e", { version: PERSISTED_SHAPE_VERSION, view: { groupByFolder: true } }],
				]),
			}),
		);
		expect(request.pinnedViewOverrides).toEqual([
			{
				descriptor: { path: "pinned.md", docid: "docid_pin_e", pinTimestamp: 7 },
				override: { groupByFolder: true },
			},
		]);
	});
});
