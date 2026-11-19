import type { TagKey } from "../shared/Tags";
import type { GroupColorToken } from "./grouping";

/**
 * THE tag colour rule (tags-v1 decision 6): a tag's colour is a theme colour
 * NAME, never a hex value. The CSS that paints a token maps it onto Obsidian's
 * theme variables — `--color-<name>` for every chromatic name, and a neutral
 * base/muted variable for `grey` (Obsidian has no `--color-grey`) — so light and
 * dark themes both just work. Pure: no DOM, no Obsidian.
 */
export type TagColorName = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | "grey";

/**
 * Preset families, matched on a tag's LAST segment after
 * {@link normalisedLastSegmentOf} (so `follow-up` = `followup` = `Follow_Up`,
 * and `#work/done` is green). Spelled here already normalised. README.md's colour
 * table lists the same families (guarded by `tagColor.test.ts`).
 */
export const PRESET_FAMILIES: ReadonlyArray<{ readonly color: TagColorName; readonly words: readonly string[] }> = [
	{ color: "red", words: ["critical", "urgent", "blocker", "bug", "asap", "fixme", "error", "broken", "important"] },
	{ color: "orange", words: ["todo", "followup", "wip", "inprogress", "pending", "waiting", "review", "action"] },
	{ color: "yellow", words: ["idea", "question", "draft", "maybe", "someday"] },
	{ color: "green", words: ["done", "complete", "completed", "resolved", "approved"] },
	{ color: "blue", words: ["reference", "info", "docs", "research", "learning"] },
	{ color: "purple", words: ["project", "goal", "area"] },
	{ color: "grey", words: ["archive", "archived", "deprecated", "obsolete"] },
];

const PRESET_COLOR_BY_WORD: ReadonlyMap<string, TagColorName> = new Map(
	PRESET_FAMILIES.flatMap((family) => family.words.map((word) => [word, family.color] as const)),
);

/**
 * The palette an unlisted tag hashes into: every chromatic theme colour. WHY-NOT
 * `grey`: it reads as "archived / inactive", a meaning only the preset family
 * should carry.
 */
export const HASHED_TAG_COLOR_NAMES: readonly TagColorName[] = [
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
];

const NESTING_SEPARATOR = "/";
/** Word separators a tag may be written with; ignored when matching a preset. */
const WORD_SEPARATORS = /[-_]/g;

/** The colour token for a tag: its preset family, else a stable hash into {@link HASHED_TAG_COLOR_NAMES}. */
export function tagColorTokenOf(tag: TagKey): GroupColorToken {
	return presetTagColorOf(tag) ?? asColorToken(hashedColorOf(tag));
}

/** The tag's preset-family token, or `undefined` when its last segment names no preset. */
export function presetTagColorOf(tag: TagKey): GroupColorToken | undefined {
	const preset = PRESET_COLOR_BY_WORD.get(normalisedLastSegmentOf(tag));
	return preset === undefined ? undefined : asColorToken(preset);
}

function asColorToken(name: TagColorName): GroupColorToken {
	return name as string as GroupColorToken;
}

/** `TagKey` is already lower-cased, so only the separators need dropping. */
function normalisedLastSegmentOf(tag: TagKey): string {
	const lastSegment = tag.slice(tag.lastIndexOf(NESTING_SEPARATOR) + 1);
	return lastSegment.replace(WORD_SEPARATORS, "");
}

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

/**
 * FNV-1a (32-bit) over the whole key: stable across sessions and machines (no
 * `Math.random`, no locale), so a tag keeps its colour forever.
 */
function hashedColorOf(tag: TagKey): TagColorName {
	let hash = FNV_OFFSET_BASIS_32;
	for (let index = 0; index < tag.length; index++) {
		hash ^= tag.charCodeAt(index);
		hash = Math.imul(hash, FNV_PRIME_32) >>> 0;
	}
	return HASHED_TAG_COLOR_NAMES[hash % HASHED_TAG_COLOR_NAMES.length] ?? "blue";
}
