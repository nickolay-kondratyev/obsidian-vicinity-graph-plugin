import type { LeadingYoutubeEmbed } from "../shared/YoutubeHeroEmbed";
import { YoutubeHeroEmbed } from "../shared/YoutubeHeroEmbed";
import type { VaultFilePort, VaultPort } from "./obsidianPorts";

interface CachedParse {
	readonly mtime: number;
	/** The note's leading YouTube embed (identity + `!` offset), or `null` when it has none. */
	readonly leadingEmbed: LeadingYoutubeEmbed | null;
}

/**
 * A cheap substring gate before the real parse: a body with no `youtu` anywhere
 * cannot contain a `youtu.be` / `youtube.com` embed, so the (offset-preserving)
 * code-masking + external-embed scan is skipped for the overwhelming majority of
 * notes that carry no YouTube link at all.
 */
const YOUTUBE_HINT = "youtu";

/**
 * Mtime-keyed cache around {@link YoutubeHeroEmbed.leadingEmbedOf} — the exact
 * shape of {@link import("./CanvasParseCache").CanvasParseCache}, and for the same
 * reason: the leading-video FACT needs the note BODY (Obsidian's metadata cache
 * discards external `![](url)` embeds), which is an ASYNC read, but the
 * {@link import("./ObsidianLinkProvider").ObsidianLinkProvider} answers queries
 * synchronously. So the body is read (and parsed) once, up front, and re-read
 * only when a note's mtime changes. Plugin-owned and long-lived — provider builds
 * come and go, the cache persists across them.
 *
 * Caches PARSING (read + youtube scan), never the RESOLUTION into "is this the
 * hero": the positional verdict (does the embed precede the first heading AND the
 * first image) depends on heading offsets and OTHER files' image resolution, so
 * it stays with the caller and runs fresh, exactly as canvas resolution does.
 */
export class LeadingVideoCache {
	private readonly parsesByPath = new Map<string, CachedParse>();

	/** The note's leading YouTube embed, or `null` when it has none. Mtime-cached. */
	async leadingEmbedOf(vault: VaultPort, file: VaultFilePort): Promise<LeadingYoutubeEmbed | null> {
		const cached = this.parsesByPath.get(file.path);
		if (cached !== undefined && cached.mtime === file.stat.mtime) {
			return cached.leadingEmbed;
		}
		const body = await vault.cachedRead(file);
		const leadingEmbed = body.includes(YOUTUBE_HINT) ? YoutubeHeroEmbed.leadingEmbedOf(body) : null;
		this.parsesByPath.set(file.path, { mtime: file.stat.mtime, leadingEmbed });
		return leadingEmbed;
	}

	/** Keep the cache honest across note deletes/renames (old path never revives). */
	evict(path: string): void {
		this.parsesByPath.delete(path);
	}
}
