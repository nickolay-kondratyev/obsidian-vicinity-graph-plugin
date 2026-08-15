import type { DepthSettings, ForceLayoutSettings } from "../engine";
import {
	FORCE_LAYOUT_ADVANCED_FIELDS,
	FORCE_LAYOUT_FIELD_META,
	FORCE_LAYOUT_MAIN_FIELDS,
} from "./forceLayoutFieldMeta";
import type { SettingsSection } from "./settingsSectionFields";
import { SETTINGS_SECTIONS } from "./settingsSectionFields";
import type { SettingsWriteContext, SizingNumberField } from "./settingsWritePlan";

/**
 * THE SETTINGS ROW CONTRACT — what a settings row IS, declared once for both
 * surfaces that render one: the Obsidian settings tab (`VicinityGraphSettingTab`)
 * and the in-graph React controls panel (`GraphToolbar` + `SettingsRowView`).
 *
 * Obsidian's `Setting` API cannot mount inside React, so there are and will remain
 * TWO renderer implementations. This module is what stops them drifting: grouping,
 * order, label, description, control kind, accessible naming and `disabledWhen` are
 * DATA here, and each presenter is a switch over {@link SettingsRowControl} closed by
 * {@link unhandledRowControl} — so a new control kind is a compile error in BOTH
 * presenters instead of a row somebody forgot to mirror.
 *
 * WHY a separate module from {@link SECTION_SETTINGS_FIELDS} (which stays exactly
 * as it is): that table answers "which FIELDS does this section's restore-defaults
 * clear", per-family key columns consumed by three separately-typed
 * `restoreFields<T>` calls. This one answers "which ROWS does this section
 * PRESENT" — a different question with a different cardinality (one `sizing` field
 * is two rows). Both are keyed by the same {@link SettingsSection}, so a section
 * cannot exist in one and not the other.
 *
 * WHAT THIS MODULE DOES NOT OWN: where a row's VALUE lives, which bounds it moves
 * between and which `SettingsInteraction` changes it. That is the sibling
 * `settingsRowAccessors.ts` — a different reason to change, and one that would drag the
 * engine's range tables and clamps into this module's import graph. This one is kept
 * PURE DATA because `e2e/settingsBaseline.ts` imports it in the node-side test process.
 *
 * NO `{family, key}` row union is invented here either: every
 * {@link SettingsRowControl} arm carries its OWN typed field reference
 * (`keyof DepthSettings`, `SizingNumberField`, `keyof ForceLayoutSettings`),
 * which is what lets each presenter build the row's `SettingsInteraction` without
 * re-widening anything.
 *
 * View-layer on purpose, and PURE: no `obsidian`, no `react` (the engine import
 * guard also covers what may reach `src/engine`/`src/shared`, and `e2e/*.ts`
 * imports this module in the node-side test process, which `obsidian` would
 * crash).
 */

/* ========================================================================== *
 * Control kinds
 * ========================================================================== */

/**
 * Every control kind a row can carry, 1:1 with the `SettingsInteraction` arms a
 * presenter must be able to emit. An order-bearing ARRAY as well as a union so a
 * test can ENUMERATE the kinds (a union is invisible at runtime) and check that
 * both presenters handle every one.
 */
export const SETTINGS_ROW_CONTROL_KINDS = [
	"depth",
	"sizing-number",
	"node-preview",
	"show-cross-links",
	"group-label-full-path",
	"folder-grouping-depth",
	"edge-depth-into-groups",
	"outline-depth",
	"force-layout",
	"exclusion-enabled",
	"exclusion-patterns",
	"node-cap",
	"id-ref-fields",
] as const;

export type SettingsRowControlKind = (typeof SETTINGS_ROW_CONTROL_KINDS)[number];

