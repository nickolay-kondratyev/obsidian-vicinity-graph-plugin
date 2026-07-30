import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * WHICH modules render a declared settings row, and how to READ one for a source scan.
 *
 * A test-support module (nothing in the plugin bundle imports it), shared by every guard
 * that inspects the row renderers' source — `settingsRowParity.test.ts` and
 * `typedNumberFields.test.ts` today. WHY shared: the module LIST is the thing that
 * decides how much each of those guards covers, and a second copy of it silently narrows
 * whichever guard was not updated when a renderer was added.
 *
 * WHY source scans exist at all: nothing under `npm test` renders React (see
 * `settingsRowParity.test.ts`), so a property of the MARKUP — that a case exists, that a
 * field is wired to the shared commit protocol — can only be observed in the text.
 */

const VIEW_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The two presenter modules — the `switch` over `SettingsRowControl` on each surface.
 * Named per SURFACE, so a failure says which surface is missing something rather than
 * which file.
 */
export const ROW_PRESENTERS: Readonly<Record<string, string>> = {
	"settings tab": "VicinityGraphSettingTab.ts",
	"controls panel": "SettingsRowView.tsx",
};

/**
 * The modules that walk the declared SECTIONS into cards / disclosures. The panel
 * splits that job in two (`GraphToolbar` walks sections, `SettingsRowView` renders a
 * row it is handed), so only the outer half appears here.
 */
export const ROW_SECTION_WALKERS: Readonly<Record<string, string>> = {
	"settings tab": "VicinityGraphSettingTab.ts",
	"controls panel": "GraphToolbar.tsx",
};

/**
 * Components a presenter delegates ONE control kind to. They render a declared row just
 * as much as the presenter that mounts them, so the scans must reach them too —
 * otherwise "hard-code it in a child component" is an open escape hatch.
 */
export const ROW_CONTROL_COMPONENTS: Readonly<Record<string, string>> = {
	"depth stepper": "DepthStepper.tsx",
};

/**
 * Every module that renders any part of a declared row, deduplicated — the settings tab
 * is its own section walker AND its own row presenter, so it appears in two tables above.
 * Keyed by MODULE rather than by surface on purpose: a surface-keyed record would collapse
 * the panel's two halves onto one key and silently drop one of them from the scan.
 */
export const EVERY_ROW_RENDERING_MODULE: readonly string[] = [
	...new Set([
		...Object.values(ROW_PRESENTERS),
		...Object.values(ROW_SECTION_WALKERS),
		...Object.values(ROW_CONTROL_COMPONENTS),
	]),
];

/**
 * A module's source with its COMMENTS removed, so nothing a scan asserts can be satisfied
 * by prose or by commented-out code. Only LINE-LEADING `//` (and JSDoc `*` continuations)
 * are dropped: a `//` inside a string literal — a URL — must survive, and commented-out
 * code is line-leading by construction, so that is enough.
 */
export function readRowSourceWithoutComments(module: string): string {
	return readFileSync(`${VIEW_DIR}/${module}`, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.filter((line) => !/^\s*(\/\/|\*)/.test(line))
		.join("\n");
}
