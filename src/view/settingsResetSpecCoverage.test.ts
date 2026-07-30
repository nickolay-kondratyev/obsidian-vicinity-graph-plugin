import { describe, expect, it } from "vitest";
import {
	SETTINGS_FIELD_LEAVES,
	alternateSettingsRoot,
	readLeaf,
} from "../engine/testFixtures/settingsSpecLeaves";
import type { SettingsSpecLeaf } from "../engine/testFixtures/settingsSpecLeaves";
import { ALL_SETTINGS_RESET_SCOPE, planSettingsReset } from "./settingsResetPlan";
import { SECTION_SETTINGS_FIELDS, SETTINGS_SECTIONS } from "./settingsSectionFields";
import type { SettingsSection } from "./settingsSectionFields";
import type { SettingsCommand, SettingsWriteContext } from "./settingsWritePlan";

/**
 * RESTORE-DEFAULTS, over every declared settings field.
 *
 * `settingsResetPlan.test.ts` states the reset CONTRACT per scope (which commands, which
 * confirmation copy) with hand-written contexts. This file states the total claim that no
 * hand-written context can keep true: starting from a root where EVERY declared field
 * holds a non-default value, no field is left behind — and each field is restored by
 * exactly ONE section scope, so every card's button has a readable blast radius.
 *
 * A field added to `SETTINGS_SPEC` but given no section home, or a section whose key list
 * forgot it, fails here naming the field — where before it silently had no scoped
 * restore-defaults at all.
 */

/** Applies one settings command to a context, the way the write pipeline's store does. */
function applyCommand(context: SettingsWriteContext, command: SettingsCommand): SettingsWriteContext {
	switch (command.kind) {
		case "global-depths":
			return { ...context, globalDepths: command.depths };
		case "global-view":
			return { ...context, globalView: command.view };
		case "node-exclusion":
			return { ...context, nodeExclusion: command.nodeExclusion };
	}
}

function applyReset(context: SettingsWriteContext, commands: readonly SettingsCommand[]): SettingsWriteContext {
	return commands.reduce(applyCommand, context);
}

/** The all-non-default starting point every case below resets FROM. */
function nonDefaultContext(): SettingsWriteContext {
	return alternateSettingsRoot();
}

/**
 * The sections that claim `leaf` — read off the declared section→field table, matching on
 * the leaf's TOP-LEVEL settings field (`globalView.sizing.minPx` is owned by whichever
 * section owns `sizing`, since that is the granularity a reset command writes at).
 */
function sectionsOwning(leaf: SettingsSpecLeaf): readonly SettingsSection[] {
	const family = leaf.path[0];
	const field = leaf.path[1];
	return SETTINGS_SECTIONS.filter((section) => {
		const fields = SECTION_SETTINGS_FIELDS[section];
		const keys: readonly string[] =
			family === "globalView" ? fields.view : family === "globalDepths" ? fields.depth : fields.exclusion;
		return field !== undefined && keys.includes(field);
	});
}

describe("restore-defaults covers every declared settings field", () => {
	it("WHEN the field walk runs THEN it found fields to check (the guard is not vacuous)", () => {
		expect(SETTINGS_FIELD_LEAVES.length).toBeGreaterThan(SETTINGS_SECTIONS.length);
	});

	it("WHEN the tab-wide reset is applied over non-default settings THEN every declared field is back at its declared default", () => {
		const context = nonDefaultContext();
		const restored = applyReset(context, planSettingsReset(ALL_SETTINGS_RESET_SCOPE, context));
		const leftBehind = SETTINGS_FIELD_LEAVES.filter(
			(leaf) => JSON.stringify(readLeaf(restored, leaf)) !== JSON.stringify(leaf.default),
		).map((leaf) => `${leaf.id}: still [${JSON.stringify(readLeaf(restored, leaf))}]`);
		expect(leftBehind).toEqual([]);
	});

	it("WHEN a declared field is looked up in the section table THEN exactly one section owns it", () => {
		const homeless = SETTINGS_FIELD_LEAVES.filter((leaf) => sectionsOwning(leaf).length !== 1).map(
			(leaf) => `${leaf.id}: owned by [${sectionsOwning(leaf).join(", ")}]`,
		);
		expect(homeless).toEqual([]);
	});

	it("WHEN a section's reset is applied THEN every field that section owns is back at its declared default", () => {
		const wrong = SETTINGS_SECTIONS.flatMap((section) => {
			const context = nonDefaultContext();
			const restored = applyReset(context, planSettingsReset(section, context));
			return SETTINGS_FIELD_LEAVES.filter((leaf) => sectionsOwning(leaf).includes(section))
				.filter((leaf) => JSON.stringify(readLeaf(restored, leaf)) !== JSON.stringify(leaf.default))
				.map((leaf) => `${section} did not restore ${leaf.id}`);
		});
		expect(wrong).toEqual([]);
	});

	it("WHEN a section's reset is applied THEN no field outside that section changes (a readable blast radius)", () => {
		const collateral = SETTINGS_SECTIONS.flatMap((section) => {
			const context = nonDefaultContext();
			const restored = applyReset(context, planSettingsReset(section, context));
			return SETTINGS_FIELD_LEAVES.filter((leaf) => !sectionsOwning(leaf).includes(section))
				.filter((leaf) => JSON.stringify(readLeaf(restored, leaf)) !== JSON.stringify(readLeaf(context, leaf)))
				.map((leaf) => `resetting ${section} also changed ${leaf.id}`);
		});
		expect(collateral).toEqual([]);
	});
});
