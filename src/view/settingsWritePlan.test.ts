import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

const CTX: SettingsWriteContext = {
	globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
	globalView: EngineDefaults.viewSettings(),
};

describe("planSettingsWrite main depth", () => {
	it("WHEN main-depth outgoing value 3 THEN a doc-depth-field write targets outgoingDepth", () => {
		expect(planSettingsWrite({ kind: "main-depth", direction: "outgoing", value: 3 }, CTX)).toEqual({
			kind: "doc-depth-field",
			field: "outgoingDepth",
			value: 3,
		});
	});

	it("WHEN main-depth incoming is reset THEN the write carries value undefined", () => {
		expect(planSettingsWrite({ kind: "main-depth", direction: "incoming", value: undefined }, CTX)).toEqual({
			kind: "doc-depth-field",
			field: "incomingDepth",
			value: undefined,
		});
	});

	it("WHEN main-depth value EQUALS the global default THEN a write is STILL emitted (pin-on-toggle)", () => {
		const command = planSettingsWrite(
			{ kind: "main-depth", direction: "outgoing", value: CTX.globalDepths.outgoingDepth },
			CTX,
		);
		expect(command).toEqual({ kind: "doc-depth-field", field: "outgoingDepth", value: 1 });
	});
});

describe("planSettingsWrite central depth", () => {
	it("WHEN central-depth outgoing value 2 THEN a central-depth-field write carries the central docid", () => {
		expect(
			planSettingsWrite({ kind: "central-depth", centralDocid: "docid_x_e", direction: "outgoing", value: 2 }, CTX),
		).toEqual({ kind: "central-depth-field", centralDocid: "docid_x_e", field: "outgoingDepth", value: 2 });
	});

	it("WHEN central-depth is reset THEN the write carries value undefined", () => {
		expect(
			planSettingsWrite(
				{ kind: "central-depth", centralDocid: "docid_x_e", direction: "incoming", value: undefined },
				CTX,
			),
		).toEqual({ kind: "central-depth-field", centralDocid: "docid_x_e", field: "incomingDepth", value: undefined });
	});
});

describe("planSettingsWrite global writes", () => {
	it("WHEN global-depth outgoing value 2 THEN it merges over ctx.globalDepths preserving the other field", () => {
		expect(planSettingsWrite({ kind: "global-depth", direction: "outgoing", value: 2 }, CTX)).toEqual({
			kind: "global-depths",
			depths: { outgoingDepth: 2, incomingDepth: 1 },
		});
	});

	it("WHEN global-cap value 50 THEN it merges over ctx.globalView preserving the rest", () => {
		expect(planSettingsWrite({ kind: "global-cap", value: 50 }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, nodeCap: 50 },
		});
	});

	it("WHEN global-sizing THEN it merges the sizing object over ctx.globalView", () => {
		const sizing = { ...EngineDefaults.viewSettings().sizing, minPx: 20, maxPx: 200 };
		expect(planSettingsWrite({ kind: "global-sizing", sizing }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, sizing },
		});
	});

	it("WHEN global-layout THEN it merges the layoutMode over ctx.globalView", () => {
		expect(planSettingsWrite({ kind: "global-layout", layoutMode: "layered" }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, layoutMode: "layered" },
		});
	});

	it("WHEN global-edge-routing THEN it merges edgeRouting over ctx.globalView", () => {
		expect(planSettingsWrite({ kind: "global-edge-routing", edgeRouting: true }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, edgeRouting: true },
		});
	});
});

describe("planSettingsWrite direction to field mapping (guards inversion)", () => {
	it("WHEN direction is outgoing THEN the field is outgoingDepth", () => {
		const command = planSettingsWrite({ kind: "main-depth", direction: "outgoing", value: 0 }, CTX);
		expect(command).toMatchObject({ field: "outgoingDepth" });
	});

	it("WHEN direction is incoming THEN the field is incomingDepth", () => {
		const command = planSettingsWrite({ kind: "main-depth", direction: "incoming", value: 0 }, CTX);
		expect(command).toMatchObject({ field: "incomingDepth" });
	});
});
