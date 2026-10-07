import { asVaultPath, directedLinkKey } from "../engine";
import type { DirectedLink, SyntaxRelationshipProvider, SyntaxRelationshipRead, VaultPath } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { InlineFieldKeys } from "../shared/InlineFieldKeys";
import { ReferenceOrder } from "./ReferenceOrder";
import type { CachedMetadataPort, MetadataCachePort, VaultPort } from "./obsidianPorts";

/**
 * The real {@link SyntaxRelationshipProvider} (ticket
 * `nid_gk9h4jpa7di1al7och0rehd3h_e`): for each requested SOURCE note, the
 * metadata cache says where its body links sit and Obsidian resolves where they
 * point; the pure {@link InlineFieldKeys} reads the inline-field key in front of
 * each one from `cachedRead` text. Link recognition and resolution therefore stay
 * Obsidian's — this never parses `[[…]]` itself.
 *
 * Frontmatter links never name a relationship (human decision 2026-10-06: such
 * keys are usually weak, like `related`), and canvas has no syntax names in V1.
 * Bounded by the caller's pairs: only their sources are read, each at most once,
 * and only when one of its links reaches a requested target.
 *
 * The link cache LAGS edits: right after an id is written into a note's frontmatter
 * (naming a pair does that), `cachedRead` already returns the new text while the
 * cached offsets still describe the old one, so every key would be read from the
 * wrong place. Every body link's `original` must sit at its cached offset, or the
 * source is reported UNREAD — its names unknown until the cache catches up (the
 * metadata `resolved` event then rebuilds the graph).
 */
export class ObsidianSyntaxRelationshipProvider implements SyntaxRelationshipProvider {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
	) {}

	async syntaxNamesFor(pairs: readonly DirectedLink[]): Promise<SyntaxRelationshipRead> {
		const targetsBySource = new Map<VaultPath, Set<VaultPath>>();
		for (const pair of pairs) {
			const targets = targetsBySource.get(pair.source) ?? new Set<VaultPath>();
			targets.add(pair.target);
			targetsBySource.set(pair.source, targets);
		}
		const names = new Map<string, string[]>();
		const unreadSources = new Set<VaultPath>();
		await Promise.all(
			[...targetsBySource].map(async ([source, targets]) => {
				if ((await this.collectNamesOf(source, targets, names)) === "cache-lags-text") {
					unreadSources.add(source);
				}
			}),
		);
		return { names, unreadSources };
	}

	/**
	 * Adds `source`'s distinct names for each requested target to `into`, in note order —
	 * or adds nothing and answers `cache-lags-text` when the cache does not describe the
	 * text just read.
	 */
	private async collectNamesOf(
		source: VaultPath,
		targets: ReadonlySet<VaultPath>,
		into: Map<string, string[]>,
	): Promise<"read" | "cache-lags-text"> {
		if (!FileKinds.isMarkdownPath(source)) {
			return "read";
		}
		const file = this.vault.getFileByPath(source);
		const cache = file === null ? null : this.metadataCache.getFileCache(file);
		if (file === null || cache === null) {
			return "read";
		}
		const requestedLinks = ReferenceOrder.orderedReferences(cache)
			// Frontmatter links carry a negative sentinel offset — never named.
			.filter((reference) => reference.offset >= 0)
			.map((reference) => ({
				offset: reference.offset,
				target: this.metadataCache.getFirstLinkpathDest(reference.link, source)?.path,
			}))
			.filter((link): link is { offset: number; target: string } =>
				link.target !== undefined && targets.has(asVaultPath(link.target)),
			);
		if (requestedLinks.length === 0) {
			return "read";
		}
		const text = await this.vault.cachedRead(file);
		if (!cacheDescribes(cache, text)) {
			return "cache-lags-text";
		}
		for (const link of requestedLinks) {
			const key = InlineFieldKeys.keyAtOffset(text, link.offset);
			if (key === null) {
				continue;
			}
			const pairKey = directedLinkKey(source, asVaultPath(link.target));
			const names = into.get(pairKey) ?? [];
			if (!names.includes(key)) {
				names.push(key);
			}
			into.set(pairKey, names);
		}
		return "read";
	}
}

/** Whether every body link and embed the cache lists is written, verbatim, at its cached offset in `text`. */
function cacheDescribes(cache: CachedMetadataPort, text: string): boolean {
	return [...(cache.links ?? []), ...(cache.embeds ?? [])].every((reference) =>
		text.startsWith(reference.original, reference.position.start.offset),
	);
}
