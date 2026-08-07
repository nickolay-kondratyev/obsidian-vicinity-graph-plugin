import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Ticket `nid_15r71ajjkbel5s704kmj6wszw_e`: render the note's leading YouTube hero
 * INSIDE its graph node as a click-to-play FACADE, gated on the master
 * external-previews setting. Rendered-node behaviour is unreachable by the
 * `npm test` jsdom scans (the settings tab and the RF node only mount in a real
 * Obsidian), so the ON/OFF contract is pinned here, against a real Obsidian.
 *
 * ON (the shipped default) — the video wins the node's preview slot:
 *  1. the node reads `data-preview="video"`;
 *  2. a cookieless poster `<img>` is present with the expected `i.ytimg.com/vi/<id>`
 *     src (derived purely from the parsed videoId — no oEmbed, no player JS);
 *  3. clicking the play affordance swaps in the `www.youtube-nocookie.com/embed/<id>`
 *     iframe (the real player, at most one or two ever alive).
 *
 * OFF (GOAL-1 guarantee — "external-previews OFF means zero network"):
 *  - NO `i.ytimg.com` poster request, NO `youtube-nocookie` iframe, and the node
 *    falls back to its ordinary thumbnail/outline hero exactly as if it carried no
 *    video. This is a REQUIRED behavioral cover and complements (does not replace)
 *    the build-time source-scan tripwire (`externalContentSeam.test.ts`).
 *
 * We assert the DOM, never real playback/network (network-dependent ⇒ flaky): the
 * poster/iframe SRC attributes are present regardless of whether the bytes load.
 *
 * SERIAL: the OFF case toggles the shared store after the ON case.
 */

test.describe.configure({ mode: "serial" });

/** The leading embed is the FIRST thing in the body, ahead of the heading — so it leads. */
const VIDEO_ID = "dQw4w9WgXcQ";
const SCENARIO_FIXTURES: Record<string, string> = {
	"yt_hero.md": `![](https://www.youtube.com/watch?v=${VIDEO_ID})\n\n# Heading\n\nLinks to [[yt_other]].\n`,
	"yt_other.md": "A neighbour so the hero note is not alone in the graph.\n",
};

const HERO = "yt_hero.md";
/** Owned-host substrings the OFF path must NOT contact — derived from the parsed id. */
const POSTER_SRC_FRAGMENT = `i.ytimg.com/vi/${VIDEO_ID}`;
const EMBED_SRC_FRAGMENT = `youtube-nocookie.com/embed/${VIDEO_ID}`;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: SCENARIO_FIXTURES });
	page = harness.page;
	// Ship-default ON, seeded explicitly so this file starts from a known gate.
	await harness.saveGlobalView({ externalPreviews: true });
	await harness.openFile(HERO);
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

function heroNode(): Locator {
	return page.locator(`.vicinity-graph-node[data-path="${HERO}"]`);
}

async function heroPreview(): Promise<string | null> {
	return heroNode().getAttribute("data-preview");
}

test("WHEN external previews are ON THEN the hero note's node renders the video preview facade", async () => {
	await expect(heroNode()).toHaveAttribute("data-tier", "main");
	await expect.poll(heroPreview).toBe("video");

	// The cookieless poster is present with the id-derived src; no real player yet.
	const poster = heroNode().locator(".vicinity-graph-node__video-poster");
	await expect(poster).toHaveAttribute("src", new RegExp(POSTER_SRC_FRAGMENT.replace(/[.]/g, "\\.")));
	await expect(heroNode().locator(".vicinity-graph-node__video-frame")).toHaveCount(0);
});

test("WHEN the play affordance is clicked THEN the node swaps the poster for the no-cookie embed iframe", async () => {
	// The node can drift under a trailing fitView between actionability checks (see
	// nodeContentOverride.e2e.ts) — re-attempt the click until it lands once.
	await expect(async () => {
		await heroNode().locator(".vicinity-graph-node__video-play").click({ timeout: 2_000 });
		await expect(heroNode().locator(".vicinity-graph-node__video-frame")).toHaveCount(1);
	}).toPass();

	await expect(heroNode().locator(".vicinity-graph-node__video-frame")).toHaveAttribute(
		"src",
		new RegExp(EMBED_SRC_FRAGMENT.replace(/[.]/g, "\\.")),
	);
	// The poster is gone once the real player mounts.
	await expect(heroNode().locator(".vicinity-graph-node__video-poster")).toHaveCount(0);
});

test("WHEN external previews are switched OFF THEN no poster/iframe is contacted and the node falls back to its ordinary hero", async () => {
	await harness.saveGlobalView({ externalPreviews: false });
	await harness.refreshOpenViews();

	// The video is no longer the hero — it falls through to the ordinary ladder.
	await expect.poll(heroPreview).not.toBe("video");

	// GOAL-1: zero network. No owned-host element exists ANYWHERE in the rendered graph.
	await expect(page.locator(`img[src*="${POSTER_SRC_FRAGMENT}"]`)).toHaveCount(0);
	await expect(page.locator(`iframe[src*="${EMBED_SRC_FRAGMENT}"]`)).toHaveCount(0);
	await expect(heroNode().locator(".vicinity-graph-node__video")).toHaveCount(0);
});

test("WHEN external previews are switched back ON THEN the video hero facade returns", async () => {
	await harness.saveGlobalView({ externalPreviews: true });
	await harness.refreshOpenViews();

	await expect.poll(heroPreview).toBe("video");
	await expect(heroNode().locator(".vicinity-graph-node__video-poster")).toHaveAttribute(
		"src",
		new RegExp(POSTER_SRC_FRAGMENT.replace(/[.]/g, "\\.")),
	);
});