/** What a row's control edits — the typed field reference each presenter writes with. */
export type SettingsRowControl =
	/** One global depth budget, named by the field it moves (tab: slider, panel: stepper). */
	| { readonly kind: "depth"; readonly field: keyof DepthSettings }
	/** One sizing clamp (min/max node px). */
	| { readonly kind: "sizing-number"; readonly field: SizingNumberField }
	/** The preview preference pill (options come from `NODE_PREVIEW_OPTION_META`). */
	| { readonly kind: "node-preview" }
	/** Whether links between two visible nodes are drawn even when the walk never took them. */
	| { readonly kind: "show-cross-links" }
	/** Whether a collapsed folder chain is labelled with its full path instead of the leaf name. */
	| { readonly kind: "group-label-full-path" }
	/** Maximum rendered folder-group nesting levels (0 turns grouping off entirely). */
	| { readonly kind: "folder-grouping-depth" }
	/** How many nested-group levels an edge may reach into before collapsing onto the group box. */
	| { readonly kind: "edge-depth-into-groups" }
	/** Deepest heading level a node's outline renders. */
	| { readonly kind: "outline-depth" }
	/** One force-layout tuning value. */
	| { readonly kind: "force-layout"; readonly field: keyof ForceLayoutSettings }
	/** Whether node exclusion applies at all. */
	| { readonly kind: "exclusion-enabled" }
	/** The exclusion pattern list (tab: editable textarea, panel: read-only). */
	| { readonly kind: "exclusion-patterns" }
	/** Maximum number of non-central nodes rendered. */
	| { readonly kind: "node-cap" }
	/**
	 * The frontmatter fields read as note-id references, edited as CHIPS: one field
	 * added per entry, each chip carrying its own remove button. Stored unchanged as
	 * the one comma-separated string (`IdRefFieldChips` owns the projection).
	 */
	| { readonly kind: "id-ref-fields" };

/**
 * Compile-time completeness of {@link SETTINGS_ROW_CONTROL_KINDS}: a control arm
 * missing from the array surfaces here as a type error naming the kind, so the
 * runtime list a parity test iterates can never fall behind the union.
 */
type UnlistedControlKind = Exclude<SettingsRowControl["kind"], SettingsRowControlKind>;
export const _assertEveryRowControlKindListed: UnlistedControlKind extends never ? true : UnlistedControlKind = true;

/**
 * Closes a presenter's `switch` over {@link SettingsRowControl}. Both presenters call
 * it from their `default` arm, which is what makes the exhaustiveness REAL rather than
 * incidental: a new control arm cannot satisfy the `never` parameter, so it is a
 * compile error in every presenter that has not grown a `case` for it.
 *
 * WHY it must be spelled out even though the panel's switch also returns a value: the
 * settings tab's arm returns `void`, and a `void` switch with a missing arm just falls
 * through silently — TypeScript has nothing to complain about. The tab then renders
 * NOTHING for the new row, which is exactly the drift this module exists to stop.
 *
 * The throw is unreachable by construction; it exists so a stale hand-built bundle
 * fails loudly instead of dropping a row.
 */
export function unhandledRowControl(control: never): never {
	throw new Error(`unhandled settings row control=[${JSON.stringify(control)}]`);
}

/* ========================================================================== *
 * disabledWhen
 * ========================================================================== */

/**
 * A row whose control is INERT until another setting turns it on. Declared rather
 * than branched at the call site: both surfaces render such a row ALWAYS and merely
 * disable it (owner decision 2026-07-29, ticket `nid_qp56jugz8en8wkgjirwcb269p_e`) — so there is no
 * hide/reveal repaint that can go stale and nothing drops out of settings search.
 */
export type SettingsRowDependency = "exclusion-enabled" | "folder-grouping-on";

/**
 * The "Folder grouping depth" value that turns folder grouping off entirely (the
 * spec's declared minimum; `deriveFolderGroups` renders no groups at 0) — the
 * condition the `folder-grouping-on` dependency tests.
 */
const FOLDER_GROUPING_OFF_DEPTH = 0;

