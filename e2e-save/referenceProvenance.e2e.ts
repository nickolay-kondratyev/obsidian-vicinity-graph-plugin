import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";

/**
 * MEASURES the assumption `src/adapters/ReferenceOrder.ts` rests on: that real
 * Obsidian core routes exactly the `!`-prefixed references into
 * `cache.embeds`, the plain ones into `cache.links`, and frontmatter property
 * links into `cache.frontmatterLinks`. LinkKind comes ENTIRELY from that array
 * provenance — no unit test can falsify it, because a fixture author decides
 * both the arrays and the expectation (one such circular test was written and
 * deleted during ticket `nid_fay1hu5sxcoygizopkkg0f0d7_e`). This spec is the
 * honest tripwire: the arrays are read from a real `metadataCache`.
 *
 * It ALSO measures whether `Reference.original` is populated on desktop — the
 * API docs flag it "Not available on Publish", and the provenance-vs-prefix
 * cross-check below is exactly the consumer that would care.
 *
 * Own `extraFixtures` under `ref-provenance/`, plugin rendering not involved —
 * same isolation rationale as `canvasMarkdownLinkIndexing.e2e.ts`.
 */

test.describe.configure({ mode: "serial" });

const FIXTURE_FOLDER = "ref-provenance";
const NOTE_PATH = `${FIXTURE_FOLDER}/note.md`;

const WIKILINK_TARGET = "wiki-target";
const EMBED_TARGET = "embed-target";
const MD_LINK_DESTINATION = "md-target.md";
const IMAGE_EMBED_DESTINATION = "image-target.png";
const FRONTMATTER_TARGET = "prop-target";

/** Markdown indexing is part of boot, but not synchronous with layoutReady. */
const CACHE_INDEX_TIMEOUT_MS = 20_000;

/**
 * One note carrying every reference shape LinkKind decides about: plain
 * wikilink, `!` wikilink embed, markdown-style link, markdown-style image
 * embed, and a frontmatter property link.
 */
const NOTE_CONTENT = [
	"---",
	`prop: "[[${FRONTMATTER_TARGET}]]"`,
	"---",
	"",
	`wikilink [[${WIKILINK_TARGET}]] and embed ![[${EMBED_TARGET}]]`,
	"",
	`markdown link [md](${MD_LINK_DESTINATION}) and image embed ![img](${IMAGE_EMBED_DESTINATION})`,
	"",
].join("\n");

/**
 * Every destination exists in the vault, so nothing below can be dismissed as
 * an unresolved-reference special case. (Provenance routing happens at PARSE
 * time, before resolution — but the fixture should not rely on that.)
 */
const EXTRA_FIXTURES: Record<string, string> = {
	[NOTE_PATH]: NOTE_CONTENT,
	[`${FIXTURE_FOLDER}/${WIKILINK_TARGET}.md`]: "Target of the plain wikilink.\n",
	[`${FIXTURE_FOLDER}/${EMBED_TARGET}.md`]: "Target of the wikilink embed.\n",
	[`${FIXTURE_FOLDER}/${MD_LINK_DESTINATION}`]: "Target of the markdown-style link.\n",
	// Not a decodable PNG, but a real vault file the destination resolves to.
	[`${FIXTURE_FOLDER}/${IMAGE_EMBED_DESTINATION}`]: "png-stand-in",
	[`${FIXTURE_FOLDER}/${FRONTMATTER_TARGET}.md`]: "Target of the frontmatter property link.\n",
};

/** The slice of a cached Reference this spec asserts on, serialized out of the page. */
interface ObservedReference {
	readonly link: string;
	readonly original: string | undefined;
}

interface ObservedCacheArrays {
	readonly links: readonly ObservedReference[];
	readonly embeds: readonly ObservedReference[];
	readonly frontmatterLinks: readonly ObservedReference[];
}

let harness: ObsidianHarness;
let page: Page;
let observed: ObservedCacheArrays;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: EXTRA_FIXTURES });
	page = harness.page;
	await page.waitForFunction(
		(notePath) => {
			const app = (window as unknown as { app: E2eObsidianApp }).app;
			const file = app.vault.getAbstractFileByPath(notePath);
			return file !== null && app.metadataCache.getFileCache(file)?.links !== undefined;
		},
		NOTE_PATH,
		{ timeout: CACHE_INDEX_TIMEOUT_MS },
	);
	observed = await page.evaluate((notePath) => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const file = app.vault.getAbstractFileByPath(notePath);
		if (file === null) throw new Error(`fixture note not in vault: ${notePath}`);
		const cache = app.metadataCache.getFileCache(file);
		if (cache === null) throw new Error(`no file cache for: ${notePath}`);
		const slim = (refs: readonly { link: string; original?: string }[] | undefined): ObservedReference[] =>
			(refs ?? []).map((ref) => ({ link: ref.link, original: ref.original }));
		return {
			links: slim(cache.links),
			embeds: slim(cache.embeds),
			frontmatterLinks: slim(cache.frontmatterLinks),
		};
	}, NOTE_PATH);
	// Printed so a future reader sees the raw observation, not just the verdict.
	console.log(`[observed] getFileCache(${NOTE_PATH})=${JSON.stringify(observed)}`);
});

test.afterAll(async () => {
	await harness?.close();
});

test("core routes the plain wikilink and the markdown-style link into cache.links, and nothing else", async () => {
	expect(observed.links.map((ref) => ref.link).sort()).toEqual([MD_LINK_DESTINATION, WIKILINK_TARGET].sort());
});

test("core routes the wikilink embed and the image embed into cache.embeds, and nothing else", async () => {
	expect(observed.embeds.map((ref) => ref.link).sort()).toEqual([EMBED_TARGET, IMAGE_EMBED_DESTINATION].sort());
});

test("core routes the frontmatter property link into cache.frontmatterLinks only", async () => {
	expect(observed.frontmatterLinks.map((ref) => ref.link)).toEqual([FRONTMATTER_TARGET]);
});

/**
 * The cross-check the ticket asks for: array provenance vs the `!` prefix of
 * `Reference.original`, on EVERY body reference. This doubles as the desktop
 * measurement of `original` itself — an `undefined` original fails the
 * `startsWith` and shows up verbatim in the printed observation above.
 */
test("every body reference's array provenance agrees with its Reference.original '!' prefix", async () => {
	const disagreements = [
		...observed.links.filter((ref) => ref.original?.startsWith("!") !== false),
		...observed.embeds.filter((ref) => ref.original?.startsWith("!") !== true),
	];
	expect(disagreements).toEqual([]);
});
