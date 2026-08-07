import type {
	DepthSettings,
	ForceLayoutSettings,
	NodeExclusionSettings,
	NodeOverride,
	NodeSizeOverridePx,
	SizingSettings,
	ViewSettings,
} from "../engine";
import {
	EngineDefaults,
	NODE_CONTENT_OVERRIDES,
	NODE_PREVIEW_PREFERENCES,
	clampForceLayoutSettings,
	clampNodeCap,
	clampNodeSizeOverridePx,
	clampOutlineMaxDepth,
	clampSizingSettings,
} from "../engine";

/**
 * The versioned JSON shape persisted by step-03 (it carries `version` from day
 * one — step doc requirement) plus its defensive parser: disk content is
 * user-editable and sync-mangled in practice, so parsing NEVER throws —
 * unusable content degrades to defaults, matching obsidian-id-lib's
 * malformed-content philosophy.
 *
 * There is exactly ONE persisted file: the plugin's `data.json`. Settings are
 * GLOBAL-only; the two docid-keyed maps (pins, per-node overrides) are global
 * facts about docs — renames are non-events — never a per-document settings
 * layer (owner decision 2026-07-29).
 */

/**
 * Bumped to 2 when the `edgeRouting` view field was removed (routing is now
 * always on): a mismatched version parses to defaults/null and the next write
 * rewrites at the current version, so stale v1 `edgeRouting` values are dropped.
 *
 * WHY-NOT bump per ADDED field: a version bump DISCARDS every stored setting
 * and both docid-keyed maps wholesale, so it is reserved for a REMOVED/renamed
 * key whose stale value would otherwise be read back wrong. An additive field
 * (`nodeOverrides`, `edgeRoutingClearancePx`, the pinned depth fields) needs
 * nothing: it is absent from an older file and defaults per field. Bumping for
 * one would be strictly worse — the standing call recorded in
 * `nid_8p0nn2g34d97finokwlz3u1dt_e` and re-affirmed (against a far stronger
 * case, a KEY RENAME) in `nid_fay1hu5sxcoygizopkkg0f0d7_e`.
 *
 * WHY-NOT preserve-unknown-versions: a FUTURE-version file (written by a newer
 * install, then downgraded) also parses to defaults/null here, and the next
 * write rewrites it at this version — accepted while forward-compat is not a
 * goal. A future parser that must survive a downgrade-then-upgrade round trip
 * has to handle that path explicitly before shipping.
 */
export const PERSISTED_SHAPE_VERSION = 2;

/** One pinned doc; `pinTimestamp` (epoch ms) feeds the recency tiebreaker. */
export interface PinnedDocEntry {
	readonly docid: string;
	readonly pinTimestamp: number;
}

/**
 * Local pins, keyed by the MAIN (active) note's docid → the {@link PinnedDocEntry}
 * list pinned ONLY while that main is active (owner decision, ticket
 * nid_ndoy0bq50w1p1qzd2i9di2fxo_e). Both sides are docids, so renames on either
 * end stay non-events — the same global-fact-about-a-doc rule as {@link PinnedDocEntry}.
 * This is the FIRST sanctioned per-main-doc layer, superseding the 2026-07-29
 * global-only rule for PINS ONLY; every other setting stays global.
 */
export type LocalPinsByMainDocid = Readonly<Record<string, readonly PinnedDocEntry[]>>;

/** Shape of the plugin's `data.json` (via `saveData`/`loadData`). */
export interface PluginData {
	readonly version: number;
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	readonly pins: readonly PinnedDocEntry[];
	/**
	 * Local pins keyed by MAIN docid (see {@link LocalPinsByMainDocid}). Additive,
	 * so it needs no version bump — a file written before it existed has no
	 * `localPins` key and parses to the empty map.
	 */
	readonly localPins: LocalPinsByMainDocid;
	/** Global node exclusion (vault-wide enable + regex-lite pattern list). */
	readonly nodeExclusion: NodeExclusionSettings;
	/**
	 * Per-node user overrides, keyed by docid like {@link pins}. An entry with
	 * neither field is never stored ({@link PluginDataStore} deletes it) and is
	 * dropped by the parser if hand-edited in.
	 */
	readonly nodeOverrides: Readonly<Record<string, NodeOverride>>;
}

