import type {
	BacklinkSourceOccurrences,
	LinkOccurrence,
	LinkOccurrenceProvider,
	OutgoingLinkOccurrence,
	VaultPath,
} from "../engine";
import type { CanvasParseCache } from "./CanvasParseCache";
import { ObsidianLinkOccurrenceProvider } from "./ObsidianLinkOccurrenceProvider";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

/**
 * Plugin-lived {@link LinkOccurrenceProvider} that answers every query against
 * the vault AS IT IS NOW: each call builds a fresh `ObsidianLinkProvider`
 * snapshot (cheap — canvas parses come from the shared mtime-keyed
 * {@link CanvasParseCache}) and delegates to {@link ObsidianLinkOccurrenceProvider}.
 * WHY per query, not per instance: a modal can open minutes after the plugin
 * loaded, and a provider snapshot from load time would list links that no
 * longer exist. Mirrors `VicinityGraphBuilder`, which snapshots per rebuild.
 */
export class LiveLinkOccurrenceProvider implements LinkOccurrenceProvider {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		private readonly canvasParseCache: CanvasParseCache,
	) {}

	async outgoingOccurrences(path: VaultPath): Promise<readonly OutgoingLinkOccurrence[]> {
		return (await this.snapshot()).outgoingOccurrences(path);
	}

	async backlinkOccurrences(path: VaultPath): Promise<readonly BacklinkSourceOccurrences[]> {
		return (await this.snapshot()).backlinkOccurrences(path);
	}

	async occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]> {
		return (await this.snapshot()).occurrencesBetween(source, target);
	}

	private async snapshot(): Promise<ObsidianLinkOccurrenceProvider> {
		const linkProvider = await ObsidianLinkProvider.create(this.vault, this.metadataCache, this.canvasParseCache);
		return new ObsidianLinkOccurrenceProvider(this.vault, this.metadataCache, linkProvider);
	}
}
