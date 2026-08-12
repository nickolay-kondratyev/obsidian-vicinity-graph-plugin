import { EngineDefaults } from "../constants";
import { SETTINGS_SPEC } from "../SettingsSpec";
import type { DepthSettings, FrontmatterLinkSettings, NodeExclusionSettings, ViewSettings } from "../types";
import { NODE_PREVIEW_PREFERENCES } from "../types";

/**
 * THE FLAT WALK over {@link SETTINGS_SPEC} — one entry per spec LEAF, carrying the
 * leaf's path into the settings root, its declared default and its declared bounds.
 *
 * WHY THIS EXISTS: the settings tests used to restate every default and every bound
 * as a literal, so they went stale the moment a default moved — twice for real
 * (`collidePaddingPx` and `elkNodeSpacingPx` retunes), and they still could not
 * catch a field that was declared in the spec but never wired into parsing or into
 * restore-defaults. The tests now ITERATE this list instead: declaring a field in the
 * spec is the ONLY edit its coverage needs, and a field the wiring forgot FAILS
 * rather than passing vacuously.
 *
 * LEAF RULE: a spec node is a leaf iff it carries its own `default` key. That is what
 * makes `sizing.metrics.<id>` one leaf (its default is an object) rather than two, and
 * what makes `globalView` / `sizing` / `forceLayout` / `metrics` composites.
 *
 * Test support (hence `testFixtures/`), pure, engine-layer — it reads only the spec and
 * the spec's own default factories, so the walk cannot drift from the shape it walks.
 * Consumed by the spec-iterating suites in `src/engine`, `src/persistence` and `src/view`.
 */

/** The bounds a numeric spec leaf declares. `max`/`step` are absent on min-only fields. */
export interface SettingsLeafBounds {
	readonly min: number;
	readonly max?: number;
	readonly step?: number;
}

/** One spec leaf: a settings field's declared default plus, for numbers, its bounds. */
export interface SettingsSpecLeaf {
	/** Dotted path, e.g. `globalView.sizing.minPx` — the name a failure reports. */
	readonly id: string;
	/** Path from the settings root to this field, e.g. `["globalView", "sizing", "minPx"]`. */
	readonly path: readonly string[];
	readonly default: unknown;
	readonly bounds?: SettingsLeafBounds;
}

/**
 * The three persisted settings slices — {@link import("../../persistence/persistedShapes").PluginData}
 * minus `version` and minus the docid-keyed maps (`pins`, `nodeOverrides`,
 * which are facts about docs, not settings), i.e. the same triple the view
 * calls `SettingsWriteContext`.
 * Restated here because the engine cannot import the view (layering) and must not
 * import persistence.
 */
