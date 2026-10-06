import { asVaultPath, directedLinkKey } from "../engine";
import type { DirectedLink, SyntaxRelationshipNames, SyntaxRelationshipProvider, VaultPath } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { InlineFieldKeys } from "../shared/InlineFieldKeys";
import { ReferenceOrder } from "./ReferenceOrder";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

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
 */
export class ObsidianSyntaxRelationshipProvider implements SyntaxRelationshipProvider {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
	) {}

	async syntaxNamesFor(pairs: readonly DirectedLink[]): Promise<SyntaxRelationshipNames> {
		const targetsBySource = new Map<VaultPath, Set<VaultPath>>();
		for (const pair of pairs) {
			const targets = targetsBySource.get(pair.source) ?? new Set<VaultPath>();
			targets.add(pair.target);
			targetsBySource.set(pair.source, targets);
		}
		const names = new Map<string, string[]>();
		await Promise.all(
			[...targetsBySource].map(([source, targets]) => this.collectNamesOf(source, targets, names)),
		);
		return names;
	}

	/** Adds `source`'s distinct names for each requested target to `into`, in note order. */
	private async collectNamesOf(
		source: VaultPath,
		targets: ReadonlySet<VaultPath>,
		into: Map<string, string[]>,
	): Promise<void> {
		if (!FileKinds.isMarkdownPath(source)) {
			return;
		}
		const file = this.vault.getFileByPath(source);
		const cache = file === null ? null : this.metadataCache.getFileCache(file);
		if (file === null || cache === null) {
			return;
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
			return;
		}
		const text = await this.vault.cachedRead(file);
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
	}
}
