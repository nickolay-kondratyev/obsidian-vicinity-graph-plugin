import { describe, expect, it } from "vitest";
import { YoutubeHeroEmbed } from "./YoutubeHeroEmbed";

describe("YoutubeHeroEmbed.identityOfUrl", () => {
	it("WHEN the url is a youtu.be short link THEN the bare videoId and a canonical watch url come back", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
			videoId: "dQw4w9WgXcQ",
			canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		});
	});

	it("WHEN the url is a youtube.com/watch link THEN the v param is the videoId", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe(
			"dQw4w9WgXcQ",
		);
	});

	it("WHEN a watch link carries extra query params THEN only the v param decides the videoId", () => {
		expect(
			YoutubeHeroEmbed.identityOfUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc&t=42")?.videoId,
		).toBe("dQw4w9WgXcQ");
	});

	it("WHEN a youtu.be link carries a start-time query THEN the start time is dropped (scope: videoId only)", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://youtu.be/dQw4w9WgXcQ?t=42")?.canonicalUrl).toBe(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
	});

	it("WHEN the host is the mobile m.youtube.com THEN it is still recognised", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe(
			"dQw4w9WgXcQ",
		);
	});

	it("WHEN the url is a youtube.com/shorts link THEN nothing comes back (out of scope for this slice)", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBeNull();
	});

	it("WHEN the url is a youtube.com/embed link THEN nothing comes back (out of scope for this slice)", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBeNull();
	});

	it("WHEN the url is a youtube.com/live link THEN nothing comes back (out of scope for this slice)", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBeNull();
	});

	it("WHEN a watch link has no v param THEN nothing comes back", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://www.youtube.com/watch?list=abc")).toBeNull();
	});

	it("WHEN the videoId is not the canonical 11-character shape THEN nothing comes back", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://youtu.be/abc")).toBeNull();
	});

	it("WHEN the url is not a YouTube host THEN nothing comes back", () => {
		expect(YoutubeHeroEmbed.identityOfUrl("https://vimeo.com/123456789")).toBeNull();
	});
});

describe("YoutubeHeroEmbed.leadingEmbedOf", () => {
	it("WHEN the body opens with an expanded YouTube embed THEN its identity and offset are returned", () => {
		const body = "![](https://youtu.be/dQw4w9WgXcQ)\n# Heading";
		expect(YoutubeHeroEmbed.leadingEmbedOf(body)).toEqual({
			identity: {
				videoId: "dQw4w9WgXcQ",
				canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			},
			offset: 0,
		});
	});

	it("WHEN the embed sits after some prose THEN the offset locates its `!`", () => {
		const body = "intro\n\n![](https://youtu.be/dQw4w9WgXcQ)";
		expect(YoutubeHeroEmbed.leadingEmbedOf(body)?.offset).toBe(body.indexOf("!["));
	});

	it("WHEN the YouTube url is a plain link rather than an expanded embed THEN nothing comes back", () => {
		// Only `![](…)` is a hero; `[…](…)` is a plain reference the reader must click.
		expect(YoutubeHeroEmbed.leadingEmbedOf("[watch](https://youtu.be/dQw4w9WgXcQ)")).toBeNull();
	});

	it("WHEN the only YouTube embed lives inside a fenced code block THEN nothing comes back", () => {
		const body = "```\n![](https://youtu.be/dQw4w9WgXcQ)\n```";
		expect(YoutubeHeroEmbed.leadingEmbedOf(body)).toBeNull();
	});

	it("WHEN an earlier external embed is not YouTube THEN the first YouTube embed still wins", () => {
		const body = "![](https://example.com/a.png)\n![](https://youtu.be/dQw4w9WgXcQ)";
		expect(YoutubeHeroEmbed.leadingEmbedOf(body)?.identity.videoId).toBe("dQw4w9WgXcQ");
	});

	it("WHEN the body carries no YouTube embed THEN nothing comes back", () => {
		expect(YoutubeHeroEmbed.leadingEmbedOf("# Just a heading\n\nsome prose")).toBeNull();
	});
});
