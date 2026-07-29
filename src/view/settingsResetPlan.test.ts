import { describe, expect, it } from "vitest";
import type { ViewSettings } from "../engine";
import { EngineDefaults } from "../engine";
import {
	SECTION_RESET_SCOPES,
	SETTINGS_RESET_SCOPES,
	planSettingsReset,
	planSettingsResetConfirmation,
} from "./settingsResetPlan";
import type { SettingsCommand } from "./settingsWritePlan";
import type { SettingsWriteContext } from "./settingsWritePlan";

/**
 * A context where EVERY user-editable setting has been moved off its default —
 * so a reset that misses a key, or resets a key it shouldn't, is visible.
 */
const TUNED_VIEW: ViewSettings = {
	...EngineDefaults.viewSettings(),
	nodeCap: 17,
	outlineMaxDepth: 5,
	nodePreviewPreference: "image",
	sizing: {
		...EngineDefaults.sizingSettings(),
		metrics: {
			...EngineDefaults.sizingSettings().metrics,
			"own-file-size": { enabled: false, weight: 9 },
			"backlink-count": { enabled: true, weight: 3 },
		},
		minPx: 11,
		maxPx: 999,
		depthDecayK: 7,
	},
	forceLayout: { ...EngineDefaults.forceLayoutSettings(), repelStrength: 900, linkGapPx: 200 },
};

const TUNED_CTX: SettingsWriteContext = {
	globalDepths: { outgoingDepth: 4, incomingDepth: 5 },
	globalView: TUNED_VIEW,
	nodeExclusion: { enabled: true, patterns: ["^archive/", "templates/"] },
};

/** The single `global-view` command a view-scoped reset must produce (fails loudly if 0 or 2). */
function onlyViewCommand(commands: readonly SettingsCommand[]): ViewSettings {
	const views = commands.filter((command) => command.kind === "global-view");
	expect(views).toHaveLength(1);
	const [view] = views;
	if (view?.kind !== "global-view") {
		throw new Error("unreachable: filtered to global-view");
	}
	return view.view;
}

describe("planSettingsReset depth-defaults scope", () => {
	it("WHEN the depth-defaults section is reset THEN both depths return to their spec defaults", () => {
		expect(planSettingsReset("depth-defaults", TUNED_CTX)).toEqual([
			{ kind: "global-depths", depths: EngineDefaults.depthSettings() },
		]);
	});

	it("WHEN the depth-defaults section is reset THEN no view or exclusion write is emitted", () => {
		const kinds = planSettingsReset("depth-defaults", TUNED_CTX).map((command) => command.kind);
		expect(kinds).toEqual(["global-depths"]);
	});
});

describe("planSettingsReset node-sizing scope", () => {
	it("WHEN the node-sizing section is reset THEN sizing returns to its spec defaults", () => {
		expect(onlyViewCommand(planSettingsReset("node-sizing", TUNED_CTX)).sizing).toEqual(
			EngineDefaults.sizingSettings(),
		);
	});

	it("WHEN the node-sizing section is reset THEN every other view field keeps its tuned value", () => {
		const view = onlyViewCommand(planSettingsReset("node-sizing", TUNED_CTX));
		expect({ ...view, sizing: TUNED_VIEW.sizing }).toEqual(TUNED_VIEW);
	});

	it("WHEN the node-sizing section is reset THEN the depths are left untouched", () => {
		expect(planSettingsReset("node-sizing", TUNED_CTX).map((command) => command.kind)).toEqual(["global-view"]);
	});
});

describe("planSettingsReset node-contents scope", () => {
	it("WHEN the node-contents section is reset THEN the outline depth returns to its spec default", () => {
		expect(onlyViewCommand(planSettingsReset("node-contents", TUNED_CTX)).outlineMaxDepth).toBe(
			EngineDefaults.viewSettings().outlineMaxDepth,
		);
	});

	it("WHEN the node-contents section is reset THEN the node preview returns to its spec default", () => {
		expect(onlyViewCommand(planSettingsReset("node-contents", TUNED_CTX)).nodePreviewPreference).toBe(
			EngineDefaults.viewSettings().nodePreviewPreference,
		);
	});

	it("WHEN the node-contents section is reset THEN every other view field keeps its tuned value", () => {
		const view = onlyViewCommand(planSettingsReset("node-contents", TUNED_CTX));
		expect({
			...view,
			outlineMaxDepth: TUNED_VIEW.outlineMaxDepth,
			nodePreviewPreference: TUNED_VIEW.nodePreviewPreference,
		}).toEqual(TUNED_VIEW);
	});

	it("WHEN the node-contents section is reset THEN neither the depths nor the exclusion are written", () => {
		expect(planSettingsReset("node-contents", TUNED_CTX).map((command) => command.kind)).toEqual(["global-view"]);
	});
});