/**
 * The control kinds whose presenters ACTUALLY honour a declared dependency — the
 * exclusion pattern list, plus the two rows moot while the folder-grouping master dial
 * sits at 0: "Full folder path" (Grouping) and "Edge depth into groups" (Edges).
 *
 * This allowlist exists so the facility cannot over-promise: {@link SettingsRow} only
 * ACCEPTS `disabledWhen` on these kinds, so declaring it on, say, a slider row is a
 * compile error instead of a declaration both surfaces would silently ignore (which is
 * the "declared but unrendered" bug class this whole module removes).
 *
 * To extend: teach BOTH presenters' components for the kind to read
 * {@link isSettingsRowDisabled} — the tab additionally registering a `DependentControl`
 * so the verdict is re-applied after a write — and then add the kind here.
 */
export const DEPENDENCY_AWARE_CONTROL_KINDS = [
	"exclusion-patterns",
	"group-label-full-path",
	"edge-depth-into-groups",
] as const satisfies readonly SettingsRowControlKind[];

type DependencyAwareControlKind = (typeof DEPENDENCY_AWARE_CONTROL_KINDS)[number];

/**
 * The globals a row seeds its control from AND evaluates its `disabledWhen` against —
 * structurally the same three slices the write plan merges over, so a presenter needs
 * exactly one read to render a whole card.
 */
export type SettingsRowState = SettingsWriteContext;

/**
 * TRUE when this row's control must be rendered disabled.
 *
 * MUST be called with FRESHLY read state: an async control handler that evaluated
 * this against the snapshot it captured at click time could paint a stale verdict
 * once two fast clicks finish out of order.
 */
export function isSettingsRowDisabled(row: SettingsRow, state: SettingsRowState): boolean {
	if (row.disabledWhen === undefined) {
		return false;
	}
	switch (row.disabledWhen) {
		case "exclusion-enabled":
			return !state.nodeExclusion.enabled;
		case "folder-grouping-on":
			return state.globalView.folderGroupingDepth === FOLDER_GROUPING_OFF_DEPTH;
	}
}

/* ========================================================================== *
 * Rows, blocks and groups
 * ========================================================================== */

/** The copy every row carries, whatever its control. */
interface SettingsRowCopy {
	/**
	 * The ONE user-facing name of this setting, on BOTH surfaces: rendered visibly
	 * and reused as the control's accessible name (see {@link SettingsRowNames}).
	 * Resolved to a single string deliberately — the panel used to abbreviate three
	 * of these ("Outgoing", "Min px", "Exclude notes") and the abbreviations became
	 * their own drift tickets.
	 */
	readonly label: string;
	/**
	 * Long-form copy. The settings tab renders it as the row description; the 260px
	 * panel has no room for it, so it rides there as a native `title` tooltip (same
	 * string, zero drift). Absent for rows whose label already says everything.
	 */
	readonly description?: string;
}

/**
 * One declared setting: its copy, the control that edits it, and — only where both
 * presenters implement it — the dependency that makes the control inert.
 *
 * A UNION rather than one interface with an optional flag, so
 * {@link DEPENDENCY_AWARE_CONTROL_KINDS} is enforced by the compiler: a row on any
 * other kind cannot even spell `disabledWhen`.
 */
export type SettingsRow =
	| (SettingsRowCopy & {
			readonly control: Extract<SettingsRowControl, { readonly kind: DependencyAwareControlKind }>;
			readonly disabledWhen?: SettingsRowDependency;
	  })
	| (SettingsRowCopy & {
			readonly control: Exclude<SettingsRowControl, { readonly kind: DependencyAwareControlKind }>;
			readonly disabledWhen?: never;
	  });

/**
 * A run of rows inside one section. Exists because two sections group their rows
 * BELOW the card/disclosure level: force layout tucks its px knobs behind a
 * collapsible, and node sizing separates the metric table from the size bounds.
 */
