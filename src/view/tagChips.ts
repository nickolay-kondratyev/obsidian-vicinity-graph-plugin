import type { Tag } from "../shared/Tags";
import type { GroupColorToken } from "./grouping";
import { tagColorTokenOf } from "./tagColor";

/**
 * The leftover-tag chips a note shows in tag-grouping mode (tags-v1 decision 3): the
 * note's tags no enclosing box already names, capped so a heavily tagged note cannot
 * grow a chip row wider than itself. Pure; `NoteNode` renders it.
 */

/**
 * At most this many chips show; the rest collapse into one `+N` chip. Three keeps the
 * row inside a typical node's width at the chip font size, and three tags is already
 * more than the eye scans at graph zoom — the `+N` tooltip lists the rest.
 */
export const MAX_VISIBLE_TAG_CHIPS = 3;

/** One visible chip. */
export interface TagChip {
	readonly tag: Tag;
	/** `#name`, in the note's own casing. */
	readonly label: string;
	readonly colorToken: GroupColorToken;
}

/** The `+N` chip standing for the tags past the cap. */
export interface TagChipOverflow {
	readonly count: number;
	/** The hidden tags, `#a #b` — the overflow chip's tooltip. */
	readonly title: string;
}

export interface TagChipRow {
	readonly chips: readonly TagChip[];
	/** `null` when every tag fits. */
	readonly overflow: TagChipOverflow | null;
}

export const NO_TAG_CHIPS: TagChipRow = { chips: [], overflow: null };

export function tagChipRowOf(leftoverTags: readonly Tag[], maxVisible = MAX_VISIBLE_TAG_CHIPS): TagChipRow {
	if (leftoverTags.length === 0) {
		return NO_TAG_CHIPS;
	}
	const chips = leftoverTags
		.slice(0, maxVisible)
		.map((tag): TagChip => ({ tag, label: hashtagOf(tag), colorToken: tagColorTokenOf(tag.key) }));
	const hidden = leftoverTags.slice(maxVisible);
	return {
		chips,
		overflow: hidden.length === 0 ? null : { count: hidden.length, title: hidden.map(hashtagOf).join(" ") },
	};
}

function hashtagOf(tag: Tag): string {
	return `#${tag.name}`;
}