describe("planSettingsReset force-layout scope", () => {
	it("WHEN the force-layout section is reset THEN forceLayout returns to its spec defaults", () => {
		expect(onlyViewCommand(planSettingsReset("force-layout", TUNED_CTX)).forceLayout).toEqual(
			EngineDefaults.forceLayoutSettings(),
		);
	});

	it("WHEN the force-layout section is reset THEN every other view field keeps its tuned value", () => {
		const view = onlyViewCommand(planSettingsReset("force-layout", TUNED_CTX));
		expect({ ...view, forceLayout: TUNED_VIEW.forceLayout }).toEqual(TUNED_VIEW);
	});
});

describe("planSettingsReset performance scope", () => {
	it("WHEN the performance section is reset THEN the node cap returns to its spec default", () => {
		expect(onlyViewCommand(planSettingsReset("performance", TUNED_CTX)).nodeCap).toBe(
			EngineDefaults.viewSettings().nodeCap,
		);
	});

	it("WHEN the performance section is reset THEN every other view field keeps its tuned value", () => {
		const view = onlyViewCommand(planSettingsReset("performance", TUNED_CTX));
		expect({ ...view, nodeCap: TUNED_VIEW.nodeCap }).toEqual(TUNED_VIEW);
	});
});

describe("planSettingsReset node-exclusion scope", () => {
	it("WHEN the node-exclusion section is reset THEN exclusion is off with no patterns", () => {
		expect(planSettingsReset("node-exclusion", TUNED_CTX)).toEqual([
			{ kind: "node-exclusion", nodeExclusion: EngineDefaults.nodeExclusionSettings() },
		]);
	});

	it("WHEN the node-exclusion section is reset THEN neither depths nor the view are written", () => {
		expect(planSettingsReset("node-exclusion", TUNED_CTX).map((command) => command.kind)).toEqual(["node-exclusion"]);
	});
});

describe("planSettingsReset all scope", () => {
	it("WHEN everything is reset THEN the depths write carries the spec defaults", () => {
		expect(planSettingsReset("all", TUNED_CTX)).toContainEqual({
			kind: "global-depths",
			depths: EngineDefaults.depthSettings(),
		});
	});

	it("WHEN everything is reset THEN the view write carries EVERY spec default (including keys with no UI)", () => {
		expect(onlyViewCommand(planSettingsReset("all", TUNED_CTX))).toEqual(EngineDefaults.viewSettings());
	});

	/**
	 * Called out on its own because it is the field a whole-slice reset is most
	 * likely to LOSE: `outlineMaxDepth` arrived on a branch that never saw the
	 * reset machinery, so "restore all" silently skipping it would be invisible.
	 */
	it("WHEN everything is reset THEN the outline depth is restored too", () => {
		expect(onlyViewCommand(planSettingsReset("all", TUNED_CTX)).outlineMaxDepth).toBe(
			EngineDefaults.viewSettings().outlineMaxDepth,
		);
	});

	it("WHEN everything is reset THEN the node preview is restored too", () => {
		expect(onlyViewCommand(planSettingsReset("all", TUNED_CTX)).nodePreviewPreference).toBe(
			EngineDefaults.viewSettings().nodePreviewPreference,
		);
	});

	it("WHEN everything is reset THEN the exclusion write carries the spec defaults", () => {
		expect(planSettingsReset("all", TUNED_CTX)).toContainEqual({
			kind: "node-exclusion",
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		});
	});

	it("WHEN everything is reset THEN exactly one write per persisted store slice is emitted", () => {
		expect(planSettingsReset("all", TUNED_CTX).map((command) => command.kind).sort()).toEqual([
			"global-depths",
			"global-view",
			"node-exclusion",
		]);
	});

	it("WHEN a context already at defaults is fully reset THEN the plan is still the defaults (idempotent)", () => {
		const defaults: SettingsWriteContext = {
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		};
		expect(planSettingsReset("all", defaults)).toEqual(planSettingsReset("all", TUNED_CTX));
	});
});

/**
 * Confirmation is the "friction scales with blast radius" rule: numeric knobs are
 * cheap to redo, hand-written exclusion patterns are user-authored CONTENT with no
 * undo — and the tab hides the patterns textarea while exclusion is off, so the
 * confirmation is the only place that content can be shown before it is destroyed.
 */
