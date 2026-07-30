import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * EVERY typed number field in the controls panel is UNCONTROLLED and commits through
 * the ONE shared blur protocol — not just the ones that happen to go through
 * `NumberRow`.
 *
 * WHY a source scan: nothing under `npm test` renders React (see
 * `settingsRowParity.test.ts`), so the decision a blur makes is tested at its seam
 * (`numberRowCommit.test.ts`) and the fact that a field is WIRED to that seam can only
 * be observed in the source.
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

const PANEL_MODULE = `${dirname(fileURLToPath(import.meta.url))}/SettingsRowView.tsx`;

/** The panel's source with COMMENTS removed, so no assertion here can be satisfied by prose. */
function panelSource(): string {
	return readFileSync(PANEL_MODULE, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.filter((line) => !/^\s*(\/\/|\*)/.test(line))
		.join("\n");
}

/**
 * The attribute text of every `<input type="number">` in the panel, one entry per field.
 *
 * An element runs from `<input` to its self-closing `/>`; no attribute value in this
 * module contains that pair (an arrow function spells `=>`).
 */
function numberFieldMarkup(): readonly string[] {
	return panelSource()
		.split("<input")
		.slice(1)
		.map((element) => {
			const end = element.indexOf("/>");
			return end === -1 ? element : element.slice(0, end);
		})
		.filter((element) => element.includes('type="number"'));
}

/** The props object the shared blur-commit hook hands a field, spread onto the input. */
const SPREAD_COMMIT_PROPS = /\{\.\.\.\w+\.inputProps\}/;

/** A CONTROLLED value binding — `defaultValue={…}` deliberately does not match. */
const CONTROLLED_VALUE = /(^|[^A-Za-z])value=\{/;

describe("controls panel: typed number fields", () => {
	it("WHEN the panel renders a typed number field THEN it takes the shared blur-commit props", () => {
		const unwired = numberFieldMarkup().filter((element) => !SPREAD_COMMIT_PROPS.test(element));
		expect(unwired).toEqual([]);
	});

	it("WHEN the panel renders a typed number field THEN it is uncontrolled, so no clamp lands mid-word", () => {
		const controlled = numberFieldMarkup().filter((element) => CONTROLLED_VALUE.test(element));
		expect(controlled).toEqual([]);
	});

	it("WHEN the scan runs THEN it found the panel's typed fields (the guard is not vacuous)", () => {
		// At least two: the shared number row, and the per-metric weight beside its toggle.
		expect(numberFieldMarkup().length).toBeGreaterThanOrEqual(2);
	});
});
