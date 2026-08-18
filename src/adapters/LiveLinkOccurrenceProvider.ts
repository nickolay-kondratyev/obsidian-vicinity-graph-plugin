import type { LinkOccurrence, LinkOccurrenceProvider, VaultPath } from "../engine";
import type { CanvasParseCache } from "./CanvasParseCache";
import type { FolderNoteIndex } from "./FolderNoteIndex";
import type { FrontmatterIdIndex } from "./FrontmatterIdIndex";
import type { NamedRelationshipsIndex } from "./NamedRelationshipsIndex";
import { ObsidianLinkOccurrenceProvider } from "./ObsidianLinkOccurrenceProvider";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

/**
 * Plugin-lived {@link LinkOccurrenceProvider} that answers every query against
 * the vault AS IT IS NOW: each call builds a fresh `ObsidianLinkProvider`
 * snapshot (cheap — canvas parses come from the shared mtime-keyed
 * {@link CanvasParseCache}) and delegates to {@link ObsidianLinkOccurrenceProvider}.
 * WHY per query, not per instance: a drawer can open minutes after the plugin
 * loaded, and a provider snapshot from load time would list links that no
 * longer exist. Mirrors `VicinityGraphBuilder`, which snapshots per rebuild.
 */
export class LiveLinkOccurrenceProvider implements LinkOccurrenceProvider {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		private readonly canvasParseCache: CanvasParseCache,
		/** Shared plugin-lived index so id-ref edges appear in the occurrence drawer too. */
		private readonly frontmatterIdIndex: FrontmatterIdIndex,
		/** Shared plugin-lived folder-note index so hierarchy edges appear in the drawer too. */
		private readonly folderNoteIndex: FolderNoteIndex,
		/** Shared plugin-lived named-relationships index so labels ride drawer snapshots too. */
		private readonly namedRelations: NamedRelationshipsIndex,
	) {}

	async occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]> {
		return (await this.snapshot()).occurrencesBetween(source, target);
	}

	private async snapshot(): Promise<ObsidianLinkOccurrenceProvider> {
		const linkProvider = await ObsidianLinkProvider.create(
			this.vault,
			this.metadataCache,
			this.canvasParseCache,
			this.frontmatterIdIndex,
			this.folderNoteIndex,
			this.namedRelations,
		);
		return new ObsidianLinkOccurrenceProvider(this.vault, this.metadataCache, linkProvider);
	}
}