export class PersistedShapes {
	static defaultPluginData(): PluginData {
		return {
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			pins: [],
			localPins: {},
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
			nodeOverrides: {},
		};
	}

	/**
	 * `data.json` parser: first run (`null`), foreign versions and malformed
	 * content all yield fresh defaults; recognizable fields survive per-field.
	 */
	static parsePluginData(raw: unknown): PluginData {
		const defaults = PersistedShapes.defaultPluginData();
		if (!isRecord(raw) || raw["version"] !== PERSISTED_SHAPE_VERSION) {
			return defaults;
		}
		return {
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: { ...defaults.globalDepths, ...parseDepthFields(raw["globalDepths"]) },
			globalView: { ...defaults.globalView, ...parseViewFields(raw["globalView"]) },
			pins: parsePins(raw["pins"]),
			localPins: parseLocalPins(raw["localPins"]),
			nodeExclusion: parseNodeExclusion(raw["nodeExclusion"], defaults.nodeExclusion),
			nodeOverrides: parseNodeOverrides(raw["nodeOverrides"]),
		};
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * THE recognized-field rule, implemented exactly once: a field survives the
 * parse only when its parsed value is `!== undefined`. Never truthiness, never
 * `||` — a stored `0` / `false` / `""` is a REAL value, not an absence, and the
 * caller merges what survives over the spec defaults.
 */
function definedFieldsOnly<T extends object>(values: { readonly [K in keyof T]: T[K] | undefined }): Partial<T> {
	const defined: Record<string, unknown> = {};
	for (const key of Object.keys(values)) {
		const value = (values as Record<string, unknown>)[key];
		if (value !== undefined) {
			defined[key] = value;
		}
	}
	// Safe by construction: every surviving key/value pair came out of `values`,
	// whose type is `T`'s own key space. TS cannot follow that through `Object.keys`.
	return defined as Partial<T>;
}

/**
 * Keeps only recognized, correctly-typed depth fields (an unusable one falls
 * back to the spec default at the merge site).
 *
 * The argument type is the completeness guard: a new {@link DepthSettings} field
 * that no expression below parses is a compile error (TS2345) naming it.
 */
function parseDepthFields(raw: unknown): Partial<DepthSettings> {
	if (!isRecord(raw)) {
		return {};
	}
	return definedFieldsOnly<DepthSettings>({
		linkDepthOut: numberOrUndefined(raw["linkDepthOut"]),
		embedDepthOut: numberOrUndefined(raw["embedDepthOut"]),
		linkDepthIn: numberOrUndefined(raw["linkDepthIn"]),
		// Added WITHOUT a PERSISTED_SHAPE_VERSION bump (same call as
		// edgeRoutingClearancePx): a missing known field falls back to its spec
		// default per field, so an existing data.json parses correctly.
		pinnedLinkDepthOut: numberOrUndefined(raw["pinnedLinkDepthOut"]),
		pinnedEmbedDepthOut: numberOrUndefined(raw["pinnedEmbedDepthOut"]),
		pinnedLinkDepthIn: numberOrUndefined(raw["pinnedLinkDepthIn"]),
	});
}

/**
 * Every {@link ViewSettings} field's parsed value, `undefined` where the raw
 * object holds nothing usable. **This mapped type IS the completeness guard**:
 * the properties are REQUIRED (only their values may be `undefined`), so a new
 * `ViewSettings` field that no branch below parses is a compile error naming it —
 * instead of a persisted value that silently never round-trips through disk.
 */
type ParsedViewFields = { readonly [K in keyof ViewSettings]: ViewSettings[K] | undefined };

/** Keeps only recognized, correctly-typed view fields. */
function parseViewFields(raw: unknown): Partial<ViewSettings> {
	if (!isRecord(raw)) {
		return {};
	}
	const outlineMaxDepth = numberOrUndefined(raw["outlineMaxDepth"]);
	const nodeCap = numberOrUndefined(raw["nodeCap"]);
	const parsed: ParsedViewFields = {
		// Clamped with the SAME function the accessor settles with (owner decision
		// 2026-07-29, superseding the loaded-verbatim rule): a stored out-of-range
		// cap — a hand edit, or a value persisted before the ceiling existed — must
		// not silently disable truncation and hand the whole vault to the layout.
		nodeCap: nodeCap === undefined ? undefined : clampNodeCap(nodeCap),
		// Clamped with the SAME function the slider uses, so hand-edited JSON cannot
		// reach 0 (a silent off-switch the feature does not have) or an undefined level.
		outlineMaxDepth: outlineMaxDepth === undefined ? undefined : clampOutlineMaxDepth(outlineMaxDepth),
		// Unrecognized values (hand-edited JSON, a downgrade from a future version)
		// fall through as absent, so the spec default applies.
		nodePreviewPreference: NODE_PREVIEW_PREFERENCES.find(
			(preference) => preference === raw["nodePreviewPreference"],
		),
		// A non-boolean (hand-edited `"true"`, a null) falls through as absent, so the
		// spec default applies — never a truthiness coercion.
		showCrossLinks: typeof raw["showCrossLinks"] === "boolean" ? raw["showCrossLinks"] : undefined,
		sizing: parseSizing(raw["sizing"]),
		forceLayout: parseForceLayout(raw["forceLayout"]),
	};
	return definedFieldsOnly<ViewSettings>(parsed);
}

/**
 * `sizing` is ONE field (engine contract) and replaces the default WHOLESALE —
 * so a partially-mangled persisted sizing must come out as a COMPLETE
 * {@link SizingSettings}: recognized fields survive, unusable ones are repaired
 * from the engine default. Non-object → the whole default.
 * The result is CLAMPED into the input ranges, so a hand-edited `data.json`
 * cannot reach a size the inputs make unreachable.
 *
 * The metric-dial keys older files may still carry (`metrics`, `depthDecayK`)
 * were removed WITHOUT a PERSISTED_SHAPE_VERSION bump — deliberately, despite
 * the "bump on a removed key" rule: that rule exists for a stale value that
 * would otherwise be READ BACK WRONG, and these keys are simply never read
 * again (this parser is field-allowlisting, so they fall away on the next
 * write). A bump would discard every stored setting AND both docid-keyed maps
 * to delete two keys that cost nothing to ignore.
 */
function parseSizing(raw: unknown): SizingSettings | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const defaults = EngineDefaults.viewSettings().sizing;
	return clampSizingSettings({
		minPx: numberOrUndefined(raw["minPx"]) ?? defaults.minPx,
		maxPx: numberOrUndefined(raw["maxPx"]) ?? defaults.maxPx,
		minImageHeightPx: numberOrUndefined(raw["minImageHeightPx"]) ?? defaults.minImageHeightPx,
	});
}

/**
 * `forceLayout` is ONE field (like `sizing`) and replaces the default WHOLESALE
 * — so a partially-mangled persisted value must come out as a COMPLETE
 * {@link ForceLayoutSettings}: recognized fields survive, unusable ones are
 * repaired from the engine default. Non-object → the whole default. The result
 * is CLAMPED into the slider ranges so hand-edited JSON cannot reach the
 * degenerate combinations the sliders make unreachable.
 */
function parseForceLayout(raw: unknown): ForceLayoutSettings | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const defaults = EngineDefaults.forceLayoutSettings();
	return clampForceLayoutSettings({
		centerPullStrength: numberOrUndefined(raw["centerPullStrength"]) ?? defaults.centerPullStrength,
		repelStrength: numberOrUndefined(raw["repelStrength"]) ?? defaults.repelStrength,
		linkStrengthFactor: numberOrUndefined(raw["linkStrengthFactor"]) ?? defaults.linkStrengthFactor,
		linkGapPx: numberOrUndefined(raw["linkGapPx"]) ?? defaults.linkGapPx,
		collidePaddingPx: numberOrUndefined(raw["collidePaddingPx"]) ?? defaults.collidePaddingPx,
		elkNodeSpacingPx: numberOrUndefined(raw["elkNodeSpacingPx"]) ?? defaults.elkNodeSpacingPx,
		// Added in edge-routing__06 WITHOUT a PERSISTED_SHAPE_VERSION bump (explicit
		// call): a missing known field already falls back to the engine default here
		// per field, so an existing data.json parses correctly; a version bump would
		// instead DISCARD every stored setting (see the version doc above).
		edgeRoutingClearancePx: numberOrUndefined(raw["edgeRoutingClearancePx"]) ?? defaults.edgeRoutingClearancePx,
	});
}

