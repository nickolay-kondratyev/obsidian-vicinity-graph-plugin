import { Tags } from "../shared/Tags";
import type { Tag, TagKey } from "../shared/Tags";

/** One entry of the tag picker: a tag and how many notes the tag filter would match. */
export interface TagNoteCount {
	readonly tag: Tag;
	/** Notes carrying the tag OR a tag nested below it — the tag filter's own membership rule. */
	readonly noteCount: number;
}

/**
 * The vault's tags with their note counts, for the "Show notes with tag…" picker.
 * Pure: the caller hands each note's RAW tags (`ObsidianTags.rawTagsOf`). A note
 * counts once per tag however often it writes it, and a nested tag counts toward
 * its parents — so a count is the number of notes entering that tag's filter would
 * match (before the node cap). Most-used first, ties by name: the empty picker
 * opens on the tags the user most likely means.
 */
export function tagNoteCountsOf(notesRawTags: Iterable<readonly string[]>): readonly TagNoteCount[] {
	const counts = new Map<TagKey, { tag: Tag; noteCount: number }>();
	for (const rawTags of notesRawTags) {
		for (const tag of Tags.withAncestors(Tags.distinct(rawTags))) {
			const entry = counts.get(tag.key);
			if (entry === undefined) {
				counts.set(tag.key, { tag, noteCount: 1 });
			} else {
				entry.noteCount += 1;
			}
		}
	}
	return [...counts.values()].sort((a, b) => b.noteCount - a.noteCount || a.tag.key.localeCompare(b.tag.key));
}
