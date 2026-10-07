import type { DepthSettings, ForceLayoutSettings, NodePreviewPreference } from "../engine";
import {
	FORCE_LAYOUT_RANGES,
	SETTINGS_SPEC,
	SIZING_RANGES,
	clampEdgeDepthIntoGroups,
	clampFolderGroupingDepth,
	clampNodeCap,
	clampOutlineMaxDepth,
	clampSizingNumber,
} from "../engine";
import type { SettingsRowState } from "./settingsRows";
import type { SettingsInteraction, SizingNumberField } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";

/**
 * THE VALUE HALF of the settings row contract: for each control kind, WHERE its
 * value lives in the globals, WHICH bounds it moves between, and WHAT
 * {@link SettingsInteraction} changes it. The copy half — label, description,
 * grouping, order, accessible naming — lives in `settingsRows.ts`.
 *
 * WHY it exists: both presenters (`VicinityGraphSettingTab`, `SettingsRowView`) used
 * to re-derive all three per control kind, so `state.globalView.sizing[field]`, the
 * range-table lookup, the clamp and the interaction literal were written twice — and
 * two step constants were literally declared in both files. None of that is
 * presentation. With it, each presenter arm is markup plus one accessor call.
 *
 * WHY A SIBLING MODULE and not `settingsRows.ts`: that module answers "what rows
 * exist and how are they worded"; this one answers "where does a row's value live and
 * what write moves it" — a different reason to change (SRP). It also keeps
 * `settingsRows.ts` pure DATA, which matters because `e2e/settingsBaseline.ts` imports
 * it in the node-side Playwright process: nothing in e2e needs an accessor, so the
 * engine range tables and clamps this module pulls in stay out of that import graph.
 *
 * View-layer and PURE, like `settingsRows.ts`: no `obsidian`, no `react`.
 */

/**
 * The inclusive bounds a numeric control renders. `max` is REQUIRED: every numeric
 * spec leaf is a full `BoundedNumberSpec` (the node cap, once min-only, gained its
 * 1000 ceiling), so a control can never silently fall back — a native range input
 * whose `max` is absent quietly defaults it to 100.
 */
export interface SettingsRowBounds {
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

/**
 * One control's value: read it out of the globals, and name the write that changes it.
 *
 * Both surfaces read through this, so neither can reach into a slice of `state`
 * directly and neither can spell an interaction literal of its own.
 */
export interface SettingsValueAccessor<T> {
	read(state: SettingsRowState): T;
	interaction(value: T): SettingsInteraction;
}

/**
 * A numeric control additionally owns its bounds and its clamp.
 *
 * {@link interaction} emits `settlesAt(value)`, so the value WRITTEN and the value a
 * surface shows optimistically are the same number by construction — the settings tab
 * used to clamp inside the interaction while the panel clamped only its display, which
 * is exactly the kind of split this module removes.
 */
export interface SettingsNumberAccessor extends SettingsValueAccessor<number> {
	readonly bounds: SettingsRowBounds;
	/**
	 * What the write path will actually STORE for a requested value; identity when
	 * nothing clamps it. A property function type (not a method) because surfaces
	 * pass it around unbound — every implementation is a free function or arrow that
	 * closes over its clamp, none reads `this`.
	 */
	readonly settlesAt: (value: number) => number;
}

/** A numeric control the user TYPES into — it must also say what counts as a typed value. */
export interface SettingsTypedNumberAccessor extends SettingsNumberAccessor {
	/** `undefined` ⇒ mid-edit or out of spec: nothing may be written yet. */
	accept(raw: string): number | undefined;
}

/** A field the write path stores verbatim. */
function unclamped(value: number): number {
	return value;
}

/** The glyph the folder-grouping-depth slider shows at its unlimited (∞) stop. */
export const FOLDER_GROUPING_UNLIMITED_LABEL = "∞";

/**
 * The folder-grouping-depth slider is the one settings slider whose top stop is not a
 * number but ∞ (unlimited nesting, ticket `nid_rndi5sulwrsx1aq0x4xqcskrb_e`). A native
 * range input can only carry an integer track, so the slider runs over POSITIONS
 * `0..maxFiniteDepth + 1`: a position at or below the finite max IS that depth verbatim,
 * and the one position past it selects {@link Number.POSITIVE_INFINITY}. The stored VALUE
 * is still a depth (0..max or ∞) — this only maps that value onto the integer track and
 * back, and names what the readout shows.
 *
 * Lives beside the accessors (the value half) rather than in a presenter because BOTH
 * surfaces need the identical mapping and readout; a presenter is then markup plus these
 * calls, exactly like every other row.
 */
export class FolderGroupingDepthSlider {
	/** The deepest FINITE nesting the slider offers — the spec's finite max. */
	static readonly maxFiniteDepth = SETTINGS_SPEC.globalView.folderGroupingDepth.max;