/**
 * Defensive node-exclusion parser: a non-object, a non-boolean `enabled`, or a
 * non-array `patterns` degrade to the default; within a valid array only string
 * entries survive (non-strings dropped). Never throws — matches the file's
 * malformed-content philosophy. Patterns are stored verbatim; invalid REGEXES
 * are tolerated at match time (engine skips them), not rejected here.
 */
function parseNodeExclusion(raw: unknown, fallback: NodeExclusionSettings): NodeExclusionSettings {
	if (!isRecord(raw)) {
		return fallback;
	}
	const enabled = typeof raw["enabled"] === "boolean" ? raw["enabled"] : fallback.enabled;
	const patterns = Array.isArray(raw["patterns"])
		? raw["patterns"].filter((entry): entry is string => typeof entry === "string")
		: fallback.patterns;
	return { enabled, patterns };
}

function parsePins(raw: unknown): readonly PinnedDocEntry[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	const pins: PinnedDocEntry[] = [];
	for (const entry of raw) {
		if (isRecord(entry) && typeof entry["docid"] === "string" && typeof entry["pinTimestamp"] === "number") {
			pins.push({ docid: entry["docid"], pinTimestamp: entry["pinTimestamp"] });
		}
	}
	return pins;
}

/**
 * Defensive local-pins parser: a non-object map degrades to empty; per key, the
 * value is parsed exactly like the global {@link parsePins} list, and a main
 * whose list survives with NO usable entry is dropped whole — an empty target
 * list is a stored shape that must not exist (mirrors the node-override rule).
 * Never throws — matches the file's malformed-content philosophy.
 *
 * Added WITHOUT a PERSISTED_SHAPE_VERSION bump (same call as `nodeOverrides`):
 * the map is ADDITIVE, so a file written before it existed simply has no
 * `localPins` key and gets the empty map here.
 */
