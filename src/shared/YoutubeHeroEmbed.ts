/**
 * Recognises the ONE thing this slice cares about: a YouTube video declared as a
 * LEADING expanded embed (`![](<youtube-url>)`) in a note body, normalised to a
 * bare videoId + canonical URL for downstream data-model / rendering.
 *
 * Pure string work — NO network, NO fetch (the whole point, ticket
 * `nid_k7i845kkf64tb75bs854a29m9_e`): the videoId is read out of the written URL,
 * and the renderer later derives the poster/embed URLs from it. Lives in
 * `src/shared/` next to {@link MarkdownInlineLinks}, covered by the same import
 * guard, because the engine never sees markdown text — the adapter calls this
 * while building `FileMetadata` and reports a plain "leading video" fact upward.
 *
 * SCOPE (this slice): `youtu.be/<id>` and `youtube.com/watch?v=<id>` only, with
 * arbitrary extra query params tolerated. DELIBERATELY OUT: `/shorts/`,
 * `/embed/`, `/live/` and playlist-only URLs — later slices under the same
 * external-previews master setting. A start-time (`t`/`start`) is DROPPED, not
 * preserved: the identity is videoId + canonical watch URL, nothing more.
 *
 * "LEADING" here means only "the FIRST YouTube expanded embed in the body, and
 * WHERE it is" ({@link leadingEmbedOf} returns the offset). Whether that offset
 * actually precedes the first heading and the first image is a POSITIONAL verdict
 * the adapter owns — it already holds the heading offset and the first-image
 * position behind `imagePrecedesOutline` — so it is not re-derived here.
 */

import type { ExternalEmbed } from "./MarkdownInlineLinks";
import { MarkdownInlineLinks } from "./MarkdownInlineLinks";
import { MarkdownCodeRegions } from "./MarkdownCodeRegions";

/** A YouTube video's normalised identity — everything downstream rendering needs. */
export interface YoutubeVideoIdentity {
	/** The bare 11-character video id (`dQw4w9WgXcQ`). */
	readonly videoId: string;
	/** A canonical watch URL built from the videoId — stable regardless of the written form. */
	readonly canonicalUrl: string;
}

/** The leading YouTube embed found in a body: its identity plus the offset of its `!`. */
export interface LeadingYoutubeEmbed {
	readonly identity: YoutubeVideoIdentity;
	readonly offset: number;
}

/**
 * A canonical YouTube video id: exactly 11 characters of the base64url alphabet.
 * The shape has been stable for YouTube's entire history; requiring it rejects
 * truncated or garbage path segments (`youtu.be/abc`) that would otherwise mint a
 * bogus identity.
 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Watch-URL hosts (after a leading `www.` is stripped) that carry the id in `?v=`. */
const WATCH_HOSTS: ReadonlySet<string> = new Set(["youtube.com", "m.youtube.com"]);

/** The short-link host that carries the id as its first path segment. */
const SHORT_HOST = "youtu.be";

/** The one path a watch URL uses; `/shorts`, `/embed`, `/live`, `/playlist` are out of scope. */
const WATCH_PATH = "/watch";

/** The `?v=` param name on a watch URL. */
const WATCH_VIDEO_PARAM = "v";

const CANONICAL_WATCH_PREFIX = "https://www.youtube.com/watch?v=";

export class YoutubeHeroEmbed {
	/**
	 * The normalised identity of a single YouTube URL, or `null` when the string is
	 * not an in-scope YouTube video URL. Query params other than a watch `v` are
	 * ignored, so a start-time or playlist tag never blocks recognition.
	 */
	static identityOfUrl(url: string): YoutubeVideoIdentity | null {
		const videoId = YoutubeHeroEmbed.videoIdOf(url);
		if (videoId === null || !VIDEO_ID_PATTERN.test(videoId)) {
			return null;
		}
		return { videoId, canonicalUrl: `${CANONICAL_WATCH_PREFIX}${videoId}` };
	}

	/**
	 * The FIRST expanded YouTube embed in `body` with the offset of its `!`, or
	 * `null` when there is none. Code regions are masked first (offsets preserved),
	 * so a `![](…)` shown as sample text inside a fence never counts. An earlier
	 * NON-YouTube external embed does not disqualify a later YouTube one — whether
	 * such an embed is an image that should preempt the hero is the adapter's
	 * positional call, against LOCAL images, for this slice.
	 */
	static leadingEmbedOf(body: string): LeadingYoutubeEmbed | null {
		const prose = MarkdownCodeRegions.withCodeMasked(body);
		for (const embed of MarkdownInlineLinks.externalEmbedsOf(prose)) {
			const identity = YoutubeHeroEmbed.identityOfUrl(embed.url);
			if (identity !== null) {
				return { identity, offset: embed.offset };
			}
		}
		return null;
	}

	private static videoIdOf(url: string): string | null {
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			return null; // Not a parseable absolute URL — nothing to recognise.
		}
		const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
		if (host === SHORT_HOST) {
			return YoutubeHeroEmbed.firstPathSegmentOf(parsed.pathname);
		}
		if (WATCH_HOSTS.has(host) && parsed.pathname === WATCH_PATH) {
			return parsed.searchParams.get(WATCH_VIDEO_PARAM);
		}
		return null;
	}

	/** The first non-empty path segment (`/dQw4w9WgXcQ` → `dQw4w9WgXcQ`), or `null`. */
	private static firstPathSegmentOf(pathname: string): string | null {
		return pathname.split("/").find((segment) => segment.length > 0) ?? null;
	}
}