export interface SettingsRowBlock {
	/**
	 * Non-null ⇒ the block renders behind a collapsible with this summary on BOTH
	 * surfaces (a native `<details>` in the tab, a nested `Disclosure` in the panel).
	 */
	readonly collapsedUnder?: string;
	/**
	 * Non-null ⇒ the block's rows carry this NAME above them on both surfaces — the
	 * always-visible counterpart of {@link collapsedUnder}, for a run of rows that is a
	 * group but must stay open (the six depth levers are two groups of three, and
	 * unnamed they read as one flat run of six).
	 *
	 * Copy only, never an identity: blocks stay addressable by {@link panelClass}, and a
	 * row's own label remains its whole accessible name — a subheading is not read out
	 * with the control, so it may CONFIRM a grouping the labels already carry but must
	 * never be the only thing that disambiguates two rows.
	 */
	readonly subheading?: string;
	/** BEM class for the block's wrapper in the PANEL. Layout only — the tab has its own card frame. */
	readonly panelClass?: string;
	readonly rows: readonly SettingsRow[];
}

/**
 * The class both surfaces put on a {@link SettingsRowBlock.subheading} element. ONE
 * constant rather than a literal per presenter: the two surfaces frame their rows
 * differently, but a sub-group label is the same typographic step on both, so it is
 * styled by one rule set (scoped per surface in `graph-view.css` / `settings-tab.css`).
 */
export const SETTINGS_SUBHEADING_CLASS = "vicinity-graph-settings-subheading";

/** One settings section as both surfaces present it. */
export interface SettingsGroup {
	/** Card heading in the tab, disclosure summary in the panel. */
	readonly heading: string;
	/** Section-level copy: a description row in the tab, the summary's `title` in the panel. */
	readonly description?: string;
	/** The ONE section the panel opens with — the control people came for (settings-ux CLARIFICATION #3). */
	readonly openInPanel?: boolean;
	/** BEM block class on the panel's disclosure (CSS scoping only). */
	readonly panelClass?: string;
	/** Extra class on the panel disclosure BODY (React Flow's `nowheel` escape hatch). */
	readonly panelBodyClass?: string;
	/** TRUE ⇒ the panel also offers this section's restore-defaults button (the tab always does). */
	readonly panelReset?: boolean;
	readonly blocks: readonly SettingsRowBlock[];
}

/**
 * Names the SETTING on the preview row — visibly, and as the `aria-label` of both
 * surfaces' radiogroups. Lives here rather than beside the per-OPTION copy in
 * `nodePreviewPreferenceMeta` because it is ROW copy for a `keyof ViewSettings`
 * field, like every other label in this table.
 */
const NODE_PREVIEW_ROW_LABEL = "Preview";

/**
 * States what the pill decides, then the ONE surprise a user could otherwise only
 * discover by staring at the graph: under Auto a peripheral note never shows an
 * outline (ticket nid_k2pa8khm6ugozmhkd6nlbdrq6_e), so "my headings vanished" has
 * an answer on the row itself. The per-OPTION copy carries the rest.
 */
const NODE_PREVIEW_ROW_DESCRIPTION =
	"Which preview a node shows: its heading outline or its first image. " +
	"Auto keeps the outline for the active and pinned notes; Outline and Image apply everywhere.";

/** One force-layout slider row: label and description come from the shared meta table. */
function forceLayoutRow(field: keyof ForceLayoutSettings): SettingsRow {
	const { label, description } = FORCE_LAYOUT_FIELD_META[field];
	return { label, description, control: { kind: "force-layout", field } };
}

/**
 * EVERY settings row, per section, in render order — the table both presenters
 * walk. A `Record` over {@link SettingsSection} so a new section cannot ship
 * without rows.
 */
