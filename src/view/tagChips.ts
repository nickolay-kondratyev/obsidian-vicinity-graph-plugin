import type { Tag } from "../shared/Tags";
import type { GroupColorToken } from "./grouping";
import { tagColorTokenOf } from "./tagColor";

/**
 * The leftover-tag chips a note shows in tag-grouping mode (tags-v1 decision 3): the
 * note's tags no enclosing box already names, fitted into ONE row under the note.
 * Pure; `NoteNode` renders it.
 *
 * The fitting rule (ticket `nid_mf28gwba8b6aihah05jtjj34z_e`): a chip may shrink (CSS
 * ellipsis) but never below a readable prefix — `#` plus {@link TAG_CHIP_MIN_PREFIX_CHARS}
 * characters — so no chip ever reads as a bare `#…`. A chip that cannot get that much
 * room folds into the `+N` chip instead. Decided HERE from the note's laid-out width and
 * an estimated glyph width, never by measuring the DOM: the node width is already known
 * at mapping time, and a measure-then-rerender pass per chip row is not worth it for a
 * glance-level hint.
 * CEILING: the glyph width is an estimate at the default theme's chip font. A theme or
 * font noticeably wider than {@link TAG_CHIP_CHAR_PX} can push the row past its width;
 * the shrinking chips absorb that first (down to their `ch`-sized minimum), so only a
 * far-off font clips the `+N` chip. Upgrade path: measure the row once per render
 * (`useLayoutEffect` + ResizeObserver) and feed the measured widths into this same rule.
 */

/**
 * At most this many chips show however wide the note is; the rest collapse into one
 * `+N` chip. Three tags is already more than the eye scans at graph zoom — the `+N`
 * tooltip lists the rest.
 */
export const MAX_VISIBLE_TAG_CHIPS = 3;

/**
 * How many characters of a tag a shrunk chip keeps, counting the `#` (`#refe…`): the
 * shortest prefix that still names a tag at a glance. A tag no longer than this plus
 * the ellipsis never shrinks at all: its shrunk chip would be no narrower (and its
 * `ch` floor could even WIDEN it past its natural width).
 */
export const TAG_CHIP_MIN_PREFIX_CHARS = 5;

/**
 * The row's floor width: a chip row may run wider than a narrow note (graph-view.css,
 * "tag chips" — the row hangs below the box and borrows the layout gap), up to this.
 * Rendered from here (`NoteTagChips`), so the rule and the CSS share one number.
 */
export const TAG_CHIP_ROW_MIN_WIDTH_PX = 160;

/** Estimated advance of one chip glyph at `--font-smallest` (measured 6.4–6.9px on the default theme; rounded up). */
const TAG_CHIP_CHAR_PX = 7;
/** The ellipsis glyph counts as this many characters (it is about one em wide). */
export const TAG_CHIP_ELLIPSIS_CHARS = 2;
/** A chip's horizontal padding (`--size-4-1` each side) plus its 1px borders. */
const TAG_CHIP_CHROME_PX = 10;
/** The gap between chips (`--size-2-1`). */
const TAG_CHIP_GAP_PX = 2;

/** One visible chip. */
export interface TagChip {
	readonly tag: Tag;
	/** `#name`, in the note's own casing. */
	readonly label: string;
	readonly colorToken: GroupColorToken;
	/**
	 * The characters this chip keeps when it has to shrink (its CSS `min-width` in `ch`,
	 * ellipsis excluded); `null` = the tag is short enough that the chip never shrinks.
	 */
	readonly minPrefixChars: number | null;
}

/** The `+N` chip standing for the tags that did not get a chip. */
export interface TagChipOverflow {
	readonly count: number;
	/** The hidden tags, `#a #b` — the overflow chip's tooltip. */
	readonly title: string;
}

export interface TagChipRow {
	readonly chips: readonly TagChip[];
	/** `null` when every tag got a chip. */
	readonly overflow: TagChipOverflow | null;
}

export const NO_TAG_CHIPS: TagChipRow = { chips: [], overflow: null };

/** The widest the chip row may render under a note this wide (the CSS `max(100%, floor)`). */
export function tagChipRowWidthPx(nodeWidthPx: number): number {
	return Math.max(nodeWidthPx, TAG_CHIP_ROW_MIN_WIDTH_PX);
}

/**
 * The chip row for a note of `nodeWidthPx`: the MOST chips (up to the cap) that fit the
 * row with each at its readable minimum, plus the `+N` chip for the rest.
 */
export function tagChipRowOf(leftoverTags: readonly Tag[], nodeWidthPx: number): TagChipRow {
	if (leftoverTags.length === 0) {
		return NO_TAG_CHIPS;
	}
	const rowWidthPx = tagChipRowWidthPx(nodeWidthPx);
	const candidates = leftoverTags.slice(0, MAX_VISIBLE_TAG_CHIPS).map(chipOf);
	let shown = candidates.length;
	while (shown > 0 && minimumRowWidthPx(candidates.slice(0, shown), leftoverTags.length - shown) > rowWidthPx) {
		shown--;
	}
	const hidden = leftoverTags.slice(shown);
	return {
		chips: candidates.slice(0, shown),
		overflow: hidden.length === 0 ? null : { count: hidden.length, title: hidden.map(hashtagOf).join(" ") },
	};
}

/**
 * The chip's CSS `min-width` — its kept prefix plus the ellipsis, in `ch` so it follows
 * the real font rather than the estimate; `undefined` = no floor (the chip never shrinks).
 * The chip box is `content-box` (graph-view.css), so padding and border sit outside it.
 */
export function tagChipMinWidthCss(chip: TagChip): string | undefined {
	return chip.minPrefixChars === null ? undefined : `${chip.minPrefixChars + TAG_CHIP_ELLIPSIS_CHARS}ch`;
}

function chipOf(tag: Tag): TagChip {
	const label = hashtagOf(tag);
	return {
		tag,
		label,
		colorToken: tagColorTokenOf(tag.key),
		minPrefixChars: label.length > TAG_CHIP_MIN_PREFIX_CHARS + TAG_CHIP_ELLIPSIS_CHARS ? TAG_CHIP_MIN_PREFIX_CHARS : null,
	};
}

/** The narrowest these chips plus a `+hiddenCount` chip can render with every chip still readable. */
function minimumRowWidthPx(chips: readonly TagChip[], hiddenCount: number): number {
	const chipWidths = chips.map((chip) => chipWidthPx(minimumChars(chip)));
	const widths = hiddenCount === 0 ? chipWidths : [...chipWidths, chipWidthPx(`+${hiddenCount}`.length)];
	return widths.reduce((sum, width) => sum + width, 0) + TAG_CHIP_GAP_PX * Math.max(widths.length - 1, 0);
}

function minimumChars(chip: TagChip): number {
	return chip.minPrefixChars === null ? chip.label.length : chip.minPrefixChars + TAG_CHIP_ELLIPSIS_CHARS;
}

function chipWidthPx(chars: number): number {
	return chars * TAG_CHIP_CHAR_PX + TAG_CHIP_CHROME_PX;
}

function hashtagOf(tag: Tag): string {
	return `#${tag.name}`;
}