	/** The one slider position past the finite range — the ∞ (unlimited) stop. */
	static readonly unlimitedPosition = FolderGroupingDepthSlider.maxFiniteDepth + 1;

	/** The integer track a native range input renders (finite stops plus the ∞ stop). */
	static readonly track: SettingsRowBounds = {
		min: 0,
		max: FolderGroupingDepthSlider.unlimitedPosition,
		step: 1,
	};

	/** The stored depth a slider position selects. */
	static depthAt(position: number): number {
		return position >= FolderGroupingDepthSlider.unlimitedPosition ? Number.POSITIVE_INFINITY : position;
	}

	/** The slider position that shows a stored depth (∞ lands on the terminal stop). */
	static positionOf(depth: number): number {
		if (!Number.isFinite(depth)) {
			return FolderGroupingDepthSlider.unlimitedPosition;
		}
		return Math.min(FolderGroupingDepthSlider.maxFiniteDepth, Math.max(0, Math.round(depth)));
	}

	/** What the readout beside the slider shows for a stored depth. */
	static readout(depth: number): string {
		return Number.isFinite(depth) ? String(depth) : FOLDER_GROUPING_UNLIMITED_LABEL;
	}
}

/** Projects a bounded spec leaf onto the bounds a control renders. */
function boundsOf(spec: SettingsRowBounds): SettingsRowBounds {
	return { min: spec.min, max: spec.max, step: spec.step };
}

/**
 * THE depth clamp — an AFFORDANCE bound on the depth controls, not an engine limit
 * (the traversal honours any depth).
 *
 * Derived from the SAME `bounds` the control renders, per field, because it is the
 * ONLY clamp a depth write gets: `planSettingsWrite` stores a `global-depth` verbatim.
 * A clamp written against one field's bounds while the control offers another's would
 * therefore hand the user a range the write silently takes back.
 *
 * Rounds because a depth is a whole number of hops. `NaN` propagates, as it always
 * has: the depth leaves are the ones `settingsSpecBounds.test.ts` deliberately
 * excludes from the engine's NaN-resolving clamp rule.
 */
function clampDepthInto(bounds: SettingsRowBounds, value: number): number {
	return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

export class SettingsRowAccessors {
	/**
	 * One global depth budget. Bounds and clamp both come from this field's OWN spec
	 * leaf, so they cannot drift apart.
	 */
	static depth(field: keyof DepthSettings): SettingsNumberAccessor {
		const bounds = boundsOf(SETTINGS_SPEC.globalDepths[field]);
		const settlesAt = (value: number): number => clampDepthInto(bounds, value);
		return {
			bounds,
			read: (state) => state.globalDepths[field],
			settlesAt,
			interaction: (value) => ({ kind: "global-depth", field, value: settlesAt(value) }),
		};
	}

	/** One sizing clamp (min/max node px). Clamped exactly as `planSettingsWrite` clamps it. */
	static sizingNumber(field: SizingNumberField): SettingsTypedNumberAccessor {
		const settlesAt = (value: number): number => clampSizingNumber(field, value);
		return {
			bounds: SIZING_RANGES[field],
			read: (state) => state.globalView.sizing[field],
			settlesAt,
			accept: parseSizingInput,
			interaction: (value) => ({ kind: "global-sizing-number", field, value: settlesAt(value) }),
		};
	}

	/** Deepest heading level a node's outline renders. */
	static outlineDepth(): SettingsNumberAccessor {
		return {
			bounds: boundsOf(SETTINGS_SPEC.globalView.outlineMaxDepth),
			read: (state) => state.globalView.outlineMaxDepth,
			settlesAt: clampOutlineMaxDepth,
			interaction: (value) => ({ kind: "global-outline-depth", value: clampOutlineMaxDepth(value) }),
		};
	}

	/**
	 * Maximum rendered folder-group nesting levels (0 turns grouping off entirely, ∞ =
	 * unlimited — the default). Reads/writes in DEPTH space (∞ flows through
	 * `clampFolderGroupingDepth`); {@link FolderGroupingDepthSlider} owns how a slider
	 * maps that depth onto its integer track and shows the ∞ stop.
	 */
	static folderGroupingDepth(): SettingsNumberAccessor {
		return {
			bounds: boundsOf(SETTINGS_SPEC.globalView.folderGroupingDepth),
			read: (state) => state.globalView.folderGroupingDepth,
			settlesAt: clampFolderGroupingDepth,
			interaction: (value) => ({ kind: "global-folder-grouping-depth", value: clampFolderGroupingDepth(value) }),
		};
	}

	/** How many nested-group levels an edge may reach into before collapsing onto the group box. */
	static edgeDepthIntoGroups(): SettingsNumberAccessor {
		return {
			bounds: boundsOf(SETTINGS_SPEC.globalView.edgeDepthIntoGroups),
			read: (state) => state.globalView.edgeDepthIntoGroups,
			settlesAt: clampEdgeDepthIntoGroups,
			interaction: (value) => ({ kind: "global-edge-depth-into-groups", value: clampEdgeDepthIntoGroups(value) }),
		};
	}

	/** One force-layout tuning value. Bounds come from the table the persistence parser clamps with. */
	static forceLayout(field: keyof ForceLayoutSettings): SettingsNumberAccessor {
		return {
			bounds: FORCE_LAYOUT_RANGES[field],
			read: (state) => state.globalView.forceLayout[field],
			settlesAt: unclamped,
			interaction: (value) => ({ kind: "global-force-layout-field", field, value }),
		};
	}

	/**
	 * Maximum number of non-central nodes rendered.
	 *
	 * NOT {@link parseSizingInput}: a cap is a whole number of nodes, so a half-typed
	 * or out-of-range entry is REFUSED (nothing written) rather than clamped —
	 * `settlesAt` carries the load path's own {@link clampNodeCap} so what the write
	 * path would store for any value stays declared in one place.
	 */
	static nodeCap(): SettingsTypedNumberAccessor {
		const bounds = boundsOf(SETTINGS_SPEC.globalView.nodeCap);
		return {
			bounds,
			read: (state) => state.globalView.nodeCap,
			settlesAt: clampNodeCap,
			accept: (raw) => {
				const value = Number(raw);
				return Number.isInteger(value) && value >= bounds.min && value <= bounds.max ? value : undefined;
			},
			interaction: (value) => ({ kind: "global-cap", value: clampNodeCap(value) }),
		};
	}

	/** Which preview a node's preview slot shows. */
	static nodePreview(): SettingsValueAccessor<NodePreviewPreference> {
		return {
			read: (state) => state.globalView.nodePreviewPreference,
			interaction: (value) => ({ kind: "global-node-preview", value }),
		};
	}

	/** Whether links between two visible nodes are drawn even when the walk never took them. */
	static showCrossLinks(): SettingsValueAccessor<boolean> {
		return {
			read: (state) => state.globalView.showCrossLinks,
			interaction: (showCrossLinks) => ({ kind: "global-show-cross-links", showCrossLinks }),
		};
	}

	/** Whether a collapsed folder chain is labelled with its full path instead of the leaf name. */
	static groupLabelFullPath(): SettingsValueAccessor<boolean> {
		return {
			read: (state) => state.globalView.groupLabelFullPath,
			interaction: (groupLabelFullPath) => ({ kind: "global-group-label-full-path", groupLabelFullPath }),
		};
	}

	/** Whether node exclusion applies at all (the pattern list is untouched). */
	static exclusionEnabled(): SettingsValueAccessor<boolean> {
		return {
			read: (state) => state.nodeExclusion.enabled,
			interaction: (enabled) => ({ kind: "global-exclusion-enabled", enabled }),
		};
	}

	/** The exclusion pattern list (the enable flag is untouched). */
	static exclusionPatterns(): SettingsValueAccessor<readonly string[]> {
		return {
			read: (state) => state.nodeExclusion.patterns,
			interaction: (patterns) => ({ kind: "global-exclusion-patterns", patterns }),
		};
	}

	/**
	 * The comma-separated frontmatter id-ref field-name string. A plain
	 * {@link SettingsValueAccessor} (no bounds, no clamp): the value is FREE-FORM text
	 * stored verbatim, so there is nothing to bound and nothing to settle — the
	 * field-name list is a read-time projection (`parseIdRefFields`), not a write clamp.
	 */
	static idRefFields(): SettingsValueAccessor<string> {
		return {
			read: (state) => state.frontmatterLinks.idRefFields,
			interaction: (idRefFields) => ({ kind: "global-id-ref-fields", idRefFields }),
		};
	}
}
