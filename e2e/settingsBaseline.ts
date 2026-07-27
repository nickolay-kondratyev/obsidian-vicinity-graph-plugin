import { ALL_SETTINGS_RESET_SCOPE, SECTION_RESET_SCOPES, SETTINGS_RESET_SCOPES } from "../src/view/settingsResetPlan";

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
 * WHY the card HEADINGS are hand-written: nothing in `src` exposes them as data
 * (`VicinityGraphSettingTab.display()` calls six hand-written `renderX()`
 * methods, each with a literal `setName(...).setHeading()`). They are keyed by
 * reset scope so a NEW scope is a COMPILE error here, not a runtime surprise.
 *
 * This module is pure: no `obsidian`, no `react`, no `fs`. It must stay that way
 * — `settingsResetPlan` is safe to import because it only reaches into the pure
 * engine, and pulling `obsidian` into the node-side test process crashes it (see
 * the note in `obsidianHarness.ts`).
 */

/** The per-section reset scopes, i.e. every scope except the tab-wide one. */
export type SectionResetScope = (typeof SECTION_RESET_SCOPES)[number];

/**
 * Card heading → reset scope. `Record` over the scope union on purpose: adding a
 * seventh section scope in `settingsResetPlan` fails `tsc` HERE (under
 * `npm run check`, which covers `e2e/` via `check:e2e`), naming the missing
 * heading, instead of leaving a spec under-asserting at runtime.
 */
const SECTION_CARD_HEADINGS: Readonly<Record<SectionResetScope, string>> = {
	"depth-defaults": "Depth defaults",
	"node-sizing": "Node sizing",
	"node-contents": "Node contents",
	"force-layout": "Force layout",
	"node-exclusion": "Node exclusion",
	performance: "Performance",
};

/** One settings-tab card: what it is called, and what its restore row is called. */
export interface SettingsTabSection {
	readonly scope: SectionResetScope;
	/** The card's `setHeading()` row text, also usable as a `hasText` card selector. */
	readonly heading: string;
	/** The card's restore row name / button `aria-label`. */
	readonly resetName: string;
}

/** Every settings-tab card, in the order `VicinityGraphSettingTab.display()` renders them. */
export const SETTINGS_TAB_SECTIONS: readonly SettingsTabSection[] = SECTION_RESET_SCOPES.map((scope) => ({
	scope,
	heading: SECTION_CARD_HEADINGS[scope],
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

/** Every restore affordance in the tab, in DOM order: the six cards, then the footer. */
export const EVERY_SETTINGS_RESET_NAME: readonly string[] = [...SECTION_RESET_NAMES, ALL_SETTINGS_RESET_NAME];

/** Title of the tab-wide confirmation dialog, as `settingsResetPlan` builds it. */
export const ALL_SETTINGS_RESET_CONFIRM_TITLE = `${ALL_SETTINGS_RESET_NAME}?`;

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
 * The controls-panel disclosures, in `GraphToolbar` order. A SEPARATE list from
 * the tab cards on purpose — the two surfaces genuinely differ: the panel has no
 * "Performance" and no "Depth defaults" card, and the tab has no "Pinned
 * centrals" (conditional, hence unlisted) or nested "Advanced spacing".
 *
 * This list is EXHAUSTIVE for the panel's TOP LEVEL, and that is enforced against
 * the real DOM: `settingsUxVisual.e2e.ts` asserts the direct-child
 * `.vicinity-graph-disclosure` elements of `.vicinity-graph-toolbar__body` against
 * {@link CONTROLS_PANEL_DISCLOSURE_SUMMARIES} — count, identity and order. So a
 * sixth top-level disclosure fails that spec until it is listed here.
 *
 * The two exclusions survive that pin for DIFFERENT reasons, both deliberate:
 * - "Advanced spacing" is NESTED inside Force layout, so the direct-child
 *   selector never sees it (structural — nothing to maintain).
 * - "Pinned centrals (n)" IS a direct child when it renders, so the spec filters
 *   it out explicitly by {@link PINNED_CENTRALS_SUMMARY}.
 */
export const CONTROLS_PANEL_DISCLOSURES: readonly PanelDisclosure[] = [
	{ summaryText: "Depth", startsOpen: true, summaryAlsoMatchesAnAncestor: true },
	{ summaryText: "Node exclusion", startsOpen: false, summaryAlsoMatchesAnAncestor: false },
	{ summaryText: "Node sizing", startsOpen: false, summaryAlsoMatchesAnAncestor: false },
	{ summaryText: "Node contents", startsOpen: false, summaryAlsoMatchesAnAncestor: false },
	{ summaryText: "Force layout", startsOpen: false, summaryAlsoMatchesAnAncestor: true },
];

/** Panel disclosure summaries, in panel order. */
export const CONTROLS_PANEL_DISCLOSURE_SUMMARIES: readonly string[] = CONTROLS_PANEL_DISCLOSURES.map(
	(disclosure) => disclosure.summaryText,
);

/**
 * The conditional "Pinned centrals (n)" disclosure, without its "(n)" suffix —
 * that is a live count no fixture can hard-code. How to use it depends on the
 * caller: an EXHAUSTIVENESS filter must spell the count out in an anchored regex
 * (a bare prefix would also swallow any future sibling starting with these
 * words); a plain LOCATOR may match this prefix as a substring, since it only has
 * to find the disclosure. Not a {@link PanelDisclosure}: it is
 * absent unless the view has a pinned central, so it has no default open/closed
 * state to assert on a fresh view — it exists here only so the exhaustiveness pin
 * can exclude it BY NAME instead of relying on a fixture happening not to pin.
 */
export const PINNED_CENTRALS_SUMMARY = "Pinned centrals";
