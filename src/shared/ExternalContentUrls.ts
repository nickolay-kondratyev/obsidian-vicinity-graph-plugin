/**
 * ExternalContentUrls — THE one seam through which every external-content host URL is
 * constructed (ticket `nid_tvtm9gj5zaj4tbfbpti3v6sy2_e`).
 *
 * WHY a single seam: the master external-previews setting
 * ({@link ExternalPreviewsGate.externalPreviews}) promises that OFF means the plugin
 * contacts NO third-party server. A promise kept per-feature erodes the first time a new
 * thumbnail/favicon/oEmbed caller forgets it. So instead every external URL is issued from
 * HERE, gated on the setting, and a source-scan tripwire
 * (`externalContentSeam.test.ts`) fails the build if any module outside this seam names an
 * external host literal, `fetch(`, or `requestUrl(`. That is what turns "OFF means zero
 * network" from a convention into an invariant that holds as the feature grows.
 *
 * PURE and leaf: no `obsidian` / `react` imports, and it does NOT depend on the engine's
 * `ViewSettings` — it declares its own narrow {@link ExternalPreviewsGate} so the
 * shared→engine cycle never forms. A `ViewSettings` satisfies the gate structurally, so
 * callers pass the settings object straight in.
 *
 * URL construction only. Actual network I/O (`requestUrl`/`fetch`) is a FUTURE resident:
 * when a thumbnail/favicon fetch arrives it lands as one adapter class wrapping
 * `requestUrl` behind an engine-defined port (DIP, like `LinkProvider`), added to the
 * tripwire's sanctioned list — never sprinkled across callers.
 */

/**
 * The gate every external-content URL is subject to: the ONE master external-previews
 * setting. A narrow structural interface (not the engine's `ViewSettings`) so this leaf
 * module stays free of an engine dependency; `ViewSettings` satisfies it as-is.
 */
export interface ExternalPreviewsGate {
	readonly externalPreviews: boolean;
}

/**
 * The external hosts this seam owns. Declared as data so the tripwire can assert these
 * literals appear in NO other module — importing the constant is fine, re-typing the
 * literal is the leak it catches.
 */
export const EXTERNAL_CONTENT_HOSTS = {
	/** YouTube's thumbnail/poster CDN. */
	youTubeThumbnail: "i.ytimg.com",
	/** YouTube's privacy-enhanced (no-cookie) embed host. */
	youTubePrivacyEmbed: "www.youtube-nocookie.com",
} as const;

/**
 * A YouTube video id is exactly 11 characters of the URL-safe base64 alphabet. Validating
 * before interpolation keeps an ill-formed id from injecting path/query segments into the
 * issued URL — a refusal (null), never a malformed request.
 */
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export class ExternalContentUrls {
	/**
	 * The poster image for a YouTube video, or `null` when previews are OFF or the id is
	 * ill-formed. `hqdefault` exists for every video (unlike `maxresdefault`), so it never
	 * 404s to a broken image.
	 */
	static youTubePosterUrl(videoId: string, gate: ExternalPreviewsGate): string | null {
		return ExternalContentUrls.gatedVideoUrl(
			videoId,
			gate,
			(id) => `https://${EXTERNAL_CONTENT_HOSTS.youTubeThumbnail}/vi/${id}/hqdefault.jpg`,
		);
	}

	/**
	 * The privacy-enhanced embed URL for a YouTube video, or `null` when previews are OFF or
	 * the id is ill-formed. `youtube-nocookie.com` sets no tracking cookie until the viewer
	 * plays the video.
	 */
	static youTubeEmbedUrl(videoId: string, gate: ExternalPreviewsGate): string | null {
		return ExternalContentUrls.gatedVideoUrl(
			videoId,
			gate,
			(id) => `https://${EXTERNAL_CONTENT_HOSTS.youTubePrivacyEmbed}/embed/${id}`,
		);
	}

	/**
	 * The ONE place the OFF guarantee and the id check live: refuse (null) unless previews
	 * are ON and the id is well-formed, then build. Every YouTube URL routes through here,
	 * so the gate can never be issued around.
	 */
	private static gatedVideoUrl(
		videoId: string,
		gate: ExternalPreviewsGate,
		build: (validVideoId: string) => string,
	): string | null {
		if (!gate.externalPreviews) {
			return null;
		}
		if (!YOUTUBE_VIDEO_ID.test(videoId)) {
			return null;
		}
		return build(videoId);
	}
}
