import { ALL_SETTINGS_RESET_SCOPE, SETTINGS_RESET_SCOPES } from "../src/view/settingsResetPlan";
import { SETTINGS_GROUPS, SettingsRowNames, settingsRowsFor } from "../src/view/settingsRows";
import type { SettingsRowControlKind } from "../src/view/settingsRows";
import { SETTINGS_SECTIONS } from "../src/view/settingsSectionFields";
import type { SizingNumberField } from "../src/view/settingsWritePlan";

/**
 * The ONE e2e-side description of what the settings surfaces are made of: the
 * settings-tab cards (heading + scoped restore row, in render order) and the
 * controls-panel disclosures (in panel order).
 *
 * WHY it exists: three specs used to hand-maintain the same `toHaveCount(6)` and
 * the same 6/7-entry restore-name lists. Adding or renaming a card meant finding
 * five sites by hand, and missing one left a spec quietly asserting a stale
 * truth (`node-content-preference` hit exactly that). Every count here is
 * `<CONST>.length`, so one edit updates every site.
 *
 * WHY the reset NAMES are derived rather than re-typed: they are already
 * data-driven in `src/view/settingsResetPlan` (`label` is simultaneously the row
 * name, the button `aria-label` and the tooltip). Re-typing them here would be a
 * fourth copy. The literal second opinion that a *copy change* was intentional
 * lives in `settingsBaseline.test.ts` (one place) and in
 * `src/view/settingsResetPlan.test.ts` (label shape) — deliberately NOT removed.
 *
 * WHY nothing here re-types a heading or a panel summary any more: since the dual
 * presenters ticket both surfaces render `SETTINGS_GROUPS` (`src/view/settingsRows`),
 * so the headings, the panel order and which section opens by default ARE data. This
 * module reads them; `settingsUxVisual.e2e.ts` is what proves they reach the DOM.
 *
 * This module is pure: no `obsidian`, no `react`, no `fs`. It must stay that way
 * — `settingsResetPlan` is safe to import because it only reaches into the pure
 * engine, and pulling `obsidian` into the node-side test process crashes it (see
 * the note in `obsidianHarness.ts`).
 */

/** The per-section reset scopes, i.e. every scope except the tab-wide one. */
export type SectionResetScope = (typeof SETTINGS_SECTIONS)[number];

/** One settings-tab card: what it is called, and what its restore row is called. */
export interface SettingsTabSection {
	readonly scope: SectionResetScope;
	/** The card's `setHeading()` row text, also usable as a `hasText` card selector. */
	readonly heading: string;
	/** The card's restore row name / button `aria-label`. */
	readonly resetName: string;
}

/** Every settings-tab card, in the order `VicinityGraphSettingTab.display()` renders them. */
export const SETTINGS_TAB_SECTIONS: readonly SettingsTabSection[] = SETTINGS_SECTIONS.map((scope) => ({
	scope,
	heading: SETTINGS_GROUPS[scope].heading,
	resetName: SETTINGS_RESET_SCOPES[scope].label,
}));

/** Card headings, in render order. */
export const SETTINGS_TAB_SECTION_HEADINGS: readonly string[] = SETTINGS_TAB_SECTIONS.map(
	(section) => section.heading,
);

/** The six in-card restore rows, in render order. */
export const SECTION_RESET_NAMES: readonly string[] = SETTINGS_TAB_SECTIONS.map((section) => section.resetName);

/** The tab-wide restore row, rendered once below the last card. */
export const ALL_SETTINGS_RESET_NAME = SETTINGS_RESET_SCOPES[ALL_SETTINGS_RESET_SCOPE].label;

/**
 * The tab-wide restore row's description, verbatim from `settingsResetPlan`.
 *
 * DERIVED, never re-typed: `settingsResetVerify.e2e.ts` used to hard-code this
 * sentence and went stale the moment the copy dropped its per-note-overrides
 * clause (the per-doc layer was removed) — a guaranteed-red release gate no
 * `npm test` run could catch. The e2e's job is "this copy reaches the screen";
 * WHAT the copy must say is asserted once, in `settingsResetPlan.test.ts`.
 */
export const ALL_SETTINGS_RESET_DESCRIPTION = SETTINGS_RESET_SCOPES[ALL_SETTINGS_RESET_SCOPE].description;

/** Every restore affordance in the tab, in DOM order: the six cards, then the footer. */
export const EVERY_SETTINGS_RESET_NAME: readonly string[] = [...SECTION_RESET_NAMES, ALL_SETTINGS_RESET_NAME];

/** Title of the tab-wide confirmation dialog, as `settingsResetPlan` builds it. */
export const ALL_SETTINGS_RESET_CONFIRM_TITLE = `${ALL_SETTINGS_RESET_NAME}?`;

/* ========================================================================== *
 * Control names — the accessible names a spec points controls at
 * ========================================================================== */

