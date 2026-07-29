import { describe, expect, it } from "vitest";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

const CTX: SettingsWriteContext = {
	globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
	globalView: EngineDefaults.viewSettings(),
	nodeExclusion: EngineDefaults.nodeExclusionSettings(),
};

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

	it("WHEN global-sizing carries an out-of-range value THEN the planned write is clamped", () => {
		// The React sizing panel and the settings tab both write through here, and
		// an `<input type=number min=…>` does NOT block a TYPED value — so the LIVE
		// session (not just a reloaded data.json) needs the clamp.
		const sizing = { ...EngineDefaults.viewSettings().sizing, depthDecayK: -1, maxPx: Number.POSITIVE_INFINITY };
		expect(planSettingsWrite({ kind: "global-sizing", sizing }, CTX)).toEqual({
			kind: "global-view",
			view: {
				...CTX.globalView,
				sizing: {
					...sizing,
					depthDecayK: SIZING_RANGES.depthDecayK.min,
					maxPx: SIZING_RANGES.maxPx.max,
				},
			},
		});
	});

	// The sizing UPPER bounds are what keeps a typed `1e9` out of node geometry (a
	// non-finite/absurd rectangle aborts the edge router's wasm module for the rest
	// of the session). They live in SETTINGS_SPEC; these pin that they still BITE.
	it("WHEN global-sizing minPx exceeds its upper bound THEN the planned write is capped at that bound", () => {
		const sizing = { ...EngineDefaults.viewSettings().sizing, minPx: SIZING_RANGES.minPx.max + 1 };
		const command = planSettingsWrite({ kind: "global-sizing", sizing }, CTX);
		expect(command.kind === "global-view" ? command.view.sizing.minPx : undefined).toBe(SIZING_RANGES.minPx.max);
	});

	it("WHEN global-sizing maxPx exceeds its upper bound THEN the planned write is capped at that bound", () => {
		const sizing = { ...EngineDefaults.viewSettings().sizing, maxPx: SIZING_RANGES.maxPx.max + 1 };
		const command = planSettingsWrite({ kind: "global-sizing", sizing }, CTX);
		expect(command.kind === "global-view" ? command.view.sizing.maxPx : undefined).toBe(SIZING_RANGES.maxPx.max);
	});

	it("WHEN global-sizing depthDecayK exceeds its upper bound THEN the planned write is capped at that bound", () => {
		const sizing = { ...EngineDefaults.viewSettings().sizing, depthDecayK: SIZING_RANGES.depthDecayK.max + 1 };
		const command = planSettingsWrite({ kind: "global-sizing", sizing }, CTX);
		expect(command.kind === "global-view" ? command.view.sizing.depthDecayK : undefined).toBe(
			SIZING_RANGES.depthDecayK.max,
		);
	});

	it("WHEN global-force-layout THEN it merges the forceLayout object over ctx.globalView", () => {
		const forceLayout = { ...EngineDefaults.forceLayoutSettings(), repelStrength: 500, linkGapPx: 60 };
		expect(planSettingsWrite({ kind: "global-force-layout", forceLayout }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, forceLayout },
		});
	});

	it("WHEN global-node-exclusion THEN it emits a node-exclusion command carrying the whole object", () => {
		const nodeExclusion = { enabled: true, patterns: ["^rel/"] };
		expect(planSettingsWrite({ kind: "global-node-exclusion", nodeExclusion }, CTX)).toEqual({
			kind: "node-exclusion",
			nodeExclusion,
		});
	});
});

describe("planSettingsWrite direction to field mapping (guards inversion)", () => {
	it("WHEN direction is outgoing THEN only outgoingDepth moves", () => {
		const command = planSettingsWrite({ kind: "global-depth", direction: "outgoing", value: 4 }, CTX);
		expect(command).toEqual({ kind: "global-depths", depths: { ...CTX.globalDepths, outgoingDepth: 4 } });
	});

	it("WHEN direction is incoming THEN only incomingDepth moves", () => {
		const command = planSettingsWrite({ kind: "global-depth", direction: "incoming", value: 4 }, CTX);
		expect(command).toEqual({ kind: "global-depths", depths: { ...CTX.globalDepths, incomingDepth: 4 } });
	});
});

describe("planSettingsWrite outline depth", () => {
	it("WHEN a global-outline-depth interaction is planned THEN it is a global-view write carrying the new depth", () => {
		const command = planSettingsWrite({ kind: "global-outline-depth", value: 4 }, CTX);
		expect(command).toEqual({ kind: "global-view", view: { ...CTX.globalView, outlineMaxDepth: 4 } });
	});

	it("WHEN a global-outline-depth interaction is planned THEN every other globalView field is preserved", () => {
		const command = planSettingsWrite({ kind: "global-outline-depth", value: 4 }, CTX);
		const view = command.kind === "global-view" ? command.view : undefined;
		expect({ nodeCap: view?.nodeCap, sizing: view?.sizing, forceLayout: view?.forceLayout }).toEqual({
			nodeCap: CTX.globalView.nodeCap,
			sizing: CTX.globalView.sizing,
			forceLayout: CTX.globalView.forceLayout,
		});
	});
});

describe("planSettingsWrite node preview", () => {
	it("WHEN a global-node-preview interaction is planned THEN it merges the preference into the whole globalView object", () => {
		const command = planSettingsWrite({ kind: "global-node-preview", value: "outline" }, CTX);
		expect(command).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, nodePreviewPreference: "outline" },
		});
	});
});