function parseLocalPins(raw: unknown): LocalPinsByMainDocid {
	if (!isRecord(raw)) {
		return {};
	}
	const localPins: Record<string, readonly PinnedDocEntry[]> = {};
	for (const [mainDocid, entries] of Object.entries(raw)) {
		const targets = parsePins(entries);
		if (targets.length > 0) {
			localPins[mainDocid] = targets;
		}
	}
	return localPins;
}

/**
 * Defensive per-node override parser: a non-object map degrades to empty; per
 * entry, an unusable `sizePx` (missing/non-finite dimension) and an
 * unrecognized `content` each fall away; an entry left with NEITHER field is
 * dropped whole — "empty entry" is a stored shape that must not exist
 * (see {@link PluginData.nodeOverrides}). Surviving pixel boxes are clamped
 * with the SAME hard-sanity clamp the write path uses.
 *
 * Added WITHOUT a PERSISTED_SHAPE_VERSION bump (explicit call, same as
 * `edgeRoutingClearancePx`): the map is ADDITIVE, so a file written before it
 * existed simply has no `nodeOverrides` key and gets the empty map here, while
 * a bump would discard that file's settings AND its pins (see the version doc).
 */
function parseNodeOverrides(raw: unknown): Readonly<Record<string, NodeOverride>> {
	if (!isRecord(raw)) {
		return {};
	}
	const overrides: Record<string, NodeOverride> = {};
	for (const [docid, entry] of Object.entries(raw)) {
		const override = parseNodeOverride(entry);
		if (override !== undefined) {
			overrides[docid] = override;
		}
	}
	return overrides;
}

function parseNodeOverride(raw: unknown): NodeOverride | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const sizePx = parseNodeSizeOverride(raw["sizePx"]);
	const content = NODE_CONTENT_OVERRIDES.find((choice) => choice === raw["content"]);
	if (sizePx === undefined && content === undefined) {
		return undefined;
	}
	return { ...(sizePx !== undefined ? { sizePx } : {}), ...(content !== undefined ? { content } : {}) };
}

function parseNodeSizeOverride(raw: unknown): NodeSizeOverridePx | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const widthPx = raw["widthPx"];
	const heightPx = raw["heightPx"];
	if (typeof widthPx !== "number" || typeof heightPx !== "number") {
		return undefined;
	}
	// "Is this number usable as node geometry" is the CLAMP's rule, asked once —
	// re-testing finiteness here would let the load and write paths disagree
	// about which boxes exist.
	return clampNodeSizeOverridePx({ widthPx, heightPx });
}

function numberOrUndefined(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

