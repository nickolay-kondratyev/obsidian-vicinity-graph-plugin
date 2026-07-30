import type { LinkKind } from "../shared/LinkKind";
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
	readonly kind: LinkKind;
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
	 *
	 * Each reference also carries its {@link LinkKind}, taken from ARRAY
	 * PROVENANCE: `cache.embeds` holds embeds, `cache.links` plain links, and
	 * `EmbedCache`/`LinkCache` are otherwise structurally identical in Obsidian's
	 * typings. Provenance beats sniffing `Reference.original[0] === "!"` — it is
	 * free, and it cannot be fooled by odd markdown (the two are cross-checked in
	 * this class's tests). Frontmatter (property) links are NEVER embeds, so they
	 * are unconditionally plain links.
	 */
	static orderedReferences(cache: CachedMetadataPort): readonly OrderedReference[] {
		const frontmatter = (cache.frontmatterLinks ?? []).map(
			(ref): OrderedReference => ({
				link: ref.link,
				offset: FRONTMATTER_REFERENCE_OFFSET,
				kind: "link",
			}),
		);
		const bodyRefs = [
			...ReferenceOrder.bodyReferencesOfKind(cache.links, "link"),
			...ReferenceOrder.bodyReferencesOfKind(cache.embeds, "embed"),
		];
		bodyRefs.sort((a, b) => a.offset - b.offset);
		return [...frontmatter, ...bodyRefs];
	}

	/** Tags one provenance array with the kind that array MEANS, dropping the position wrapper. */
	private static bodyReferencesOfKind(
		references: readonly ReferencePort[] | undefined,
		kind: LinkKind,
	): readonly OrderedReference[] {
		return (references ?? []).map((ref) => ({ link: ref.link, offset: ref.position.start.offset, kind }));
	}
}
