import { describe, expect, it } from "vitest";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import type { SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";

const CTX: SettingsWriteContext = {
	globalDepths: EngineDefaults.depthSettings(),
	globalView: EngineDefaults.viewSettings(),
	nodeExclusion: EngineDefaults.nodeExclusionSettings(),
};

describe("planSettingsWrite global writes", () => {
	it("WHEN global-depth outgoing value 2 THEN it merges over ctx.globalDepths preserving the other field", () => {
		expect(planSettingsWrite({ kind: "global-depth", field: "linkDepthOut", value: 2 }, CTX)).toEqual({
			kind: "global-depths",
			depths: { ...EngineDefaults.depthSettings(), linkDepthOut: 2 },
		});
	});

	it("WHEN global-cap value 50 THEN it merges over ctx.globalView preserving the rest", () => {
		expect(planSettingsWrite({ kind: "global-cap", value: 50 }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, nodeCap: 50 },
		});
	});

	it("WHEN one sizing number is edited THEN only that field moves in ctx.globalView.sizing", () => {
		expect(planSettingsWrite({ kind: "global-sizing-number", field: "minPx", value: 20 }, CTX)).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, sizing: { ...CTX.globalView.sizing, minPx: 20 } },
		});
	});

	// EXPLICIT ALIGNMENT (nid_cx5zoz7ptucg9nxalibv0mbjb_e): the metric-enable /
	// metric-weight / depthDecayK interaction tests left with the removed dials.

	// The sizing bounds are what keeps a typed `1e9` out of node geometry (a
	// non-finite/absurd rectangle aborts the edge router's wasm module for the rest
	// of the session), and an `<input type=number min=…>` does NOT block a TYPED
	// value — so the LIVE session (not just a reloaded data.json) needs the clamp.
	// The bounds live in SETTINGS_SPEC; these pin that they still BITE.
	it("WHEN a typed minPx is below its lower bound THEN the planned write is clamped up to it", () => {
		const command = planSettingsWrite({ kind: "global-sizing-number", field: "minPx", value: -1 }, CTX);
		expect(command.kind === "global-view" ? command.view.sizing.minPx : undefined).toBe(SIZING_RANGES.minPx.min);
	});

	it("WHEN a typed minPx exceeds its upper bound THEN the planned write is capped at that bound", () => {
		const value = SIZING_RANGES.minPx.max + 1;
		const command = planSettingsWrite({ kind: "global-sizing-number", field: "minPx", value }, CTX);
		expect(command.kind === "global-view" ? command.view.sizing.minPx : undefined).toBe(SIZING_RANGES.minPx.max);
	});

	it("WHEN a typed maxPx is non-finite THEN the planned write is capped at its upper bound", () => {
		const command = planSettingsWrite(
			{ kind: "global-sizing-number", field: "maxPx", value: Number.POSITIVE_INFINITY },
			CTX,
		);
		expect(command.kind === "global-view" ? command.view.sizing.maxPx : undefined).toBe(SIZING_RANGES.maxPx.max);
	});

	it("WHEN one force-layout knob is dragged THEN the six sibling knobs are untouched", () => {
		const command = planSettingsWrite({ kind: "global-force-layout-field", field: "linkGapPx", value: 60 }, CTX);
		expect(command).toEqual({
			kind: "global-view",
			view: { ...CTX.globalView, forceLayout: { ...CTX.globalView.forceLayout, linkGapPx: 60 } },
		});
	});

	it("WHEN exclusion is enabled THEN the stored pattern list is carried over", () => {
		const withPatterns = { ...CTX, nodeExclusion: { enabled: false, patterns: ["^rel/"] } };
		expect(planSettingsWrite({ kind: "global-exclusion-enabled", enabled: true }, withPatterns)).toEqual({
			kind: "node-exclusion",
			nodeExclusion: { enabled: true, patterns: ["^rel/"] },
		});
	});

	it("WHEN the pattern list is edited THEN the stored enable flag is carried over", () => {
		const enabled = { ...CTX, nodeExclusion: { enabled: true, patterns: [] } };
		expect(planSettingsWrite({ kind: "global-exclusion-patterns", patterns: ["^rel/"] }, enabled)).toEqual({
			kind: "node-exclusion",
			nodeExclusion: { enabled: true, patterns: ["^rel/"] },
		});
	});
});

describe("planSettingsWrite depth field targeting (guards inversion)", () => {
	it("WHEN the interaction names linkDepthOut THEN only linkDepthOut moves", () => {
		const command = planSettingsWrite({ kind: "global-depth", field: "linkDepthOut", value: 4 }, CTX);
		expect(command).toEqual({ kind: "global-depths", depths: { ...CTX.globalDepths, linkDepthOut: 4 } });
	});

	it("WHEN the interaction names linkDepthIn THEN only linkDepthIn moves", () => {
		const command = planSettingsWrite({ kind: "global-depth", field: "linkDepthIn", value: 4 }, CTX);
		expect(command).toEqual({ kind: "global-depths", depths: { ...CTX.globalDepths, linkDepthIn: 4 } });
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