export const SETTINGS_GROUPS: Readonly<Record<SettingsSection, SettingsGroup>> = {
	// Row copy names the ROLE ("the active note" / "each pinned note") rather than
	// "defaults" (in the spirit of the 2026-07-29 owner copy decision): "default"
	// implies a per-note override layer, and there is none — depth is one dial per
	// role, applied to every graph. Two blocks, one per role, each NAMED by the role it
	// expands from: six steppers in one flat run read as one knob with six dials, and
	// the labels alone put the only cue ("Pinned …") at the far left of every second
	// row. The pinned labels keep that prefix regardless — a subheading is not part of
	// a control's accessible name.
	"depth-defaults": {
		heading: "Depth",
		openInPanel: true,
		blocks: [
			{
				subheading: "From the active note",
				panelClass: "vicinity-graph-depth-controls",
				rows: [
					{
						label: "Links out",
						description: "How many hops of plain outgoing links to expand from the active note.",
						control: { kind: "depth", field: "linkDepthOut" },
					},
					{
						label: "Embeds out",
						description:
							"How many hops of EMBEDDED notes (`![[note]]`, and canvas cards holding a note) to expand from the active note. Images and other attachments are unaffected — they are attachments however they are written, and never become nodes.",
						control: { kind: "depth", field: "embedDepthOut" },
					},
					{
						label: "Links in",
						description:
							"How many hops of incoming links (backlinks) to expand from the active note. A note that EMBEDS the active note arrives here too — incoming links are counted the same way whatever their kind.",
						control: { kind: "depth", field: "linkDepthIn" },
					},
					{
						label: "Descendants",
						description:
							"Folder-note children: `Jon.md` or `Jon/Jon.md` is the folder note of `Jon/`; notes inside that folder are its descendants. Depth is how many folder levels to expand DOWN from the active note. 0 = off.",
						control: { kind: "depth", field: "descendantDepth" },
					},
					{
						label: "Ancestors",
						description:
							"Folder-note parents: the folder note of the folder that CONTAINS the active note, then that folder's own folder note, and so on. Depth is how many folder levels to climb UP from the active note. 0 = off.",
						control: { kind: "depth", field: "ancestorDepth" },
					},
				],
			},
			{
				subheading: "From each pinned note",
				// Same base class (one stepper layout), plus a modifier so e2e locators can
				// address the active and pinned blocks separately.
				panelClass: "vicinity-graph-depth-controls vicinity-graph-depth-controls--pinned",
				rows: [
					{
						label: "Pinned links out",
						description:
							"How many hops of plain outgoing links to expand from each pinned note. A pinned note that is also the active note uses the active-note depths.",
						control: { kind: "depth", field: "pinnedLinkDepthOut" },
					},
					{
						label: "Pinned embeds out",
						description:
							"How many hops of EMBEDDED notes to expand from each pinned note (see Embeds out). A pinned note that is also the active note uses the active-note depths.",
						control: { kind: "depth", field: "pinnedEmbedDepthOut" },
					},
					{
						label: "Pinned links in",
						description:
							"How many hops of incoming links (backlinks) to expand from each pinned note. A pinned note that is also the active note uses the active-note depths.",
						control: { kind: "depth", field: "pinnedLinkDepthIn" },
					},
					{
						label: "Pinned descendants",
						description:
							"Folder-note children (see Descendants) expanded DOWN from each pinned note. Depth is folder levels. A pinned note that is also the active note uses the active-note depths. 0 = off.",
						control: { kind: "depth", field: "pinnedDescendantDepth" },
					},
					{
						label: "Pinned ancestors",
						description:
							"Folder-note parents (see Ancestors) climbed UP from each pinned note. Depth is folder levels. A pinned note that is also the active note uses the active-note depths. 0 = off.",
						control: { kind: "depth", field: "pinnedAncestorDepth" },
					},
				],
			},
		],
	},
	// Its own section rather than a row tucked under Depth or Node contents: everything
	// here is about what is drawn BETWEEN nodes, and both of those headings would misname
	// it. "Edge depth into groups" lives here (moved off Grouping, ticket
	// `nid_rndi5sulwrsx1aq0x4xqcskrb_e`): it is an EDGE property — how far an edge reaches
	// into a group before collapsing — not a property of the groups themselves.
	edges: {
		// No `panelClass`: the rows are plain shared rows, so the section needs no scoping
		// of its own (like `performance`).
		heading: "Edges",
		blocks: [
			{
				rows: [
					{
						label: "Show cross links",
						description:
							"Also draw links between notes that are both on screen but were never reached from a central note — the denser, complete picture of what the visible notes link to. Which notes are shown does not change.",
						control: { kind: "show-cross-links" },
					},
					{
						label: "Edge depth into groups",
						description:
							"How many levels of nested groups an edge may reach into before collapsing onto the group box. 0 keeps every group edge collapsed.",
						control: { kind: "edge-depth-into-groups" },
						// Moot while folder grouping is off — there are no groups to reach into.
						disabledWhen: "folder-grouping-on",
					},
				],
			},
		],
	},
	// The metric rows (five toggles + weights, depth decay k) were REMOVED with
	// the metric dials (node-sizing rethink, 2026-08-03): a node now sizes to
	// fit what it shows, and these two clamps bound that fit.
	"node-sizing": {
		heading: "Node sizing",
		description:
			"Each node sizes itself to fit what it shows — its title, outline or image. These bounds are node HEIGHTS in pixels; a node's width follows its title.",
		panelClass: "vicinity-graph-sizing",
		panelBodyClass: "nowheel",
		blocks: [
			{
				panelClass: "vicinity-graph-sizing__ranges",
				rows: [
					{
						label: "Minimum node height (px)",
						description: "The shortest any node can be.",
						control: { kind: "sizing-number", field: "minPx" },
					},
					{
						label: "Maximum node height (px)",
						description: "The tallest any node can grow to fit its content.",
						control: { kind: "sizing-number", field: "maxPx" },
					},
					{
						label: "Minimum height of image nodes (px)",
						description:
							"An extra height floor applied only to nodes that show an image, so a picture stays legible on an otherwise sparse note. Never exceeds the maximum above; a value below an image's natural size has no effect.",
						control: { kind: "sizing-number", field: "minImageHeightPx" },
					},
				],
			},
		],
	},
	// Row order is general → specific: the Preview pill decides WHICH preview a node
	// shows, the depth row only refines the outline once the outline won.
	//
	// WHY-NOT an on/off switch for previews: the pill's `Auto` IS the "just show me
	// whatever the note has" answer, so a separate enable flag would only add a state
	// where both other options are dead.
	"node-contents": {
		heading: "Node contents",
		panelClass: "vicinity-graph-nodecontents",
		blocks: [
			{
				rows: [
					{
						label: NODE_PREVIEW_ROW_LABEL,
						description: NODE_PREVIEW_ROW_DESCRIPTION,
						control: { kind: "node-preview" },
					},
					{
						label: "Outline depth",
						description: "How many heading levels a note's outline shows inside its node.",
						control: { kind: "outline-depth" },
					},
				],
			},
		],
	},
	// Its own section: how folder GROUPS (not the nodes inside them) present. Sits
	// directly after Depth (ticket `nid_rndi5sulwrsx1aq0x4xqcskrb_e`): grouping shapes
	// the whole layout, so it reads as part of the primary "what does my graph look like"
	// run rather than a trailing dial. The edge-reach dial moved to Edges — it is an edge
	// property, not a grouping one.
	grouping: {
		heading: "Grouping",
		blocks: [
			{
				rows: [
					// First row deliberately (general → specific): this is the master dial —
					// at 0 the row below it is moot, which is what its declared
					// `disabledWhen` renders.
					{
						label: "Folder grouping depth",
						description:
							"Maximum levels of nested folder groups. 0 turns folder grouping off entirely; ∞ is unlimited.",
						control: { kind: "folder-grouping-depth" },
					},
					{
						label: "Full folder path",
						description:
							"Label a collapsed folder chain — a run of single-child folders drawn as one group — with its full path (A/B/C) instead of just the innermost folder name. Groups that are not collapsed always show their folder name.",
						control: { kind: "group-label-full-path" },
						disabledWhen: "folder-grouping-on",
					},
				],
			},
		],
	},
	"force-layout": {
		heading: "Force layout",
		panelClass: "vicinity-graph-forcelayout",
		panelReset: true,
		blocks: [
			{ rows: FORCE_LAYOUT_MAIN_FIELDS.map(forceLayoutRow) },
			{
				collapsedUnder: "Advanced spacing",
				panelClass: "vicinity-graph-forcelayout__advanced",
				rows: FORCE_LAYOUT_ADVANCED_FIELDS.map(forceLayoutRow),
			},
		],
	},
	"node-exclusion": {
		heading: "Node exclusion",
		panelClass: "vicinity-graph-exclusion",
		blocks: [
			{
				rows: [
					{
						label: "Exclude notes from the graph",
						description:
							"Hide matching neighbor notes before the graph is built. Central and pinned notes are never excluded.",
						control: { kind: "exclusion-enabled" },
					},
					{
						label: "Exclusion patterns",
						description:
							"One regular expression per line, tested (case-sensitively, unanchored) against each note's vault path including extension. E.g. `^archive/` matches the archive folder at the vault root; `templates/` matches anywhere. Invalid patterns are ignored.",
						control: { kind: "exclusion-patterns" },
						disabledWhen: "exclusion-enabled",
					},
				],
			},
		],
	},
	// Its own section: the one place a note's frontmatter (rather than its `[[wikilinks]]`)
	// becomes graph edges. Sits after Node exclusion, before Performance (owner
	// decision, ticket `nid_gpgudw7pfdy02wcqbs73si21x_e`): OFF by default (empty
	// list), so it belongs with the trailing opt-in dials rather than the everyday
	// reach/appearance sections.
	"frontmatter-links": {
		heading: "Frontmatter links",
		panelClass: "vicinity-graph-frontmatter-links",
		blocks: [
			{
				rows: [
					{
						label: "Id-reference fields",
						description:
							"Fields listed here are read as references to other notes' frontmatter id, and rendered as ordinary link edges in the graph. " +
							"Type a field name (e.g. deps) and press Enter to add it; remove one with its × button.",
						control: { kind: "id-ref-fields" },
					},
				],
			},
		],
	},
	performance: {
		heading: "Performance",
		blocks: [
			{
				rows: [
					{
						label: "Node cap",
						description:
							"Maximum number of non-central nodes rendered. Central and pinned notes are never capped.",
						control: { kind: "node-cap" },
					},
				],
			},
		],
	},
};

