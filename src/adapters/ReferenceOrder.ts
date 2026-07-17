import type { CachedMetadataPort, ReferencePort } from "./obsidianPorts";

/**
 * True reference order of a markdown file's links (planning default, step-03
 * CLARIFICATION): `resolvedLinks` is a target→count record with no ordering
 * contract, so ordering comes from `getFileCache` instead. Order drives
 * `FileMetadata.attachments` and thereby `firstImagePath` (thumbnails).
 */
export class ReferenceOrder {
	/**
	 * Link texts in document order: frontmatter (property) links first — they
	 * sit at the top of the file and carry no body offset — then body links and
	 * embeds merged by their start offset.
	 */
	static orderedLinkTexts(cache: CachedMetadataPort): readonly string[] {
		const frontmatterTexts = (cache.frontmatterLinks ?? []).map((ref) => ref.link);
		const bodyRefs: ReferencePort[] = [...(cache.links ?? []), ...(cache.embeds ?? [])];
		bodyRefs.sort((a, b) => a.position.start.offset - b.position.start.offset);
		return [...frontmatterTexts, ...bodyRefs.map((ref) => ref.link)];
	}
}
