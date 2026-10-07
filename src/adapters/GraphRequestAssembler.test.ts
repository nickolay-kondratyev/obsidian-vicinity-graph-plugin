import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import type { GraphRequestInputs } from "./GraphRequestAssembler";
import { GraphRequestAssembler } from "./GraphRequestAssembler";

const PIN_PATHS: Record<string, string> = { docid_pin_e: "pinned.md" };

function inputs(partial: Partial<GraphRequestInputs> = {}): GraphRequestInputs {
	return {
		mainPath: "main.md",
		mainDocId: "docid_main_e",
		pins: [],
		localPins: [],
		nodeOverrides: {},
		resolveDocPath: (docid) => PIN_PATHS[docid],
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		frontmatterLinks: EngineDefaults.frontmatterLinkSettings(),
		...partial,
	};
}

describe("GraphRequestAssembler pins", () => {
	it("WHEN a pin's docid resolves THEN it becomes a path-keyed pinned descriptor", () => {
		const request = GraphRequestAssembler.assemble(inputs({ pins: [{ docid: "docid_pin_e", pinTimestamp: 42 }] }));
		expect(request.pinned).toEqual([{ path: "pinned.md", docid: "docid_pin_e", pinTimestamp: 42 }]);
	});

	it("WHEN a pin's docid does not resolve (cold map / deleted doc) THEN the pin is skipped", () => {
		const request = GraphRequestAssembler.assemble(inputs({ pins: [{ docid: "docid_ghost_e", pinTimestamp: 1 }] }));
		expect(request.pinned).toBeUndefined();
	});

	it("WHEN a pin resolves to the main doc THEN it is skipped (already central)", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_main_e", pinTimestamp: 1 }],
				resolveDocPath: () => "main.md",
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

describe("GraphRequestAssembler local-pin merge", () => {
	it("WHEN the active main has a local pin THEN it becomes a pinned descriptor (merged before the engine)", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ localPins: [{ docid: "docid_pin_e", pinTimestamp: 7 }] }),
		);
		expect(request.pinned).toEqual([{ path: "pinned.md", docid: "docid_pin_e", pinTimestamp: 7 }]);
	});

	it("WHEN a local pin resolves to the MAIN doc THEN it is skipped (already central), like a global pin", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				localPins: [{ docid: "docid_main_e", pinTimestamp: 1 }],
				resolveDocPath: () => "main.md",
			}),
		);
		expect(request.pinned).toBeUndefined();
	});

	it("WHEN a doc is BOTH globally and locally pinned THEN one descriptor is emitted (deduped by docid)", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_pin_e", pinTimestamp: 10 }],
				localPins: [{ docid: "docid_pin_e", pinTimestamp: 20 }],
			}),
		);
		expect(request.pinned).toHaveLength(1);
	});

	it("WHEN a doc is pinned both ways THEN the MOST RECENT pinTimestamp wins (recency stays honest)", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_pin_e", pinTimestamp: 20 }],
				localPins: [{ docid: "docid_pin_e", pinTimestamp: 10 }],
			}),
		);
		expect(request.pinned?.[0]?.pinTimestamp).toBe(20);
	});

	it("WHEN the local pin of a dual-pinned doc is newer THEN its timestamp wins over the global one", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				pins: [{ docid: "docid_pin_e", pinTimestamp: 10 }],
				localPins: [{ docid: "docid_pin_e", pinTimestamp: 30 }],
			}),
		);
		expect(request.pinned?.[0]?.pinTimestamp).toBe(30);
	});
});

describe("GraphRequestAssembler node overrides", () => {
	it("WHEN an override's docid resolves THEN the request carries it path-keyed", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ nodeOverrides: { docid_pin_e: { content: "image" } } }),
		);
		expect(request.nodeOverrides).toEqual(new Map([["pinned.md", { content: "image" }]]));
	});

	it("WHEN an override's docid does not resolve (cold map / deleted doc) THEN it is skipped", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({ nodeOverrides: { docid_ghost_e: { content: "image" } } }),
		);
		expect(request.nodeOverrides).toBeUndefined();
	});

	it("WHEN an override resolves to the main doc THEN it is KEPT (overrides apply from any central)", () => {
		const request = GraphRequestAssembler.assemble(
			inputs({
				nodeOverrides: { docid_main_e: { sizePx: { widthPx: 300, heightPx: 200 } } },
				resolveDocPath: () => "main.md",
			}),
		);
		expect(request.nodeOverrides).toEqual(new Map([["main.md", { sizePx: { widthPx: 300, heightPx: 200 } }]]));
	});
});

/** Settings are GLOBAL: the assembler passes them through, it resolves nothing. */
describe("GraphRequestAssembler global settings pass-through", () => {
	it("WHEN inputs carry global depths THEN the request carries them unchanged", () => {
		const globalDepths = {
			linkDepthOut: 3,
			embedDepthOut: 2,
			linkDepthIn: 1,
			descendantDepth: 2,
			ancestorDepth: 1,
			pinnedLinkDepthOut: 4,
			pinnedEmbedDepthOut: 3,
			pinnedLinkDepthIn: 2,
			pinnedDescendantDepth: 3,
			pinnedAncestorDepth: 2,
		};
		expect(GraphRequestAssembler.assemble(inputs({ globalDepths })).globalDepths).toEqual(globalDepths);
	});

	it("WHEN inputs carry a global view THEN the request carries it unchanged", () => {
		const globalView = { ...EngineDefaults.viewSettings(), nodeCap: 12 };
		expect(GraphRequestAssembler.assemble(inputs({ globalView })).globalView).toEqual(globalView);
	});
});
