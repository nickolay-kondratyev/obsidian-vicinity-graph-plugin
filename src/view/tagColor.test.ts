import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TagKey } from "../shared/Tags";
import { Tags } from "../shared/Tags";
import { HASHED_TAG_COLOR_NAMES, PRESET_FAMILIES, tagColorTokenOf } from "./tagColor";

const README = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "README.md");
/** A README colour-table row: `| red | critical, urgent, ... |`. */
const README_COLOR_ROW = /^\| *([a-z]+) *\| *([a-z][a-z, -]*?) *\|$/;
const WORD_SEPARATORS = /[-_]/g;

/** The README's preset table, words normalised the way `PRESET_FAMILIES` spells them. */
function readmePresetFamilies(): ReadonlyArray<{ readonly color: string; readonly words: readonly string[] }> {
	return readFileSync(README, "utf8")
		.split("\n")
		.map((line) => README_COLOR_ROW.exec(line.trim()))
		.filter((match): match is RegExpExecArray => match !== null)
		.map(([, color = "", words = ""]) => ({
			color,
			words: words.split(",").map((word) => word.trim().replace(WORD_SEPARATORS, "")),
		}));
}

function keyOf(raw: string): TagKey {
	const tag = Tags.parse(raw);
	if (tag === undefined) {
		throw new Error(`fixture tag must parse: raw=[${raw}]`);
	}
	return tag.key;
}

describe("tagColorTokenOf preset families", () => {
	it("WHEN the tag is follow-up THEN it is orange", () => {
		expect(tagColorTokenOf(keyOf("follow-up"))).toBe("orange");
	});

	it("WHEN the tag is written FollowUp (other case, no separator) THEN it is orange", () => {
		expect(tagColorTokenOf(keyOf("#FollowUp"))).toBe("orange");
	});

	it("WHEN the tag is Follow_Up (underscore separator) THEN it is orange", () => {
		expect(tagColorTokenOf(keyOf("Follow_Up"))).toBe("orange");
	});

	it("WHEN the tag is todo THEN it is orange", () => {
		expect(tagColorTokenOf(keyOf("todo"))).toBe("orange");
	});

	it("WHEN the tag is critical THEN it is red", () => {
		expect(tagColorTokenOf(keyOf("critical"))).toBe("red");
	});

	it("WHEN a nested tag's LAST segment is a preset THEN that preset colours it", () => {
		expect(tagColorTokenOf(keyOf("work/done"))).toBe("green");
	});

	it("WHEN the tag is archived THEN it is grey", () => {
		expect(tagColorTokenOf(keyOf("archived"))).toBe("grey");
	});
});

describe("tagColorTokenOf hashed fallback", () => {
	it("WHEN an unknown tag is coloured twice THEN both calls give the same token", () => {
		expect(tagColorTokenOf(keyOf("zebra-crossing"))).toBe(tagColorTokenOf(keyOf("zebra-crossing")));
	});

	it("WHEN an unknown tag is coloured THEN the token comes from the hashed palette", () => {
		expect(HASHED_TAG_COLOR_NAMES).toContain(tagColorTokenOf(keyOf("zebra-crossing")));
	});

	it("WHEN many unknown tags are coloured THEN the hash spreads them over more than one token", () => {
		const tokens = new Set(["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"].map((raw) => tagColorTokenOf(keyOf(raw))));
		expect(tokens.size).toBeGreaterThan(1);
	});
});

describe("README colour table", () => {
	it("WHEN the README lists the preset colours THEN it lists exactly the shipped families", () => {
		expect(readmePresetFamilies()).toEqual(PRESET_FAMILIES);
	});
});
