import { describe, expect, it } from "vitest";
import type { ViewSettings } from "../engine";
import { EngineDefaults } from "../engine";
import { SECTION_RESET_SCOPES, planSettingsReset } from "./settingsResetPlan";
import { SECTION_SETTINGS_FIELDS, SETTINGS_SECTIONS, type SectionSettingsFields } from "./settingsSectionFields";
import type { SettingsWriteContext } from "./settingsWritePlan";

/**
 * These cover what the module's compile guard CANNOT see: a field listed in TWO
 * sections (which would make two cards both claim to own it, and two scoped
 * resets both write it). The compile guard catches the other direction — a field
 * listed in NO section.
 *
 * Field names come from the engine's own defaults factories, so the expectation
 * grows by itself the day a settings field is added.
 */

function listedFields(family: keyof SectionSettingsFields): string[] {
	return SETTINGS_SECTIONS.flatMap((section) => [...SECTION_SETTINGS_FIELDS[section][family]]);
}

describe("settings section field map", () => {
	it("WHEN the section map is read THEN every ViewSettings field appears in exactly one section", () => {
		expect(listedFields("view").sort()).toEqual(Object.keys(EngineDefaults.viewSettings()).sort());
	});

	it("WHEN the section map is read THEN every DepthSettings field appears in exactly one section", () => {
		expect(listedFields("depth").sort()).toEqual(Object.keys(EngineDefaults.depthSettings()).sort());
	});

	it("WHEN the section map is read THEN every NodeExclusionSettings field appears in exactly one section", () => {
		expect(listedFields("exclusion").sort()).toEqual(Object.keys(EngineDefaults.nodeExclusionSettings()).sort());
	});

	/**
	 * The sections and the per-section reset scopes are the same six cards seen
	 * from two sides; a section with no reset scope would be a card whose
	 * "Restore defaults" row silently does not exist.
	 */
	it("WHEN the section list is read THEN it matches the settings-tab section reset scopes", () => {
		expect([...SETTINGS_SECTIONS]).toEqual([...SECTION_RESET_SCOPES]);
	});
});

/**
 * The coverage property stated BEHAVIOURALLY, end-to-end: the section map is
 * what `planSettingsReset` derives each card's reset from, so "every field
 * belongs to some section" is only worth anything if walking every section
 * actually restores every field. This is what would catch the derivation
 * consuming the map wrongly (e.g. reading the same family column twice).
 *
 * Lives here rather than in `settingsResetPlan.test.ts` because the property
 * under test is the section MAP's completeness; `planSettingsReset` is the
 * observation mechanism. (It also keeps that file byte-identical across this
 * refactor, which is how we know behaviour was preserved.)
 */
describe("section resets together cover every settings field", () => {
	const TUNED: SettingsWriteContext = {
		globalDepths: { outgoingDepth: 4, incomingDepth: 5 },
		globalView: {
			nodeCap: 17,
			outlineMaxDepth: 5,
			nodePreviewPreference: "image",
			sizing: { ...EngineDefaults.sizingSettings(), minPx: 11, maxPx: 999 },
			forceLayout: { ...EngineDefaults.forceLayoutSettings(), repelStrength: 900 },
		},
		nodeExclusion: { enabled: true, patterns: ["^archive/"] },
	};

	/** Applies every section's reset in turn, feeding each write into the next section's context. */
	function afterEverySectionReset(): SettingsWriteContext {
		let ctx = TUNED;
		for (const section of SETTINGS_SECTIONS) {
			for (const command of planSettingsReset(section, ctx)) {
				switch (command.kind) {
					case "global-view":
						ctx = { ...ctx, globalView: command.view };
						break;
					case "global-depths":
						ctx = { ...ctx, globalDepths: command.depths };
						break;
					case "node-exclusion":
						ctx = { ...ctx, nodeExclusion: command.nodeExclusion };
						break;
					default:
						throw new Error(`a section reset emitted an unexpected command: ${command.kind}`);
				}
			}
		}
		return ctx;
	}

	it("WHEN every section is reset from a tuned context THEN every ViewSettings field is back at its default", () => {
		expect(afterEverySectionReset().globalView).toEqual<ViewSettings>(EngineDefaults.viewSettings());
	});

	it("WHEN every section is reset from a tuned context THEN every DepthSettings field is back at its default", () => {
		expect(afterEverySectionReset().globalDepths).toEqual(EngineDefaults.depthSettings());
	});

	it("WHEN every section is reset from a tuned context THEN every NodeExclusionSettings field is back at its default", () => {
		expect(afterEverySectionReset().nodeExclusion).toEqual(EngineDefaults.nodeExclusionSettings());
	});
});
