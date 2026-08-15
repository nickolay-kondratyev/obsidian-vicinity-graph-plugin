import { describe, expect, it } from "vitest";
import type { ViewSettings } from "../engine";
import { EngineDefaults } from "../engine";
import { planSettingsReset } from "./settingsResetPlan";
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

	/*
	 * REMOVED, not weakened: this used to compare `SETTINGS_SECTIONS` against a
	 * second exported tuple (`SECTION_RESET_SCOPES`) to prove no card lacks a
	 * "Restore defaults" row. That alias is gone (`nid_llfhrqo1ecg8tuxigo7bcrrrf_e`)
	 * — `settingsResetPlan` reads `SETTINGS_SECTIONS` itself, so the comparison
	 * became a literal tautology. The same property is still asserted against
	 * `SETTINGS_RESET_SCOPES`'s own key set, which IS an independent declaration:
	 * `settingsResetPlan.test.ts`, "every reset scope has a spec".
	 */
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
		globalDepths: {
			linkDepthOut: 4,
			embedDepthOut: 4,
			linkDepthIn: 5,
			descendantDepth: 3,
			ancestorDepth: 4,
			pinnedLinkDepthOut: 3,
			pinnedEmbedDepthOut: 2,
			pinnedLinkDepthIn: 5,
			pinnedDescendantDepth: 2,
			pinnedAncestorDepth: 1,
		},
		globalView: {
			nodeCap: 17,
			outlineMaxDepth: 5,
			nodePreviewPreference: "image",
			showCrossLinks: true,
			groupLabelFullPath: true,
			edgeDepthIntoGroups: 4,
			sizing: { ...EngineDefaults.sizingSettings(), minPx: 11, maxPx: 999 },
			forceLayout: { ...EngineDefaults.forceLayoutSettings(), repelStrength: 900 },
		},
		nodeExclusion: { enabled: true, patterns: ["^archive/"] },
		frontmatterLinks: { idRefFields: "deps, links" },
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
					case "frontmatter-links":
						ctx = { ...ctx, frontmatterLinks: command.frontmatterLinks };
						break;
					// No default arm: every SettingsCommand kind is handled above, so a NEW
					// kind is a compile error here rather than a runtime surprise.
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
