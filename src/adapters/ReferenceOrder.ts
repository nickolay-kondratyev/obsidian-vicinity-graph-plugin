import type { CachedMetadataPort, ReferencePort } from "./obsidianPorts";

/**
 * A reference in document order, carrying the offset the order was derived from.
 * The offset is a character offset into the file — the SAME coordinate space as
 * `HeadingPort.position.start.offset`, which is what lets the outline rule
 * compare "first image" against "first heading".
 */
export interface OrderedReference {
	readonly link: string;
	readonly offset: number;
}

/**
 * Offset assigned to frontmatter (property) links: they sit ABOVE all body
 * content, so any negative sentinel orders them first and — decisively for the
 * outline rule — before every heading (whose offsets are >= 0).
 */
export const FRONTMATTER_REFERENCE_OFFSET = -1;

/**
 * True reference order of a markdown file's links (planning default, step-03
 * CLARIFICATION): `resolvedLinks` is a target→count record with no ordering
 * contract, so ordering comes from `getFileCache` instead. Order drives
 * `FileMetadata.attachments` and thereby `firstImagePath` (thumbnails), and the
 * offsets drive the image-vs-outline rule.
 */
export class ReferenceOrder {
	/**
	 * References in document order WITH their offsets: frontmatter (property)
	 * links first at {@link FRONTMATTER_REFERENCE_OFFSET} — they sit at the top
	 * of the file and carry no body offset — then body links and embeds merged by
	 * their start offset.
	 *
	 * The result is therefore ASCENDING by offset end to end (the sentinel is
	 * negative, body offsets are >= 0), which lets callers stop scanning once they
	 * pass an offset of interest instead of resolving every reference.
	 */
	static orderedReferences(cache: CachedMetadataPort): readonly OrderedReference[] {
		const frontmatter = (cache.frontmatterLinks ?? []).map((ref) => ({
			link: ref.link,
			offset: FRONTMATTER_REFERENCE_OFFSET,
		}));
		const bodyRefs: ReferencePort[] = [...(cache.links ?? []), ...(cache.embeds ?? [])];
		bodyRefs.sort((a, b) => a.position.start.offset - b.position.start.offset);
		return [...frontmatter, ...bodyRefs.map((ref) => ({ link: ref.link, offset: ref.position.start.offset }))];
	}
}
