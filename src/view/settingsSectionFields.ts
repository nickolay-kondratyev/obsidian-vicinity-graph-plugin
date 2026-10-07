import type {
	DepthSettings,
	FrontmatterLinkSettings,
	NodeExclusionSettings,
	RelationshipSettings,
	ViewSettings,
} from "../engine";

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
 * The settings sections, in settings-tab render order. `grouping` sits directly after
 * `depth-defaults` (ticket `nid_rndi5sulwrsx1aq0x4xqcskrb_e`): depth and grouping
 * together decide the graph's coarse shape, so they lead. `edges` follows the
 * appearance sections — it and grouping swapped places, and the edge-reach dial moved
 * onto `edges` with it. `frontmatter-links` sits between `node-exclusion` and
 * `performance` (owner decision, ticket `nid_gpgudw7pfdy02wcqbs73si21x_e`): it is off by
 * default, so it reads as one of the trailing opt-in dials rather than part of the
 * everyday reach/appearance run. `relationships` (task 4/4
 * `nid_80xc6z8umlpo1x6u4p1v7eb22_e`) joins that opt-in run right after it: it ships
 * OFF, and in the graph it lives in its own top-right menu, not the controls panel.
 */
export const SETTINGS_SECTIONS = [
	"depth-defaults",
	"grouping",
	"node-sizing",
	"node-contents",
	"edges",
	"force-layout",
	"node-exclusion",
	"frontmatter-links",
	"relationships",
	"performance",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** The settings keys one section owns, per family. */
export interface SectionSettingsFields {
	readonly view: readonly (keyof ViewSettings)[];
	readonly depth: readonly (keyof DepthSettings)[];
	readonly exclusion: readonly (keyof NodeExclusionSettings)[];
	readonly frontmatterLinks: readonly (keyof FrontmatterLinkSettings)[];
	readonly relationships: readonly (keyof RelationshipSettings)[];
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
		relationships: NO_FIELDS,
	},
	edges: {
		view: ["showCrossLinks", "edgeDepthIntoGroups"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
	"node-sizing": {
		view: ["sizing"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
	"node-contents": {
		view: ["outlineMaxDepth", "nodePreviewPreference"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
	grouping: {
		view: ["folderGroupingDepth", "groupLabelFullPath"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
	"force-layout": {
		view: ["forceLayout"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
	"node-exclusion": {
		view: NO_FIELDS,
		depth: NO_FIELDS,
		exclusion: ["enabled", "patterns"],
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
	"frontmatter-links": {
		view: NO_FIELDS,
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: ["idRefFields"],
		relationships: NO_FIELDS,
	},
	relationships: {
		view: NO_FIELDS,
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: ["autoNaming", "model", "reasoningEffort", "apiKeySecretName"],
	},
	performance: {
		view: ["nodeCap"],
		depth: NO_FIELDS,
		exclusion: NO_FIELDS,
		frontmatterLinks: NO_FIELDS,
		relationships: NO_FIELDS,
	},
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
export const _assertEveryRelationshipFieldSectioned: Exclude<
	keyof RelationshipSettings,
	SectionedField<"relationships">
> extends never
	? true
	: Exclude<keyof RelationshipSettings, SectionedField<"relationships">> = true;
