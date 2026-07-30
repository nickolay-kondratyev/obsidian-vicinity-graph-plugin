import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVERY_SETTINGS_ROW, SETTINGS_ROW_CONTROL_KINDS } from "./settingsRows";
import { SETTINGS_SECTIONS } from "./settingsSectionFields";

/**
 * TAB ⇄ PANEL PARITY over the declared row model.
 *
 * Obsidian's `Setting` API cannot mount inside React, so there are two renderer
 * implementations and there always will be. The guarantee this file makes is that
 * they render the SAME declared model:
 *
 * 1. Both presenters iterate `SETTINGS_SECTIONS` and `SETTINGS_GROUPS`, so every
 *    declared section and every declared row reaches both surfaces by construction.
 * 2. Both dispatch on `row.control.kind` in an EXHAUSTIVE `switch`, so a new control
 *    kind is a COMPILE error in both — that, not this file, is the primary guard.
 * 3. Neither surface names an individual row, so it cannot single one out.
 *
 * What a compile error cannot catch is a presenter that stops reading the model at
 * all (hard-coding its rows again), handles a kind with a partial `if` chain that
 * silently renders nothing, or — the way this shipped broken once — writes a `void`
 * switch with no `default`, which TypeScript is perfectly happy to let fall through.
 * Hence a SOURCE SCAN, for the same reason
 * `engineDefaultsSingleSource`, `importGuard` and `selectorGuard` are source scans:
 * the repo has no ESLint and no React component-test infrastructure (tracked in
 * `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`), so nothing under `npm test` can render either
 * surface and observe its rows.
 *
 * Structural, never a hand-enumerated list: everything asserted is derived from
 * `settingsRows.ts`, so declaring a row is the only edit a new setting needs.
 *
 * WHAT THIS FILE DOES NOT GUARANTEE — stated plainly, because a reader who over-trusts
 * a guard is worse off than one who knows its edge:
 * - It is a source scan, so it proves a `case` EXISTS, never that the case renders a
 *   control, renders it with the declared label, or renders it in the declared order.
 * - Assertion 3 blocks the realistic per-row escape (naming a row) but not an
 *   INDEX- or PREDICATE-based subset of a block's rows (`rows.slice(1)`,
 *   `rows.filter(somePredicate)`), which names nothing.
 * Both residuals need a surface that can be RENDERED and inspected, i.e. the component
 * -test harness in `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` — recorded on that ticket.
 */

const VIEW_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The two presenter modules. Named per SURFACE, so a failure says which surface is
 * missing something rather than which file.
 */
const PRESENTERS: Readonly<Record<string, string>> = {
	"settings tab": "VicinityGraphSettingTab.ts",
	"controls panel": "SettingsRowView.tsx",
};

/**
 * The modules that walk the declared SECTIONS into cards / disclosures. The panel
 * splits that job in two (`GraphToolbar` walks sections, `SettingsRowView` renders a
 * row it is handed), so only the outer half appears here.
 */
const SECTION_WALKERS: Readonly<Record<string, string>> = {
	"settings tab": "VicinityGraphSettingTab.ts",
	"controls panel": "GraphToolbar.tsx",
};

/**
 * Every module that renders any part of a declared row, deduplicated — the settings tab
 * is its own section walker AND its own row presenter, so it appears in both tables above.
 * Keyed by MODULE rather than by surface on purpose: a surface-keyed record would collapse
 * the panel's two halves onto one key and silently drop one of them from the scan.
 */
const EVERY_ROW_RENDERING_MODULE: readonly string[] = [
	...new Set([...Object.values(PRESENTERS), ...Object.values(SECTION_WALKERS)]),
];

/**
 * A module's source with its COMMENTS removed, so nothing this file asserts can be
 * satisfied by prose or by commented-out code. Only LINE-LEADING `//` (and JSDoc `*`
 * continuations) are dropped: a `//` inside a string literal — a URL — must survive, and
 * commented-out code is line-leading by construction, so that is enough.
 */
function source(module: string): string {
	return readFileSync(`${VIEW_DIR}/${module}`, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.filter((line) => !/^\s*(\/\/|\*)/.test(line))
		.join("\n");
}

/** Surfaces whose walker no longer reads `symbol` — the drift this ticket removed. */
function walkersNotReading(symbol: string): string[] {
	return Object.entries(SECTION_WALKERS)
		.filter(([, module]) => !source(module).includes(symbol))
		.map(([surface]) => `${surface} no longer renders from ${symbol}`);
}

describe("settings row parity: tab and panel present the same declared rows", () => {
	it("WHEN the model declares a control kind THEN every presenter has a `case` for it", () => {
		const missing = Object.entries(PRESENTERS).flatMap(([surface, module]) => {
			const text = source(module);
			// `case "kind":` and not a bare mention of the kind: the kind name appears in
			// prose comments on both surfaces, which a substring scan would accept.
			return SETTINGS_ROW_CONTROL_KINDS.filter((kind) => !text.includes(`case "${kind}":`)).map(
				(kind) => `${surface} does not handle control kind=[${kind}]`,
			);
		});
		expect(missing).toEqual([]);
	});

	it("WHEN a presenter's switch is scanned THEN it is closed by the shared exhaustiveness guard", () => {
		// The property this pins is the one a `void` switch loses silently: without a
		// `default` calling `unhandledRowControl`, the settings tab compiled clean while
		// rendering NOTHING for an unhandled kind.
		const unguarded = Object.entries(PRESENTERS)
			.filter(([, module]) => !source(module).includes("return unhandledRowControl(row.control)"))
			.map(([surface]) => `${surface} does not close its switch with unhandledRowControl`);
		expect(unguarded).toEqual([]);
	});

	it("WHEN a row is declared THEN no surface names it, so no surface can single it out", () => {
		// PER ROW, not per kind: the four assertions around this one all pass if a presenter
		// special-cases ONE row (`if (row.label === "Node cap") return <></>`) or if a walker
		// drops one from a block. A row's only identity in the model is its `label` (there is
		// no row id), so a surface that mentions no label cannot treat one row differently.
		// Surfaces render the label from `row.label`; a literal one is always a special case.
		const named = EVERY_ROW_RENDERING_MODULE.flatMap((module) => {
			const text = source(module);
			return EVERY_SETTINGS_ROW.filter((row) =>
				[`"${row.label}"`, `'${row.label}'`, `\`${row.label}\``].some((quoted) => text.includes(quoted)),
			).map((row) => `${module} hard-codes the label of row=[${row.label}]`);
		});
		expect(named).toEqual([]);
	});

	it("WHEN a surface is scanned THEN it reads the declared groups rather than its own row list", () => {
		expect(walkersNotReading("SETTINGS_GROUPS")).toEqual([]);
	});

	it("WHEN a surface is scanned THEN it walks every declared section rather than a chosen subset", () => {
		expect(walkersNotReading("SETTINGS_SECTIONS")).toEqual([]);
	});

	it("WHEN the scan runs THEN the model it checks against is non-empty (the guard is not vacuous)", () => {
		expect(EVERY_SETTINGS_ROW.length).toBeGreaterThan(SETTINGS_SECTIONS.length);
		expect(SETTINGS_ROW_CONTROL_KINDS.length).toBeGreaterThan(0);
		// More modules than surfaces: the panel splits section walking from row rendering,
		// so a scan that lost one of the two halves would show up here as an equal count.
		expect(EVERY_ROW_RENDERING_MODULE.length).toBeGreaterThan(Object.keys(PRESENTERS).length);
	});
});
