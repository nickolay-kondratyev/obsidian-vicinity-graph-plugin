import type {
	LinkOccurrence,
	LinkOccurrenceProvider,
	LinkProvider,
	OutgoingLinkOccurrence,
	VaultPath,
} from "../engine";
import { asVaultPath, LinkContextSnippets } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { MarkdownEmbeds } from "../shared/MarkdownEmbeds";
import type { EmbedTargetTitle } from "../shared/MarkdownEmbeds";
import { ReferenceOrder } from "./ReferenceOrder";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

/** An occurrence with nothing positional to say: canvas or frontmatter. */
const POSITIONLESS_OCCURRENCE: LinkOccurrence = { offset: null, context: null };

/**
 * The real {@link LinkOccurrenceProvider} (link-preview data layer, ticket
 * `nid_1drobt9qaq3e89gt76fzghlik_e`). Positions come from the metadata cache's
 * per-reference offsets (the same source `ReferenceOrder` orders by); context
 * snippets are extracted by the pure `LinkContextSnippets` over `cachedRead`
 * text. Everything position-less — canvas references and frontmatter links —
 * degrades EXPLICITLY to `offset: null, context: null`.
 *
 * Leans on the existing {@link LinkProvider} (never re-derives its answers) for
 * the questions that provider already owns: canvas outgoing references and pair
 * multiplicity (`getLinkCount`).
 */
export class ObsidianLinkOccurrenceProvider implements LinkOccurrenceProvider {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		private readonly linkProvider: LinkProvider,
	) {}

	async occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]> {
		const outgoing = await this.outgoingOccurrences(source);
		return outgoing
			.filter((occurrence) => occurrence.targetPath === target)
			.map(({ offset, context }) => ({ offset, context }));
	}

	/** Outgoing link occurrences of `path`, in document order, duplicates kept. */
	private async outgoingOccurrences(path: VaultPath): Promise<readonly OutgoingLinkOccurrence[]> {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return [];
		}
		const cache = this.metadataCache.getFileCache(file);
		if (cache === null || !FileKinds.isMarkdownPath(file.path)) {
			// Canvas (or markdown the cache cannot order yet): the LinkProvider owns
			// those targets; positions/context do not exist there. Multiplicity comes
			// from getLinkCount so the drawer agrees with the rendered edge badge.
			return this.positionlessOutgoingOccurrences(path);
		}
		const text = await this.vault.cachedRead(file);
		const occurrences: OutgoingLinkOccurrence[] = [];
		const titleOf = this.embedTitleResolver(file.path);
		for (const reference of ReferenceOrder.orderedReferences(cache)) {
			const target = this.metadataCache.getFirstLinkpathDest(reference.link, file.path)?.path;
			if (target === undefined) {
				continue; // Unresolved links are not occurrences of anything.
			}
			occurrences.push({
				targetPath: asVaultPath(target),
				// Frontmatter links carry a negative sentinel offset — no body position.
				...(reference.offset < 0
					? POSITIONLESS_OCCURRENCE
					: occurrenceAt(text, reference.offset, titleOf)),
			});
		}
		return occurrences;
	}

	/**
	 * Embed-target titles for ONE scan of `sourcePath`, memoised by the link path
	 * as WRITTEN. The same embed is flattened once per snippet it falls into (the
	 * occurrence's own line plus every expanded window reaching it), and a miss
	 * costs a `getFileMetadata` — which derives the target's whole reference
	 * ordering. The map lives for the scan only, so an edited frontmatter title
	 * is never served stale.
	 */
	private embedTitleResolver(sourcePath: string): EmbedTargetTitle {
		const titles = new Map<string, string | null>();
		return (linkPath) => {
			// `get` says undefined for a MISS; a resolved-but-untitled target is null.
			const memoised = titles.get(linkPath);
			if (memoised !== undefined) {
				return memoised;
			}
			const title = this.frontmatterTitleOf(linkPath, sourcePath);
			titles.set(linkPath, title);
			return title;
		};
	}

	/** The embedded note's display title, resolved the way Obsidian resolves the link text itself. */
	private frontmatterTitleOf(linkPath: string, sourcePath: string): string | null {
		const target = this.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
		if (target === null) {
			return null;
		}
		return this.linkProvider.getFileMetadata(asVaultPath(target.path))?.frontmatterTitle ?? null;
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

/**
 * The occurrence at `offset`, with its context snippets made SAFE to render:
 * every `![[…]]` written there collapses to a marker (ticket
 * `nid_yw2m80g72pahcvtsxi09o7vkd_e`), because the drawer renders snippets
 * through Obsidian's markdown renderer, which would expand each embed into the
 * whole embedded note. Flattening happens HERE, not in the pure
 * `LinkContextSnippets` (which stays raw-text extraction) and not in the view
 * (which cannot resolve a link text against the vault).
 */
function occurrenceAt(text: string, offset: number, titleOf: EmbedTargetTitle): LinkOccurrence {
	const snippet = LinkContextSnippets.snippetAt(text, offset);
	return {
		offset,
		context: {
			...snippet,
			shortContext: MarkdownEmbeds.flattened(snippet.shortContext, titleOf),
			expandedContext: MarkdownEmbeds.flattened(snippet.expandedContext, titleOf),
		},
	};
}
