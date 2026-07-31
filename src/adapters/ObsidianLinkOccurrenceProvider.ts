import type {
	BacklinkSourceOccurrences,
	LinkOccurrence,
	LinkOccurrenceProvider,
	LinkProvider,
	OutgoingLinkOccurrence,
	VaultPath,
} from "../engine";
import { asVaultPath, LinkContextSnippets } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { BacklinksAdapter } from "./BacklinksAdapter";
import { ReferenceOrder } from "./ReferenceOrder";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

/** An occurrence with nothing positional to say: canvas, frontmatter, or fallback. */
const POSITIONLESS_OCCURRENCE: LinkOccurrence = { offset: null, context: null };

/**
 * The real {@link LinkOccurrenceProvider} (link-preview data layer, ticket
 * `nid_1drobt9qaq3e89gt76fzghlik_e`). Positions come from the metadata cache's
 * per-reference offsets (the same source `ReferenceOrder` orders by); context
 * snippets are extracted by the pure `LinkContextSnippets` over `cachedRead`
 * text. Everything position-less — canvas references, frontmatter links, the
 * backlinks fallback — degrades EXPLICITLY to `offset: null, context: null`.
 *
 * Leans on the existing {@link LinkProvider} (never re-derives its answers) for
 * the questions that provider already owns: canvas outgoing references, the
 * merged incoming-source list, and pair multiplicity (`getLinkCount`).
 */
export class ObsidianLinkOccurrenceProvider implements LinkOccurrenceProvider {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		private readonly linkProvider: LinkProvider,
	) {}

	async outgoingOccurrences(path: VaultPath): Promise<readonly OutgoingLinkOccurrence[]> {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return [];
		}
		const cache = this.metadataCache.getFileCache(file);
		if (cache === null || !FileKinds.isMarkdownPath(file.path)) {
			// Canvas (or markdown the cache cannot order yet): the LinkProvider owns
			// those targets; positions/context do not exist there. Multiplicity comes
			// from getLinkCount so the modal agrees with the rendered edge badge.
			return this.positionlessOutgoingOccurrences(path);
		}
		const text = await this.vault.cachedRead(file);
		const occurrences: OutgoingLinkOccurrence[] = [];
		for (const reference of ReferenceOrder.orderedReferences(cache)) {
			const target = this.metadataCache.getFirstLinkpathDest(reference.link, file.path)?.path;
			if (target === undefined) {
				continue; // Unresolved links are not occurrences of anything.
			}
			occurrences.push({
				targetPath: asVaultPath(target),
				// Frontmatter links carry a negative sentinel offset — no body position.
				...(reference.offset < 0 ? POSITIONLESS_OCCURRENCE : occurrenceAt(text, reference.offset)),
			});
		}
		return occurrences;
	}

	async backlinkOccurrences(path: VaultPath): Promise<readonly BacklinkSourceOccurrences[]> {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return [];
		}
		const offsetsBySource = BacklinksAdapter.backlinkOccurrenceOffsets(this.metadataCache, file);
		const groups: BacklinkSourceOccurrences[] = [];
		// The LinkProvider's incoming list is the membership truth (it already merges
		// canvas sources and owns the API-absent fallback); offsets only ENRICH it.
		for (const sourcePath of this.linkProvider.getIncomingLinks(path)) {
			groups.push({
				sourcePath,
				occurrences: await this.backlinkOccurrencesFrom(sourcePath, path, offsetsBySource?.get(sourcePath)),
			});
		}
		return groups;
	}

	async occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]> {
		const outgoing = await this.outgoingOccurrences(source);
		return outgoing.filter((occurrence) => occurrence.targetPath === target);
	}

	/** One source's backlink occurrences: positioned when offsets exist, else counted position-less. */
	private async backlinkOccurrencesFrom(
		sourcePath: VaultPath,
		targetPath: VaultPath,
		offsets: readonly (number | null)[] | undefined,
	): Promise<readonly LinkOccurrence[]> {
		if (offsets === undefined || offsets.length === 0) {
			// No per-reference data (fallback, canvas source, or unreadable list):
			// getLinkCount keeps the occurrence COUNT honest; min 1 because the
			// source is in the incoming list, so at least one link exists.
			const count = Math.max(1, this.linkProvider.getLinkCount(sourcePath, targetPath));
			return Array.from({ length: count }, () => POSITIONLESS_OCCURRENCE);
		}
		const sourceFile = this.vault.getFileByPath(sourcePath);
		const text = sourceFile === null ? null : await this.vault.cachedRead(sourceFile);
		return offsets.map((offset) =>
			offset === null || text === null ? POSITIONLESS_OCCURRENCE : occurrenceAt(text, offset),
		);
	}

	private positionlessOutgoingOccurrences(path: VaultPath): readonly OutgoingLinkOccurrence[] {
		const occurrences: OutgoingLinkOccurrence[] = [];
		for (const targetPath of this.linkProvider.getOutgoingLinks(path)) {
			const count = Math.max(1, this.linkProvider.getLinkCount(path, targetPath));
			for (let index = 0; index < count; index += 1) {
				occurrences.push({ targetPath, ...POSITIONLESS_OCCURRENCE });
			}
		}
		return occurrences;
	}
}

function occurrenceAt(text: string, offset: number): LinkOccurrence {
	return { offset, context: LinkContextSnippets.snippetAt(text, offset) };
}
