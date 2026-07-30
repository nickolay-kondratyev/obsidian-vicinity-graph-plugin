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

function source(module: string): string {
	return readFileSync(`${VIEW_DIR}/${module}`, "utf8");
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

	it("WHEN a surface is scanned THEN it reads the declared groups rather than its own row list", () => {
		expect(walkersNotReading("SETTINGS_GROUPS")).toEqual([]);
	});

	it("WHEN a surface is scanned THEN it walks every declared section rather than a chosen subset", () => {
		expect(walkersNotReading("SETTINGS_SECTIONS")).toEqual([]);
	});

	it("WHEN the scan runs THEN the model it checks against is non-empty (the guard is not vacuous)", () => {
		expect(EVERY_SETTINGS_ROW.length).toBeGreaterThan(SETTINGS_SECTIONS.length);
		expect(SETTINGS_ROW_CONTROL_KINDS.length).toBeGreaterThan(0);
	});
});