export interface SettingsRootSnapshot {
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	readonly nodeExclusion: NodeExclusionSettings;
	readonly frontmatterLinks: FrontmatterLinkSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundsOf(specNode: Record<string, unknown>): SettingsLeafBounds | undefined {
	const min = specNode["min"];
	if (typeof min !== "number") {
		return undefined;
	}
	const max = specNode["max"];
	const step = specNode["step"];
	return {
		min,
		...(typeof max === "number" ? { max } : {}),
		...(typeof step === "number" ? { step } : {}),
	};
}

function leavesUnder(node: Record<string, unknown>, path: readonly string[]): SettingsSpecLeaf[] {
	const leaves: SettingsSpecLeaf[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (!isRecord(value)) {
			continue; // Every spec node is an object; anything else is not part of the tree.
		}
		const here = [...path, key];
		if ("default" in value) {
			const bounds = boundsOf(value);
			leaves.push({
				id: here.join("."),
				path: here,
				default: value["default"],
				...(bounds === undefined ? {} : { bounds }),
			});
			continue;
		}
		leaves.push(...leavesUnder(value, here));
	}
	return leaves;
}

/** Every leaf of the spec, in declaration order. */
export const EVERY_SETTINGS_SPEC_LEAF: readonly SettingsSpecLeaf[] = leavesUnder(
	SETTINGS_SPEC as unknown as Record<string, unknown>,
	[],
);

/**
 * Spec leaves that deliberately have NO settings field of their own, so nothing can
 * parse, persist or reset them — they exist to declare bounds for a SIBLING shape.
 * Currently empty (the last such leaf, the metric weight, left with the metric
 * dials); kept so a future bounds-only leaf has its declared escape hatch.
 */
export const BOUNDS_ONLY_SPEC_LEAF_IDS: readonly string[] = [];

/** The leaves that ARE settings fields — the surface parse / round-trip / reset must cover. */
export const SETTINGS_FIELD_LEAVES: readonly SettingsSpecLeaf[] = EVERY_SETTINGS_SPEC_LEAF.filter(
	(leaf) => !BOUNDS_ONLY_SPEC_LEAF_IDS.includes(leaf.id),
);

/** The settings root every field sits at its spec default in. */
export function defaultSettingsRoot(): SettingsRootSnapshot {
	return {
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		frontmatterLinks: EngineDefaults.frontmatterLinkSettings(),
	};
}

/** The value `root` currently holds at `leaf`, or `undefined` if the path is absent. */
export function readLeaf(root: unknown, leaf: SettingsSpecLeaf): unknown {
	let cursor: unknown = root;
	for (const key of leaf.path) {
		if (!isRecord(cursor)) {
			return undefined;
		}
		cursor = cursor[key];
	}
	return cursor;
}

/**
 * A JSON deep copy of `root` — the same trip through `data.json` the real load path
 * takes, so nothing a test builds can share structure with what it asserts against.
 */
function jsonCopy<T>(root: T): T {
	return JSON.parse(JSON.stringify(root)) as T;
}

/** The record holding `leaf`, inside `copy`. Throws rather than silently no-op'ing. */
function parentOf(copy: unknown, leaf: SettingsSpecLeaf): { holder: Record<string, unknown>; key: string } {
	let cursor: unknown = copy;
	for (const key of leaf.path.slice(0, -1)) {
		if (!isRecord(cursor)) {
			throw new Error(`spec leaf id=[${leaf.id}] has no parent object in this root`);
		}
		cursor = cursor[key];
	}
	const key = leaf.path[leaf.path.length - 1];
	if (!isRecord(cursor) || key === undefined) {
		throw new Error(`spec leaf id=[${leaf.id}] has no parent object in this root`);
	}
	return { holder: cursor, key };
}

/** `root` with `leaf` set to `value` (deep-copied; `root` untouched). */
export function withLeaf<T>(root: T, leaf: SettingsSpecLeaf, value: unknown): T {
	const copy = jsonCopy(root);
	const { holder, key } = parentOf(copy, leaf);
	holder[key] = value;
	return copy;
}

/** `root` with `leaf` REMOVED (deep-copied) — what an older or hand-trimmed `data.json` looks like. */
export function withoutLeaf<T>(root: T, leaf: SettingsSpecLeaf): T {
	const copy = jsonCopy(root);
	const { holder, key } = parentOf(copy, leaf);
	delete holder[key];
	return copy;
}

/** The alternate exclusion pattern list — arbitrary, only has to differ from the default `[]`. */
const ALTERNATE_EXCLUSION_PATTERNS: readonly string[] = ["^Attachments/"];

/** The node-preview string leaf {@link alternateLeafValue} draws an alternate from its enum for. */
const NODE_PREVIEW_LEAF_ID = "globalView.nodePreviewPreference";

/** The id-ref-fields string leaf: a free-form comma-separated list, so its alternate is a literal. */
const ID_REF_FIELDS_LEAF_ID = "frontmatterLinks.idRefFields";

/** A non-default value for {@link ID_REF_FIELDS_LEAF_ID} — arbitrary, only has to differ from `""`. */
const ALTERNATE_ID_REF_FIELDS = "deps, links";

/**
 * A value for `leaf` that is VALID but NOT its default — what a round-trip, a
 * fall-back-to-default and a restore-defaults test all need in order to prove anything.
 *
 * `undefined` means "cannot derive one", which is a LOUD failure at every call site
 * rather than a silently skipped field: a new leaf of an unmodelled type must teach
 * this function about itself.
 *
 * Numbers use `bounds.min` (or `bounds.max` if the default already IS the min): every
 * bounded field's min differs from its default, min is by definition in range, and it
 * is an exact literal — unlike `default + step`, which introduces float noise
 * (`0.05 + 0.01`) that would make the assertions about the arithmetic instead of the
 * wiring.
 */
export function alternateLeafValue(leaf: SettingsSpecLeaf): unknown {
	const declared = leaf.default;
	if (typeof declared === "number") {
		const { bounds } = leaf;
		if (bounds === undefined) {
			return undefined; // No declared range → no value known to be storable.
		}
		return bounds.min !== declared ? bounds.min : bounds.max;
	}
	if (typeof declared === "boolean") {
		return !declared;
	}
	if (typeof declared === "string") {
		// Each string-valued leaf has its OWN domain, and a new one must teach this
		// function about itself rather than silently borrow another's value and fail
		// somewhere downstream (loud, but blaming the round-trip instead of this fixture).
		if (leaf.id === NODE_PREVIEW_LEAF_ID) {
			return NODE_PREVIEW_PREFERENCES.find((preference) => preference !== declared);
		}
		if (leaf.id === ID_REF_FIELDS_LEAF_ID) {
			return ALTERNATE_ID_REF_FIELDS;
		}
		throw new Error(
			`spec leaf id=[${leaf.id}] is string-valued but its domain is unknown here; ` +
				`teach alternateLeafValue about it (modelled: [${NODE_PREVIEW_LEAF_ID}], [${ID_REF_FIELDS_LEAF_ID}])`,
		);
	}
	if (Array.isArray(declared)) {
		return [...ALTERNATE_EXCLUSION_PATTERNS];
	}
	return undefined;
}

/**
 * A stored value `leaf`'s parser MUST reject, falling back to its declared default —
 * what the "garbage in ⇒ default out" persistence claim needs, per leaf.
 *
 * For almost every leaf a non-enum STRING is unusable at once: not a number, not a
 * boolean, not an array, and not a recognized `nodePreviewPreference`. The exception is
 * a FREE-FORM string leaf (`idRefFields`), where any string is a legitimate value, so
 * its garbage must be a NON-string instead. Kept beside {@link alternateLeafValue} so
 * one place owns every leaf's type knowledge.
 */
const GARBAGE_STRING = "not-a-valid-setting-value";
const GARBAGE_NON_STRING = 42;
export function garbageLeafValue(leaf: SettingsSpecLeaf): unknown {
	return leaf.id === ID_REF_FIELDS_LEAF_ID ? GARBAGE_NON_STRING : GARBAGE_STRING;
}

/**
 * The settings root with EVERY declared field at a non-default value. Throws naming the
 * offending leaf when {@link alternateLeafValue} cannot serve one — a test that quietly
 * left a field at its default would prove nothing about that field.
 */
export function alternateSettingsRoot(): SettingsRootSnapshot {
	let root = defaultSettingsRoot();
	for (const leaf of SETTINGS_FIELD_LEAVES) {
		const alternate = alternateLeafValue(leaf);
		if (alternate === undefined) {
			throw new Error(`no non-default value can be derived for spec leaf id=[${leaf.id}]`);
		}
		root = withLeaf(root, leaf, alternate);
	}
	return root;
}
