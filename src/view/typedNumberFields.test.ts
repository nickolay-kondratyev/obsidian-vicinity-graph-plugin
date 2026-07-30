import { describe, expect, it } from "vitest";
import { EVERY_ROW_RENDERING_MODULE, readRowSourceWithoutComments } from "./rowRenderingSource";

/**
 * EVERY typed number field on a settings surface is UNCONTROLLED and commits through the
 * ONE shared blur protocol — not just the ones that happen to go through `NumberRow`.
 *
 * WHY a source scan: nothing under `npm test` renders React (see
 * `settingsRowParity.test.ts`), so the decision a blur makes is tested at its seam
 * (`numberRowCommit.test.ts`) and the fact that a field is WIRED to that seam can only
 * be observed in the source.
 *
 * WHY every row-rendering module and not just the panel's presenter: a typed field added
 * to a row's own component (`DepthStepper`) or to the section walker (`GraphToolbar`) is
 * the same field with the same clamp, one file over — the narrower scan would have said
 * nothing about it. The settings tab is in the list and costs nothing: it builds its rows
 * through Obsidian's `Setting` API rather than JSX, so it contributes no elements here,
 * and its typed rows are guarded by their own debounce suite.
 *
 * WHAT IT PROTECTS: a controlled typed field writes per keystroke, so the write path's
 * clamp lands mid-word — typing `500` into a field whose ceiling is `400` snapped the
 * box after the third key. Every such field was converted once; this is what stops the
 * next one being added the old way (the per-metric weight was exactly that leftover).
 *
 * WHAT IT DOES NOT GUARANTEE: it proves the props are SPREAD onto the field, never
 * that the surrounding component renders the refusal those props describe, nor that
 * the field is placed correctly. Both need a surface that can be rendered
 * (`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`).
 */

/** One `<input type="number">` found in a scanned module: its attribute text, and where it lives. */
interface TypedNumberField {
	readonly module: string;
	readonly attributes: string;
}

/**
 * Every typed number field across the row-rendering modules.
 *
 * An element runs from `<input` to its self-closing `/>`; no attribute value in these
 * modules contains that pair (an arrow function spells `=>`).
 */
function typedNumberFields(): readonly TypedNumberField[] {
	return EVERY_ROW_RENDERING_MODULE.flatMap((module) =>
		readRowSourceWithoutComments(module)
			.split("<input")
			.slice(1)
			.map((element) => {
				const end = element.indexOf("/>");
				return { module, attributes: end === -1 ? element : element.slice(0, end) };
			})
			.filter((field) => field.attributes.includes('type="number"')),
	);
}

/** The props object the shared blur-commit hook hands a field, spread onto the input. */
const SPREAD_COMMIT_PROPS = /\{\.\.\.\w+\.inputProps\}/;

/** A CONTROLLED value binding — `defaultValue={…}` deliberately does not match. */
const CONTROLLED_VALUE = /(^|[^A-Za-z])value=\{/;

/** The offending modules, named — a failure has to say which file to open. */
function modulesWithFieldsMatching(offends: (attributes: string) => boolean, complaint: string): string[] {
	return typedNumberFields()
		.filter((field) => offends(field.attributes))
		.map((field) => `${field.module}: a typed number field ${complaint}`);
}

describe("settings surfaces: typed number fields", () => {
	it("WHEN a module renders a typed number field THEN it takes the shared blur-commit props", () => {
		const unwired = modulesWithFieldsMatching(
			(attributes) => !SPREAD_COMMIT_PROPS.test(attributes),
			"is not wired to the shared blur-commit hook",
		);
		expect(unwired).toEqual([]);
	});

	it("WHEN a module renders a typed number field THEN it is uncontrolled, so no clamp lands mid-word", () => {
		const controlled = modulesWithFieldsMatching(
			(attributes) => CONTROLLED_VALUE.test(attributes),
			"is controlled, so it writes per keystroke",
		);
		expect(controlled).toEqual([]);
	});

	it("WHEN the scan runs THEN it found the panel's typed fields (the guard is not vacuous)", () => {
		// At least two: the shared number row, and the per-metric weight beside its toggle.
		expect(typedNumberFields().length).toBeGreaterThanOrEqual(2);
	});
});
