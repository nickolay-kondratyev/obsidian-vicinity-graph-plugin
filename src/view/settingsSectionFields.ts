import type { DepthSettings, FrontmatterLinkSettings, NodeExclusionSettings, ViewSettings } from "../engine";

/**
 * WHICH SETTINGS FIELDS BELONG TO WHICH SETTINGS SECTION — the one structural
 * fact both the settings tab's six cards and their scoped "Restore defaults"
 * buttons are built from.
 *
 * ONE table, with a key COLUMN PER FAMILY rather than a `{family, key}` row
 * union. The three families carry different value types and land in
 * different persistence commands (`global-view` / `global-depths` /
 * `node-exclusion`), so each column is consumed by a different `restoreFields<T>`
 * call and must stay typed by its own `keyof`. Columns hand that over directly;
 * a row union would be re-grouped by family at every consumer for no gain.
 *
 * View-layer on purpose: a "section" is a settings-tab CARD. The pure engine has
 * no notion of one and must not acquire it (architecture-map layering).
 */

/**
 * The settings sections, in settings-tab render order. `edges` sits directly after
 * `depth-defaults`: both answer "how much of the vicinity do I see", depth by REACH
 * and edges by which of the reached links are drawn.
 */
export const SETTINGS_SECTIONS = [
	"depth-defaults",
	"edges",
	"frontmatter-links",
	"node-sizing",
	"node-contents",
	"grouping",
	"force-layout",
	"node-exclusion",
	"performance",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** The settings keys one section owns, per family. */
export interface SectionSettingsFields {
	readonly view: readonly (keyof ViewSettings)[];
	readonly depth: readonly (keyof DepthSettings)[];
	readonly exclusion: readonly (keyof NodeExclusionSettings)[];
	readonly frontmatterLinks: readonly (keyof FrontmatterLinkSettings)[];
}

/**
 * "This section owns no field of that family." Spelled out rather than made
 * optional: an OPTIONAL family key cannot be read by the completeness guard
 * below (indexed access on a union whose members lack the property is an error),
 * and the guard is the whole point of the table.
 */
const NO_FIELDS = [] as const;

export const SECTION_SETTINGS_FIELDS = {
	"depth-defaults": {
		view: NO_FIELDS,
		depth: [
			"linkDepthOut",
			"embedDepthOut",
			"linkDepthIn",
			"descendantDepth",
			"ancestorDepth",
			"pinnedLinkDepthOut",
			"pinnedEmbedDepthOut",
			"pinnedLinkDepthIn",
			"pinnedDescendantDepth",
			"pinnedAncestorDepth",
		],
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
	},
	edges: { view: ["showCrossLinks"], depth: NO_FIELDS, exclusion: NO_FIELDS, frontmatterLinks: NO_FIELDS },
	"frontmatter-links": { view: NO_FIELDS, depth: NO_FIELDS, exclusion: NO_FIELDS, frontmatterLinks: ["idRefFields"] },
	"node-sizing": { view: ["sizing"], depth: NO_FIELDS, exclusion: NO_FIELDS, frontmatterLinks: NO_FIELDS },
	"node-contents": {
		view: ["outlineMaxDepth", "nodePreviewPreference"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
	},
	grouping: {
		view: ["groupLabelFullPath", "edgeDepthIntoGroups"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
	},
	"force-layout": { view: ["forceLayout"], depth: NO_FIELDS, exclusion: NO_FIELDS, frontmatterLinks: NO_FIELDS },
	"node-exclusion": { view: NO_FIELDS, depth: NO_FIELDS, exclusion: ["enabled", "patterns"], frontmatterLinks: NO_FIELDS },
	performance: { view: ["nodeCap"], depth: NO_FIELDS, exclusion: NO_FIELDS, frontmatterLinks: NO_FIELDS },
} as const satisfies Readonly<Record<SettingsSection, SectionSettingsFields>>;

/**
 * Compile-time completeness: a settings field that belongs to NO section has no
 * scoped restore-defaults affordance and no home in the tab. It surfaces here as
 * a type error naming the orphaned field, e.g.
 *   Type 'true' is not assignable to type '"embedDepthOut"'.
 *
 * (`as const satisfies` above is what preserves the literal key tuples this
 * reads; a plain type annotation would widen them to `keyof …[]` and make the
 * guard vacuously true.)
 */
type SectionedField<TFamily extends keyof SectionSettingsFields> =
	(typeof SECTION_SETTINGS_FIELDS)[SettingsSection][TFamily][number];

// Each family is asserted ON ITS OWN, not as one `Exclude<…> | Exclude<…> | …`
// union: in the healthy state every constituent is `never`, so the union collapses
// to duplicated `never`s (a typescript-eslint redundant/duplicate-constituent report)
// while a real miss still surfaces the orphaned field name from its own assertion.
export const _assertEveryViewFieldSectioned: Exclude<keyof ViewSettings, SectionedField<"view">> extends never
	? true
	: Exclude<keyof ViewSettings, SectionedField<"view">> = true;
export const _assertEveryDepthFieldSectioned: Exclude<keyof DepthSettings, SectionedField<"depth">> extends never
	? true
	: Exclude<keyof DepthSettings, SectionedField<"depth">> = true;
export const _assertEveryExclusionFieldSectioned: Exclude<
	keyof NodeExclusionSettings,
	SectionedField<"exclusion">
> extends never
	? true
	: Exclude<keyof NodeExclusionSettings, SectionedField<"exclusion">> = true;
export const _assertEveryFrontmatterLinkFieldSectioned: Exclude<
	keyof FrontmatterLinkSettings,
	SectionedField<"frontmatterLinks">
> extends never
	? true
	: Exclude<keyof FrontmatterLinkSettings, SectionedField<"frontmatterLinks">> = true;
