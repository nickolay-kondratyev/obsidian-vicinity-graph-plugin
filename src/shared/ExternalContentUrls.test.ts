import { describe, expect, it } from "vitest";
import { EXTERNAL_CONTENT_HOSTS, ExternalContentUrls, type ExternalPreviewsGate } from "./ExternalContentUrls";

/**
 * The seam's contract, BOTH gate states. The OFF cases are the privacy guarantee stated as
 * a test: with previews off, the seam issues NO URL, so nothing downstream has a third-party
 * host to contact. (The structural half — that no OTHER module can construct one — is
 * `externalContentSeam.test.ts`.)
 */

const PREVIEWS_ON: ExternalPreviewsGate = { externalPreviews: true };
const PREVIEWS_OFF: ExternalPreviewsGate = { externalPreviews: false };

// A well-formed 11-char YouTube id (Rick Astley — the canonical test id).
const VIDEO_ID = "dQw4w9WgXcQ";

describe("ExternalContentUrls: YouTube poster URL", () => {
	it("WHEN previews are ON THEN it issues the poster URL on the owned thumbnail host", () => {
		expect(ExternalContentUrls.youTubePosterUrl(VIDEO_ID, PREVIEWS_ON)).toBe(
			`https://${EXTERNAL_CONTENT_HOSTS.youTubeThumbnail}/vi/${VIDEO_ID}/hqdefault.jpg`,
		);
	});

	it("WHEN previews are OFF THEN it refuses (no URL issued)", () => {
		expect(ExternalContentUrls.youTubePosterUrl(VIDEO_ID, PREVIEWS_OFF)).toBeNull();
	});
});

describe("ExternalContentUrls: YouTube embed URL", () => {
	it("WHEN previews are ON THEN it issues the embed URL on the privacy-enhanced host", () => {
		expect(ExternalContentUrls.youTubeEmbedUrl(VIDEO_ID, PREVIEWS_ON)).toBe(
			`https://${EXTERNAL_CONTENT_HOSTS.youTubePrivacyEmbed}/embed/${VIDEO_ID}`,
		);
	});

	it("WHEN previews are OFF THEN it refuses (no URL issued)", () => {
		expect(ExternalContentUrls.youTubeEmbedUrl(VIDEO_ID, PREVIEWS_OFF)).toBeNull();
	});
});

describe("ExternalContentUrls: id validation", () => {
	// An ill-formed id must never reach the URL — it could otherwise inject path/query
	// segments into a request that DOES leave the machine.
	for (const malformed of ["", "short", "way-too-long-to-be-real", "has spaces", "bad/slash", "over../dots"]) {
		it(`WHEN the id is ill-formed (id=[${malformed}]) THEN the poster URL is refused even with previews ON`, () => {
			expect(ExternalContentUrls.youTubePosterUrl(malformed, PREVIEWS_ON)).toBeNull();
		});

		it(`WHEN the id is ill-formed (id=[${malformed}]) THEN the embed URL is refused even with previews ON`, () => {
			expect(ExternalContentUrls.youTubeEmbedUrl(malformed, PREVIEWS_ON)).toBeNull();
		});
	}
});
