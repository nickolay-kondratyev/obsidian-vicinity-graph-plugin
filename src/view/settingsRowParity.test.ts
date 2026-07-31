import { describe, expect, it } from "vitest";
import {
	EVERY_ROW_RENDERING_MODULE,
	readRowSourceWithoutComments as source,
	ROW_PRESENTERS as PRESENTERS,
	ROW_SECTION_WALKERS as SECTION_WALKERS,
} from "./rowRenderingSource";
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
 * the repo has no ESLint, and the SETTINGS TAB cannot be rendered under `npm test`
 * at all — it builds its rows through Obsidian's `Setting` API and the `obsidian`
 * package is types-only, so only a real Obsidian (the e2e gate) can mount it.
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
 * For the PANEL both residuals are closed by a rendered suite:
 * `GraphToolbar.component.test.tsx` (jsdom) mounts the whole panel and asserts every
 * declared row's controls under their declared accessible names, in declared order.
 * For the TAB they remain open (it cannot mount outside a real Obsidian, see above),
 * which is why this scan keeps covering both surfaces rather than shrinking to one.
 */

/**
 * The engine tables and clamps a presenter must NOT reach for: each one is exactly the
 * "value half" of a row that `settingsRowAccessors.ts` now owns. Named symbols rather
 * than a shape, because a presenter re-deriving a value can only do it by naming one of
 * these — the accessors are the sole other route to them.
 */
const ACCESSOR_OWNED_SYMBOLS: readonly string[] = [
	"SETTINGS_SPEC",
	"SIZING_RANGES",
	"FORCE_LAYOUT_RANGES",
	"MIN_OUTLINE_DEPTH",
	"MAX_OUTLINE_DEPTH",
	"MIN_STEPPER_DEPTH",
	"MAX_STEPPER_DEPTH",
	"clampNodeCap",
	"clampOutlineMaxDepth",
	"clampSizingNumber",
	"clampStepperDepth",
	"parseSizingInput",
];

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

	it("WHEN a row-rendering module is scanned THEN it derives no value, range or clamp of its own", () => {
		// The drift this closes: both presenters used to re-derive, per control kind, the
		// value read, the range-table lookup and the clamp — and two step constants were
		// literally declared in both files. All three now come from `settingsRowAccessors.ts`,
		// so a module naming any of these symbols has started deriving again.
		// EVERY row-rendering module, not just the two presenters: pushing the derivation
		// down into a control component (`DepthStepper` did exactly that with the depth
		// clamp) is the same drift one level lower.
		// (Its VALUE-level correctness is `settingsRowAccessors.test.ts`; this is only the
		// "still reads from the shared accessor" half, which a type cannot express.)
		const derived = EVERY_ROW_RENDERING_MODULE.flatMap((module) => {
			const text = source(module);
			return ACCESSOR_OWNED_SYMBOLS.filter((symbol) => text.includes(symbol)).map(
				(symbol) => `${module} derives symbol=[${symbol}] instead of reading it from SettingsRowAccessors`,
			);
		});
		expect(derived).toEqual([]);
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
