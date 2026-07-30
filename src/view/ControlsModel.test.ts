import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import type { GraphRequestInputs } from "../adapters/GraphRequestAssembler";
import { ControlsModelBuilder } from "./ControlsModel";

const PIN_PATHS: Record<string, string> = { docid_x_e: "notes/x.md" };

function inputs(partial: Partial<GraphRequestInputs> = {}): GraphRequestInputs {
	return {
		mainPath: "folder/main.md",
		mainDocId: "docid_main_e",
		pins: [],
		resolvePinPath: (docid) => PIN_PATHS[docid],
		globalDepths: { linkDepthOut: 2, linkDepthIn: 1 },
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		...partial,
	};
}

const PIN_X = { pins: [{ docid: "docid_x_e", pinTimestamp: 1 }] } satisfies Partial<GraphRequestInputs>;

describe("ControlsModelBuilder mainPinned", () => {
	it("WHEN the pinned set does not contain MAIN THEN mainPinned is false", () => {
		expect(ControlsModelBuilder.build(inputs(PIN_X)).mainPinned).toBe(false);
	});

	it("WHEN the pinned set contains MAIN's docid THEN mainPinned is true", () => {
		const model = ControlsModelBuilder.build(inputs({ pins: [{ docid: "docid_main_e", pinTimestamp: 1 }] }));
		expect(model.mainPinned).toBe(true);
	});

	it("WHEN MAIN has no docid THEN mainPinned is false regardless of pins", () => {
		const model = ControlsModelBuilder.build(
			inputs({ mainDocId: null, pins: [{ docid: "docid_main_e", pinTimestamp: 1 }] }),
		);
		expect(model.mainPinned).toBe(false);
	});
});

describe("ControlsModelBuilder global context", () => {
	it("WHEN building THEN the model carries the current global depths (the panel's stepper seed + write ctx)", () => {
		expect(ControlsModelBuilder.build(inputs()).globalDepths).toEqual({ linkDepthOut: 2, linkDepthIn: 1 });
	});

	it("WHEN building THEN the model carries the current global view (the panel's control seeds)", () => {
		const view = { ...EngineDefaults.viewSettings(), nodeCap: 42 };
		expect(ControlsModelBuilder.build(inputs({ globalView: view })).globalView).toEqual(view);
	});
});

describe("ControlsModelBuilder node exclusion", () => {
	it("WHEN building THEN the model carries the current node-exclusion settings (pill write ctx)", () => {
		const nodeExclusion = { enabled: true, patterns: ["^rel/"] };
		expect(ControlsModelBuilder.build(inputs({ nodeExclusion })).nodeExclusion).toEqual(nodeExclusion);
	});

	it("WHEN an excluded count is threaded in THEN the model exposes it", () => {
		expect(ControlsModelBuilder.build(inputs(), 3).excludedNodeCount).toBe(3);
	});

	it("WHEN no count is threaded in THEN excludedNodeCount defaults to zero", () => {
		expect(ControlsModelBuilder.build(inputs()).excludedNodeCount).toBe(0);
	});
});
