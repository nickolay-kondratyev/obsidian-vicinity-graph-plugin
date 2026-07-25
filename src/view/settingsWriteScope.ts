import type { SettingsCommand } from "./settingsWritePlan";

/**
 * The blast radius of one settings write — how far the rebuild must reach.
 *
 * `global` writes land in `data.json`, which EVERY open graph view reads on its
 * next rebuild, so every open view is stale until it rebuilds. `per-doc` writes
 * land in the MAIN doc's own file and rebuild ONLY the writing view.
 *
 * WHY-NOT fan `per-doc` out as well: that is a scope boundary, not an invariant.
 * Sibling views are NOT insulated — every view follows the active file
 * (`VicinityGraphView.registerGraphEvents`), so two open views normally share the
 * same MAIN and the non-writing one DOES go stale on a depth write. Widening it
 * is deliberately deferred: see
 * `docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`.
 */
export type SettingsWriteScope = "global" | "per-doc";

/**
 * Pure classifier over {@link SettingsCommand} — the decision the obsidian
 * executor branches on. The switch is exhaustive and every arm returns, so
 * (with `noImplicitReturns`) a future command kind fails to COMPILE until its
 * scope is declared: no new kind can silently inherit the wrong blast radius.
 *
 * The same 3-global / 2-per-doc partition already exists in
 * `VicinityGraphSettingTab.persist()`, which handles the global kinds and
 * returns for the per-doc ones.
 */
export function settingsWriteScope(command: SettingsCommand): SettingsWriteScope {
	switch (command.kind) {
		case "doc-depth-field":
		case "central-depth-field":
			return "per-doc";
		case "global-depths":
		case "global-view":
		case "node-exclusion":
			return "global";
	}
}
