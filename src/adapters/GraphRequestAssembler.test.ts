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
		resolvePinPath: (docid) => PIN_PATHS[docid],
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
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

/** Settings are GLOBAL: the assembler passes them through, it resolves nothing. */
describe("GraphRequestAssembler global settings pass-through", () => {
	it("WHEN inputs carry global depths THEN the request carries them unchanged", () => {
		const globalDepths = { linkDepthOut: 3, linkDepthIn: 2 };
		expect(GraphRequestAssembler.assemble(inputs({ globalDepths })).globalDepths).toEqual(globalDepths);
	});

	it("WHEN inputs carry a global view THEN the request carries it unchanged", () => {
		const globalView = { ...EngineDefaults.viewSettings(), nodeCap: 12 };
		expect(GraphRequestAssembler.assemble(inputs({ globalView })).globalView).toEqual(globalView);
	});
});