describe("planSettingsResetConfirmation node-exclusion scope", () => {
	it("WHEN the node-exclusion section is reset with stored patterns THEN a confirmation is required", () => {
		expect(planSettingsResetConfirmation("node-exclusion", TUNED_CTX)).not.toBeNull();
	});

	it("WHEN a node-exclusion reset is confirmed THEN every stored pattern is listed verbatim", () => {
		expect(planSettingsResetConfirmation("node-exclusion", TUNED_CTX)?.items).toEqual([
			"^archive/",
			"templates/",
		]);
	});

	it("WHEN exclusion is toggled OFF but patterns are still stored THEN a confirmation is still required", () => {
		const hiddenPatterns: SettingsWriteContext = {
			...TUNED_CTX,
			nodeExclusion: { enabled: false, patterns: ["^archive/"] },
		};
		expect(planSettingsResetConfirmation("node-exclusion", hiddenPatterns)?.items).toEqual(["^archive/"]);
	});

	it("WHEN there is no pattern to destroy THEN the node-exclusion reset needs no confirmation", () => {
		const noPatterns: SettingsWriteContext = { ...TUNED_CTX, nodeExclusion: { enabled: true, patterns: [] } };
		expect(planSettingsResetConfirmation("node-exclusion", noPatterns)).toBeNull();
	});

	it("WHEN a node-exclusion reset is confirmed THEN the confirm button restates the deletion", () => {
		expect(planSettingsResetConfirmation("node-exclusion", TUNED_CTX)?.confirmText).toBe(
			"Delete patterns and restore defaults",
		);
	});
});

describe("planSettingsResetConfirmation other scopes", () => {
	it("WHEN a section that only holds numeric knobs is reset THEN it applies without a confirmation", () => {
		const confirmed = SECTION_RESET_SCOPES.filter(
			(scope) => scope !== "node-exclusion" && planSettingsResetConfirmation(scope, TUNED_CTX) !== null,
		);
		expect(confirmed).toEqual([]);
	});

	it("WHEN the tab-wide scope is reset THEN a confirmation is always required, even at defaults", () => {
		const defaults: SettingsWriteContext = {
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		};
		expect(planSettingsResetConfirmation("all", defaults)).not.toBeNull();
	});

	it("WHEN the tab-wide confirmation is read THEN its body warns the action cannot be undone", () => {
		expect(planSettingsResetConfirmation("all", TUNED_CTX)?.body).toContain("cannot be undone");
	});
});

describe("settings reset scope catalogue", () => {
	it("WHEN the section scopes are listed THEN they cover every scope except the tab-wide one", () => {
		expect([...SECTION_RESET_SCOPES, "all"].sort()).toEqual(Object.keys(SETTINGS_RESET_SCOPES).sort());
	});

	it("WHEN each scope's copy is read THEN its label names the scope it resets (never a bare 'Restore defaults')", () => {
		const labels = Object.values(SETTINGS_RESET_SCOPES).map((scope) => scope.label);
		expect(labels.filter((label) => label === "Restore defaults")).toEqual([]);
	});

	it("WHEN the tab-wide scope's label is read THEN it names the whole plugin", () => {
		expect(SETTINGS_RESET_SCOPES.all.label).toBe("Restore all Vicinity Graph settings");
	});

	/**
	 * The label claims "all Vicinity Graph settings", so the description MUST say
	 * what survives — otherwise a user reads it as "my pins are gone too". Pins are
	 * the only user-created state a reset leaves behind now that settings are
	 * global-only (there is no per-note override layer left to mention).
	 */
	it("WHEN the tab-wide scope's description is read THEN it states that pinned notes are kept", () => {
		expect(SETTINGS_RESET_SCOPES.all.description).toContain("Pinned notes are kept.");
	});

	it("WHEN the tab-wide scope's description is read THEN it does NOT scope itself to 'this tab'", () => {
		expect(SETTINGS_RESET_SCOPES.all.description).not.toContain("this tab");
	});
});

/**
 * The tab-wide description ENUMERATES the sections it clears ("depth defaults,
 * node sizing, …"), so a section added without extending that sentence turns the
 * sentence into a lie about the button's blast radius — exactly what merging a
 * new settings section produced once. The noun is derived from each section's OWN
 * label ("Restore <noun> defaults"), so there is no second list to keep in sync.
 */
describe("tab-wide description enumerates every section", () => {
	const sectionNouns = SECTION_RESET_SCOPES.map((scope) =>
		SETTINGS_RESET_SCOPES[scope].label.replace(/^Restore /, "").replace(/ defaults$/, ""),
	);

	it("WHEN a section label is reduced to its noun THEN the noun is non-empty (so the check below is not vacuous)", () => {
		expect(sectionNouns.filter((noun) => noun.length === 0)).toEqual([]);
	});

	it("WHEN the tab-wide description is read THEN every section it resets is named in it", () => {
		const unnamed = sectionNouns.filter((noun) => !SETTINGS_RESET_SCOPES.all.description.includes(noun));
		expect(unnamed).toEqual([]);
	});
});
