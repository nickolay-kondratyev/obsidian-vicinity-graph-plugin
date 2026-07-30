import { describe, expect, it } from "vitest";
import { SETTINGS_FIELD_LEAVES } from "../engine/testFixtures/settingsSpecLeaves";
import { EVERY_SETTINGS_ROW, unhandledRowControl } from "./settingsRows";
import type { SettingsRowControl } from "./settingsRows";

/**
 * REACHABILITY, over every declared settings field: a field in `SETTINGS_SPEC` that no
 * declared ROW edits ships as a setting no user can reach except by hand-editing
 * `data.json`.
 *
 * WHY THIS FILE EXISTS: declaring the row in `SETTINGS_GROUPS` was the LAST step of
 * adding a settings field that failed SILENTLY. Every other step is either
 * compile-forced (`SETTINGS_SPEC` completeness, `EngineDefaults`, `definedFieldsOnly`,
 * `SECTION_SETTINGS_FIELDS`) or already walked by a spec-iterating suite — while
 * `settingsRowParity.test.ts` walks the ROWS, so a missing row was merely a smaller
 * walk that still passed. Measured on `embedDepthOut`, the first field added under the
 * declarative row model (ticket `nid_fay1hu5sxcoygizopkkg0f0d7_e`).
 *
 * The hole is ONE-DIRECTIONAL and only this direction needed closing: a row naming a
 * BOGUS field is already a compile error, because every control arm carries a typed
 * field reference (`keyof DepthSettings`, `SizeMetricId`, …).
 *
 * Bounds-only spec leaves are out of scope by construction — {@link SETTINGS_FIELD_LEAVES}
 * already excludes them (they declare bounds for a sibling shape and are no field at all,
 * so there is nothing to render).
 */

/**
 * The spec leaf a row's control edits, as a dotted id — the join between the ROW model
 * (typed per-family field references) and the SPEC walk (paths into the settings root).
 *
 * A `switch` closed by {@link unhandledRowControl} rather than a table, so a new control
 * kind cannot reach this file without stating which field it edits: without that, a new
 * kind would make its own leaf look row-less and the failure would blame the wrong thing.
 * The dotted PATHS are the one hand-written part, which is what the "no stale mapping"
 * test below exists to pin.
 */
function specLeafIdFor(control: SettingsRowControl): string {
	switch (control.kind) {
		case "depth":
			return `globalDepths.${control.field}`;
		case "sizing-metric":
			return `globalView.sizing.metrics.${control.metric}`;
		case "sizing-number":
			return `globalView.sizing.${control.field}`;
		case "node-preview":
			return "globalView.nodePreviewPreference";
		case "outline-depth":
			return "globalView.outlineMaxDepth";
		case "force-layout":
			return `globalView.forceLayout.${control.field}`;
		case "exclusion-enabled":
			return "nodeExclusion.enabled";
		case "exclusion-patterns":
			return "nodeExclusion.patterns";
		case "node-cap":
			return "globalView.nodeCap";
		default:
			return unhandledRowControl(control);
	}
}

/**
 * Settings fields deliberately given NO row, each with the reason — the same
 * allowlist-with-a-reason pattern as `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE`
 * (`src/engine/settingsSpecBounds.test.ts`), never a silent skip.
 *
 * EMPTY TODAY: every declared field is reachable from both surfaces. An entry here is a
 * deliberate statement that a field is editable only by hand-editing `data.json`; write
 * WHY, and expect a reviewer to ask. The tests below keep it from rotting: an entry whose
 * field has since GAINED a row, or whose field no longer exists, FAILS.
 */
const ROW_LESS_SETTINGS_FIELDS: Readonly<Record<string, string>> = {};

/** Every spec leaf id some declared row edits. */
const FIELDS_WITH_A_ROW: ReadonlySet<string> = new Set(EVERY_SETTINGS_ROW.map((row) => specLeafIdFor(row.control)));

const DECLARED_FIELD_IDS: ReadonlySet<string> = new Set(SETTINGS_FIELD_LEAVES.map((leaf) => leaf.id));

describe("settings rows cover every declared settings field", () => {
	it("WHEN the spec declares a settings field THEN some declared row edits it", () => {
		const unreachable = SETTINGS_FIELD_LEAVES.filter(
			(leaf) => !FIELDS_WITH_A_ROW.has(leaf.id) && ROW_LESS_SETTINGS_FIELDS[leaf.id] === undefined,
		).map((leaf) => `${leaf.id}: no row in SETTINGS_GROUPS edits it (no user can reach this setting)`);
		expect(unreachable).toEqual([]);
	});

	it("WHEN a row's control is mapped to a spec leaf THEN the spec still declares that leaf (no stale mapping)", () => {
		// Guards the hand-written dotted paths above: the compiler checks a row's FIELD NAME
		// against the settings types, but nothing checks where that field sits in the spec
		// tree — so a re-nested spec would otherwise make every row look like it edits a
		// field that does not exist, and the test above would pass by matching nothing.
		const stale = [...FIELDS_WITH_A_ROW].filter((id) => !DECLARED_FIELD_IDS.has(id));
		expect(stale).toEqual([]);
	});

	it("WHEN a field is allowlisted as row-less THEN the spec still declares it (no stale allowlist)", () => {
		const stale = Object.keys(ROW_LESS_SETTINGS_FIELDS).filter((id) => !DECLARED_FIELD_IDS.has(id));
		expect(stale).toEqual([]);
	});

	it("WHEN a field is allowlisted as row-less THEN it really has no row (the reason is still true)", () => {
		const contradicted = Object.keys(ROW_LESS_SETTINGS_FIELDS).filter((id) => FIELDS_WITH_A_ROW.has(id));
		expect(contradicted).toEqual([]);
	});

	it("WHEN the walk runs THEN it found fields to check (the guard is not vacuous)", () => {
		expect(FIELDS_WITH_A_ROW.size).toBeGreaterThan(Object.keys(ROW_LESS_SETTINGS_FIELDS).length);
	});

	it("WHEN the rows are mapped THEN no two rows edit the same field (one setting, one control)", () => {
		// A Set is what the coverage test matches against, so two rows on one field would
		// collapse into one entry — and the second row is a genuine bug anyway: two controls
		// writing one field can only disagree on screen.
		const mapped = EVERY_SETTINGS_ROW.map((row) => specLeafIdFor(row.control));
		const duplicated = mapped.filter((id, index) => mapped.indexOf(id) !== index);
		expect(duplicated).toEqual([]);
	});
});