/** Every declared block, in render order across every section — the grouping layer. */
export const EVERY_SETTINGS_BLOCK: readonly SettingsRowBlock[] = SETTINGS_SECTIONS.flatMap(
	(section) => SETTINGS_GROUPS[section].blocks,
);

/** Every declared row, in render order across every section — what a parity test iterates. */
export const EVERY_SETTINGS_ROW: readonly SettingsRow[] = EVERY_SETTINGS_BLOCK.flatMap((block) => block.rows);

/** Every declared row carrying this control kind (one for most). */
export function settingsRowsFor(kind: SettingsRowControlKind): readonly SettingsRow[] {
	return EVERY_SETTINGS_ROW.filter((row) => row.control.kind === kind);
}

/* ========================================================================== *
 * Accessible naming — ONE convention, stated once, applied by both presenters
 * ========================================================================== */

/**
 * THE accessible-naming convention for settings controls, on BOTH surfaces.
 *
 * WHY it must be computed and not hand-typed per control: Obsidian renders a
 * settings row's name in a SIBLING element of the control with no `for`/`id`
 * pairing, so a bare `input` has no accessible name of its own — and the React
 * panel's own labels were inconsistent about it (a `SizingNumber` had none). One
 * function per shape means a row added later cannot forget.
 */
export class SettingsRowNames {
	/** A row with ONE control: the row label is the whole name. */
	static sole(row: SettingsRow): string {
		return row.label;
	}

	/**
	 * A VERB button acting on the row's value (a stepper's − / +). Verb first, so a
	 * screen reader announces the action before the thing — and the label is
	 * lower-cased into the sentence, e.g. `Decrease links out`.
	 */
	static action(verb: SettingsRowActionVerb, row: SettingsRow): string {
		return `${verb} ${row.label.toLowerCase()}`;
	}
}

/** The verbs a row's action buttons can carry. */
export type SettingsRowActionVerb = "Decrease" | "Increase";
