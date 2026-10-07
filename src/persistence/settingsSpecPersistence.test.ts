import { describe, expect, it } from "vitest";
import {
	SETTINGS_FIELD_LEAVES,
	alternateSettingsRoot,
	defaultSettingsRoot,
	garbageLeafValue,
	readLeaf,
	withLeaf,
	withoutLeaf,
} from "../engine/testFixtures/settingsSpecLeaves";
import type { SettingsSpecLeaf } from "../engine/testFixtures/settingsSpecLeaves";
import { PERSISTED_SHAPE_VERSION, PersistedShapes } from "./persistedShapes";

/**
 * EVERY DECLARED SETTINGS FIELD, through `data.json` — parse, round-trip, and the two
 * ways a stored value can be unusable (absent, garbage).
 *
 * Spec-ITERATING on purpose: `persistedShapes.test.ts` states the per-family parsing
 * RULES with hand-written fixtures (that is where a rule's WHY belongs); this file states
 * the flat, total claim over `SETTINGS_FIELD_LEAVES` that no hand-written fixture can
 * keep true for long — "no declared field is missing from the parser". A field added to
 * `SETTINGS_SPEC` but never wired into `parseViewFields` & friends fails here, naming
 * itself, instead of quietly never surviving a restart.
 *
 * The fixtures are built by walking the spec, so the expected values are the spec's own
 * — no literal defaults, no literal bounds anywhere in this file.
 */

/** The persisted document a settings root produces, as the store writes it. */
function pluginDataFor(root: unknown): unknown {
	if (typeof root !== "object" || root === null) {
		throw new Error("a settings root must be an object");
	}
	return { version: PERSISTED_SHAPE_VERSION, pins: [], ...root };
}

/** Load `raw` exactly as a plugin start-up does — through JSON, then through the parser. */
function parsedRoot(raw: unknown): unknown {
	const parsed = PersistedShapes.parsePluginData(JSON.parse(JSON.stringify(raw)));
	return {
		globalDepths: parsed.globalDepths,
		globalView: parsed.globalView,
		nodeExclusion: parsed.nodeExclusion,
		frontmatterLinks: parsed.frontmatterLinks,
	};
}

function describeMismatch(leaf: SettingsSpecLeaf, expected: unknown, got: unknown): string {
	return `${leaf.id}: expected=[${JSON.stringify(expected)}] got=[${JSON.stringify(got)}]`;
}

/**
 * The ONE declared CROSS-FIELD settings rule, and therefore the one pair the
 * sibling-independence claim below cannot make: `clampSizingSettings` enforces
 * `maxPx >= minPx` by RAISING `maxPx`, so repairing a garbage `minPx` back to its
 * default legitimately moves a stored `maxPx` that sat below it.
 *
 * Listed rather than silently tolerated: a SECOND coupling would have to be written
 * here, in the open. The rule itself is pinned at this door by `persistedShapes.test.ts`
 * ("an inverted stored pair loads with maxPx raised"), so this exemption hides no
 * behaviour — it only stops one rule being read as the wholesale-defaults bug this
 * test exists to catch.
 */
const CROSS_FIELD_REPAIRS: readonly { readonly repaired: string; readonly moves: string }[] = [
	{ repaired: "globalView.sizing.minPx", moves: "globalView.sizing.maxPx" },
];

function isCrossFieldRepair(repaired: SettingsSpecLeaf, sibling: SettingsSpecLeaf): boolean {
	return CROSS_FIELD_REPAIRS.some((rule) => rule.repaired === repaired.id && rule.moves === sibling.id);
}

describe("every declared settings field survives data.json", () => {
	const alternates = alternateSettingsRoot();
	const defaults = defaultSettingsRoot();

	it("WHEN the non-default fixture is compared to the defaults THEN every field differs (else the round-trip proves nothing)", () => {
		const same = SETTINGS_FIELD_LEAVES.filter(
			(leaf) => JSON.stringify(readLeaf(alternates, leaf)) === JSON.stringify(readLeaf(defaults, leaf)),
		).map((leaf) => leaf.id);
		expect(same).toEqual([]);
	});

	it("WHEN every declared field is persisted at a non-default value THEN each parses back identically", () => {
		const loaded = parsedRoot(pluginDataFor(alternates));
		const lost = SETTINGS_FIELD_LEAVES.filter(
			(leaf) => JSON.stringify(readLeaf(loaded, leaf)) !== JSON.stringify(readLeaf(alternates, leaf)),
		).map((leaf) => describeMismatch(leaf, readLeaf(alternates, leaf), readLeaf(loaded, leaf)));
		expect(lost).toEqual([]);
	});

	it("WHEN a declared field is absent from data.json THEN it loads at its declared default", () => {
		// One field removed at a time, from an otherwise all-non-default document: a
		// whole-object family (`sizing`, `forceLayout`) must repair the missing field
		// WITHOUT discarding its siblings, which a wholesale default would hide.
		const wrong = SETTINGS_FIELD_LEAVES.flatMap((leaf) => {
			const loaded = parsedRoot(pluginDataFor(withoutLeaf(alternates, leaf)));
			const got = readLeaf(loaded, leaf);
			return JSON.stringify(got) === JSON.stringify(leaf.default)
				? []
				: [describeMismatch(leaf, leaf.default, got)];
		});
		expect(wrong).toEqual([]);
	});

	it("WHEN a declared field holds garbage THEN it loads at its declared default", () => {
		const wrong = SETTINGS_FIELD_LEAVES.flatMap((leaf) => {
			const loaded = parsedRoot(pluginDataFor(withLeaf(alternates, leaf, garbageLeafValue(leaf))));
			const got = readLeaf(loaded, leaf);
			return JSON.stringify(got) === JSON.stringify(leaf.default)
				? []
				: [describeMismatch(leaf, leaf.default, got)];
		});
		expect(wrong).toEqual([]);
	});

	it("WHEN a declared field holds garbage THEN its SIBLING fields keep their stored values", () => {
		// The rule one wholesale `?? defaults` too many would break: repairing one field
		// must never reset the rest of its family.
		const collateral = SETTINGS_FIELD_LEAVES.flatMap((leaf) => {
			const loaded = parsedRoot(pluginDataFor(withLeaf(alternates, leaf, garbageLeafValue(leaf))));
			return SETTINGS_FIELD_LEAVES.filter(
				(sibling) =>
					sibling.id !== leaf.id &&
					!isCrossFieldRepair(leaf, sibling) &&
					JSON.stringify(readLeaf(loaded, sibling)) !== JSON.stringify(readLeaf(alternates, sibling)),
			).map((sibling) => `garbage in ${leaf.id} also reset ${sibling.id}`);
		});
		expect(collateral).toEqual([]);
	});

	it("WHEN data.json carries no settings at all THEN every declared field loads at its declared default", () => {
		const loaded = parsedRoot({ version: PERSISTED_SHAPE_VERSION });
		const wrong = SETTINGS_FIELD_LEAVES.filter(
			(leaf) => JSON.stringify(readLeaf(loaded, leaf)) !== JSON.stringify(leaf.default),
		).map((leaf) => describeMismatch(leaf, leaf.default, readLeaf(loaded, leaf)));
		expect(wrong).toEqual([]);
	});
});
