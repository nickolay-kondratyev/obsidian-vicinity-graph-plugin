import type {
	DepthOverride,
	DepthSettings,
	EdgeVisibilityMode,
	ForceLayoutSettings,
	NodeExclusionSettings,
	SizeMetricId,
	SizingSettings,
	ViewSettings,
	ViewSettingsOverride,
} from "../engine";
import { EngineDefaults, clampForceLayoutSettings } from "../engine";

/**
 * Versioned JSON shapes persisted by step-03 (every shape carries `version`
 * from day one — step doc requirement) plus their defensive parsers: disk
 * content is user-editable and sync-mangled in practice, so parsing NEVER
 * throws — unusable content degrades to defaults (data.json) or `null`
 * (per-doc files), matching obsidian-id-lib's malformed-content philosophy.
 */

/**
 * Bumped to 2 when the `edgeRouting` view field was removed (routing is now
 * always on): a mismatched version parses to defaults/null and the next write
 * rewrites at the current version, so stale v1 `edgeRouting` values are dropped.
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

/** Shape of the plugin's `data.json` (via `saveData`/`loadData`). */
export interface PluginData {
	readonly version: number;
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	readonly pins: readonly PinnedDocEntry[];
	/** Global node exclusion (vault-wide enable + regex-lite pattern list). */
	readonly nodeExclusion: NodeExclusionSettings;
}

/**
 * Shape of one `doc-data/<docid>.json` file. Per-field pin-on-toggle
 * semantics: a present field is pinned (even when equal to the global
 * default), an absent field inherits.
 */
export interface DocData {
	readonly version: number;
	/** This doc's own depth override (as MAIN or pinned root). */
	readonly depths?: DepthOverride;
	/** This doc's own view override (as MAIN or pinned root). */
	readonly view?: ViewSettingsOverride;
	/** Depths of pinned centrals as adjusted while THIS doc was MAIN, keyed by central docid. */
	readonly centralDepths?: Readonly<Record<string, DepthOverride>>;
}

const EDGE_VISIBILITY_MODES: readonly EdgeVisibilityMode[] = ["walked-from-center", "all-edges"];

export class PersistedShapes {
	static defaultPluginData(): PluginData {
		return {
			version: PERSISTED_SHAPE_VERSION,
			globalDepths: EngineDefaults.depthSettings(),
			globalView: EngineDefaults.viewSettings(),
			pins: [],
			nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		};
	}

	static emptyDocData(): DocData {
		return { version: PERSISTED_SHAPE_VERSION };
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
			globalDepths: { ...defaults.globalDepths, ...parseDepthOverride(raw["globalDepths"]) },
			globalView: { ...defaults.globalView, ...parseViewOverride(raw["globalView"]) },
			pins: parsePins(raw["pins"]),
			nodeExclusion: parseNodeExclusion(raw["nodeExclusion"], defaults.nodeExclusion),
		};
	}

	/** Per-doc file parser: unusable content is `null` (treated as "no per-doc data"). */
	static parseDocData(raw: unknown): DocData | null {
		if (!isRecord(raw) || raw["version"] !== PERSISTED_SHAPE_VERSION) {
			return null;
		}
		const docData: DocData = {
			version: PERSISTED_SHAPE_VERSION,
			...definedOnly("depths", nonEmpty(parseDepthOverride(raw["depths"]))),
			...definedOnly("view", nonEmpty(parseViewOverride(raw["view"]))),
			...definedOnly("centralDepths", parseCentralDepths(raw["centralDepths"])),
		};
		return docData;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps only recognized, correctly-typed depth fields (absence = inherit). */
function parseDepthOverride(raw: unknown): DepthOverride {
	if (!isRecord(raw)) {
		return {};
	}
	return {
		...definedOnly("outgoingDepth", numberOrUndefined(raw["outgoingDepth"])),
		...definedOnly("incomingDepth", numberOrUndefined(raw["incomingDepth"])),
	};
}

/** Keeps only recognized, correctly-typed view fields. */
function parseViewOverride(raw: unknown): ViewSettingsOverride {
	if (!isRecord(raw)) {
		return {};
	}
	const edgeVisibility = raw["edgeVisibility"];
	return {
		...definedOnly("nodeCap", numberOrUndefined(raw["nodeCap"])),
		...definedOnly(
			"groupByFolder",
			typeof raw["groupByFolder"] === "boolean" ? raw["groupByFolder"] : undefined,
		),
		...definedOnly(
			"edgeVisibility",
			EDGE_VISIBILITY_MODES.find((mode) => mode === edgeVisibility),
		),
		...definedOnly("sizing", parseSizing(raw["sizing"])),
		...definedOnly("forceLayout", parseForceLayout(raw["forceLayout"])),
	};
}

/**
 * `sizing` is ONE field in V1 (engine contract) and replaces the default
 * WHOLESALE in the view cascade — so a partially-mangled persisted sizing must
 * come out as a COMPLETE {@link SizingSettings}: recognized fields survive,
 * unusable ones are repaired from the engine default. Non-object → inherit.
 */
function parseSizing(raw: unknown): SizingSettings | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const defaults = EngineDefaults.viewSettings().sizing;
	const rawMetrics = isRecord(raw["metrics"]) ? raw["metrics"] : {};
	const metrics = {} as Record<SizeMetricId, SizingSettings["metrics"][SizeMetricId]>;
	for (const metricId of Object.keys(defaults.metrics) as SizeMetricId[]) {
		metrics[metricId] = parseMetricSetting(rawMetrics[metricId]) ?? defaults.metrics[metricId];
	}
	return {
		metrics,
		depthDecayK: numberOrUndefined(raw["depthDecayK"]) ?? defaults.depthDecayK,
		minPx: numberOrUndefined(raw["minPx"]) ?? defaults.minPx,
		maxPx: numberOrUndefined(raw["maxPx"]) ?? defaults.maxPx,
	};
}

/**
 * `forceLayout` is ONE field (like `sizing`) and replaces the default WHOLESALE
 * in the view cascade — so a partially-mangled persisted value must come out as
 * a COMPLETE {@link ForceLayoutSettings}: recognized fields survive, unusable
 * ones are repaired from the engine default. Non-object → inherit. The result
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

function parseMetricSetting(raw: unknown): SizingSettings["metrics"][SizeMetricId] | undefined {
	if (!isRecord(raw) || typeof raw["enabled"] !== "boolean") {
		return undefined;
	}
	const weight = numberOrUndefined(raw["weight"]);
	return weight === undefined ? undefined : { enabled: raw["enabled"], weight };
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

function parseCentralDepths(raw: unknown): Readonly<Record<string, DepthOverride>> | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const centralDepths: Record<string, DepthOverride> = {};
	for (const [docid, override] of Object.entries(raw)) {
		const parsed = nonEmpty(parseDepthOverride(override));
		if (parsed !== undefined) {
			centralDepths[docid] = parsed;
		}
	}
	return Object.keys(centralDepths).length > 0 ? centralDepths : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonEmpty<T extends object>(value: T): T | undefined {
	return Object.keys(value).length > 0 ? value : undefined;
}

/** Spread helper: `{...definedOnly("k", v)}` adds `k` only when `v` is defined (exactOptionalPropertyTypes-friendly). */
function definedOnly<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
	return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