/**
 * The accessible name of the ONE row carrying `kind`, as `SettingsRowNames` builds it
 * for both surfaces.
 *
 * DERIVED, never re-typed: the row label IS the control's `aria-label`
 * (`src/view/settingsRows.ts`), so a spec that asks by declared name goes red on a
 * label rename instead of quietly matching nothing. Throws — loudly — when the kind is
 * not a single-row kind, because a spec silently pointing at the FIRST of several rows
 * is the failure mode this exists to prevent.
 */
export function soleRowControlName(kind: SettingsRowControlKind): string {
	const rows = settingsRowsFor(kind);
	const [row] = rows;
	if (row === undefined || rows.length > 1) {
		throw new Error(`expected exactly one declared "${kind}" row, found ${rows.length}`);
	}
	return SettingsRowNames.sole(row);
}

/** The accessible name of the sizing-number row that edits `field` (min/max px, decay k). */
export function sizingNumberControlName(field: SizingNumberField): string {
	const row = settingsRowsFor("sizing-number").find(
		(candidate) => candidate.control.kind === "sizing-number" && candidate.control.field === field,
	);
	if (row === undefined) {
		throw new Error(`no declared settings row edits sizing.${field}`);
	}
	return SettingsRowNames.sole(row);
}

/** One controls-panel disclosure and the state it must be in on a fresh view. */
export interface PanelDisclosure {
	/** Substring the `.vicinity-graph-disclosure__summary` must contain. */
	readonly summaryText: string;
	/** Only Depth starts open — the panel opens on the one control people came for. */
	readonly startsOpen: boolean;
	/**
	 * TRUE when this summary text also matches an ANCESTOR `.vicinity-graph-disclosure`
	 * (`hasText` is a substring match), so the locator needs `.first()` or Playwright's
	 * strict mode rejects it. Carried PER ENTRY, never applied uniformly: adding
	 * `.first()` where it is not needed would silently swallow a duplicated disclosure.
	 */
	readonly summaryAlsoMatchesAnAncestor: boolean;
}

/**
 * WHETHER a section's own summary text also matches an ANCESTOR disclosure. The one
 * thing here that is NOT derivable from `SETTINGS_GROUPS`, because it is a fact about
 * Playwright's substring `hasText` against the rendered nesting, not about the model.
 * `Record` over the section union so a new section is a COMPILE error here.
 */
const SUMMARY_ALSO_MATCHES_AN_ANCESTOR: Readonly<Record<SectionResetScope, boolean>> = {
	"depth-defaults": true,
	"node-sizing": false,
	"node-contents": false,
	"force-layout": true,
	"node-exclusion": false,
	performance: false,
};

/**
 * The controls-panel disclosures, in panel order — now DERIVED from the same
 * `SETTINGS_GROUPS` the tab cards come from, because since the dual-presenters ticket
 * the two surfaces render the same declared sections in the same order. (They still
 * differ BELOW the section level: the tab has no nested "Advanced spacing" collapsible
 * and the panel edits no exclusion patterns.)
 *
 * This list is EXHAUSTIVE for the panel's TOP LEVEL, with NO exceptions, and that
 * is enforced against the real DOM: `settingsUxVisual.e2e.ts` asserts the
 * direct-child `.vicinity-graph-disclosure` elements of
 * `.vicinity-graph-toolbar__body` against {@link CONTROLS_PANEL_DISCLOSURE_SUMMARIES}
 * — count, identity and order.
 *
 * "Advanced spacing" is the one summary that pin does not see, and structurally so:
 * it is NESTED inside Force layout, out of reach of a direct-child selector —
 * nothing to maintain. (The panel's one CONDITIONAL disclosure, "Pinned centrals
 * (n)", went with the per-central depth dials in ticket
 * `nid_ez38gf1mrdgh5kxedzrdicwzl_e`; every entry below renders unconditionally, so
 * the pin needs no name-based exemption.)
 */
export const CONTROLS_PANEL_DISCLOSURES: readonly PanelDisclosure[] = SETTINGS_SECTIONS.map((section) => ({
	summaryText: SETTINGS_GROUPS[section].heading,
	startsOpen: SETTINGS_GROUPS[section].openInPanel === true,
	summaryAlsoMatchesAnAncestor: SUMMARY_ALSO_MATCHES_AN_ANCESTOR[section],
}));

/**
 * The force-layout reset's name. It is the settings-tab row name AND the accessible
 * name of the CONTROLS PANEL's own restore button — the one section that offers one
 * (`SETTINGS_GROUPS["force-layout"].panelReset`), named by scope exactly like the
 * tab's buttons.
 */
export const FORCE_LAYOUT_RESET_NAME = SETTINGS_RESET_SCOPES["force-layout"].label;

/** Panel disclosure summaries, in panel order. */
export const CONTROLS_PANEL_DISCLOSURE_SUMMARIES: readonly string[] = CONTROLS_PANEL_DISCLOSURES.map(
	(disclosure) => disclosure.summaryText,
);
