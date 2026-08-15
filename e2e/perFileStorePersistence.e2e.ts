import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * The per-file store's two boot-and-vault-lifecycle claims that the unit suite can
 * only reach through fakes — asserted here against a REAL Obsidian reading and
 * writing real vault files under `.plugin_data/vicinity_graph/per_file/`
 * (ticket `nid_8f8ey41extajt08zphwwxhnwq_e`, which moved node overrides + local pins
 * off `data.json` onto that vault-synced store):
 *
 * 1. DELETE prunes across files — deleting a doc drops its OWN per-file record AND
 *    prunes it as a local-pin TARGET under every other main, through the live
 *    `vault.on('delete')` handler (main.ts wiring the unit suite cannot exercise).
 * 2. A merge-conflicted per-file record is QUARANTINED on boot — the whole reason a
 *    pin is config in `data.json` but overrides are vault content is that vault
 *    content syncs and CAN conflict; this proves the plugin boots through one, reads
 *    that doc as defaults, and sets the bad bytes aside (never deletes them).
 *
 * Fixtures are e2e-only, ROOT-level and SPARSE (see the sibling restart/scenario
 * specs for the WHY: `fitView` then keeps nodes clear of the controls panel).
 */

test.describe.configure({ mode: "serial" });

// --- (1) delete prunes across per-file records --------------------------------

const DELETE_FIXTURES: Record<string, string> = {
	"pf_main.md": "---\nid: docid_pfmain_e\n---\nDelete-prune MAIN — links out to [[pf_target]].\n",
	"pf_target.md": "---\nid: docid_pftarget_e\n---\nOverridden AND locally pinned; then deleted.\n",
};
const PF_MAIN = "pf_main.md";
const PF_TARGET = "pf_target.md";
const PF_MAIN_DOCID = "docid_pfmain_e";
const PF_TARGET_DOCID = "docid_pftarget_e";
const OVERRIDE_PX = { widthPx: 333, heightPx: 199 };

test.describe("per-file store: deleting a doc prunes its records", () => {
	let harness: ObsidianHarness;
	let page: Page;

	test.beforeAll(async () => {
		harness = await ObsidianHarness.launch({ extraFixtures: DELETE_FIXTURES });
		page = harness.page;
		await harness.openFile(PF_MAIN);
		await harness.openGraphView();
	});

	test.afterAll(async () => {
		await harness?.close();
	});

	function noteNode(path: string): Locator {
		return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
	}

	test("deleting a doc drops its override AND prunes it as another main's local-pin target", async () => {
		// GIVEN the graph built with pf_main active, so pf_target is visited and its path
		// learns its docid — the live delete handler resolves the docid through that map.
		await harness.remountGraphView();
		await expect(noteNode(PF_MAIN)).toHaveAttribute("data-tier", "main");
		await expect(noteNode(PF_TARGET)).toHaveCount(1);

		// GIVEN pf_target carries a subject override AND is locally pinned under pf_main
		// (so it occupies BOTH a per-file record of its own and a TARGET slot in pf_main's).
		await harness.saveNodeSizeOverride(PF_TARGET_DOCID, OVERRIDE_PX);
		await harness.saveLocalPin(PF_MAIN_DOCID, PF_TARGET_DOCID);
		expect((await harness.readNodeOverrides())[PF_TARGET_DOCID]).toEqual({ sizePx: OVERRIDE_PX });
		expect((await harness.readLocalPins(PF_MAIN_DOCID)).map((pin) => pin.docid)).toEqual([PF_TARGET_DOCID]);
		expect(harness.listPerFileStoreFilenames()).toContain(`${PF_TARGET_DOCID}.json`);

		// WHEN pf_target is deleted through Obsidian → the live handler forgets it in BOTH
		// positions. The handler is fire-and-forget, so poll the store settling.
		await harness.deleteNote(PF_TARGET);

		// THEN its own override record is gone…
		await expect.poll(async () => (await harness.readNodeOverrides())[PF_TARGET_DOCID]).toBeUndefined();
		// …its file is removed from disk (polled: the cache clears BEFORE the chained
		// disk remove completes, so the override poll above does not cover the bytes)…
		await expect.poll(() => harness.listPerFileStoreFilenames()).not.toContain(`${PF_TARGET_DOCID}.json`);
		// …and it no longer sits as a local-pin target under the surviving main (polled:
		// the main's prune is a LATER step of the same fire-and-forget forgetDocs).
		await expect.poll(async () => harness.readLocalPins(PF_MAIN_DOCID)).toEqual([]);
	});
});

// --- (2) a conflict-markered record is quarantined on boot --------------------

const CONFLICT_DOCID = "docid_cfhub_e";
/**
 * A git/sync merge-conflict left in the doc's per-file record: NOT valid JSON, so
 * the store quarantines the whole file on read (field-level degrade cannot apply to
 * bytes that do not parse). Seeded directly at the store's on-disk path via the
 * launch fixture writer — the exact artefact a two-device sync produces.
 */
const CONFLICTED_RECORD = [
	"<<<<<<< HEAD",
	'{ "v1": { "override": { "sizePx": { "widthPx": 200, "heightPx": 100 } } } }',
	"=======",
	'{ "v1": { "override": { "sizePx": { "widthPx": 400, "heightPx": 300 } } } }',
	">>>>>>> other",
	"",
].join("\n");
const CONFLICT_FIXTURES: Record<string, string> = {
	"cf_hub.md": `---\nid: ${CONFLICT_DOCID}\n---\nConflict-quarantine MAIN — a lone note.\n`,
	[`.plugin_data/vicinity_graph/per_file/${CONFLICT_DOCID}.json`]: CONFLICTED_RECORD,
};
const CF_HUB = "cf_hub.md";

test.describe("per-file store: a conflict-markered record is quarantined on boot", () => {
	let harness: ObsidianHarness;
	let page: Page;

	test.beforeAll(async () => {
		harness = await ObsidianHarness.launch({ extraFixtures: CONFLICT_FIXTURES });
		page = harness.page;
		await harness.openFile(CF_HUB);
		await harness.openGraphView();
	});

	test.afterAll(async () => {
		await harness?.close();
	});

	function noteNode(path: string): Locator {
		return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
	}

	test("the plugin boots, the doc reads as defaults, and the bad file is set aside not deleted", async () => {
		// THEN the plugin boots and renders normally — a conflicted record is not a crash.
		await harness.remountGraphView();
		await expect(noteNode(CF_HUB)).toHaveAttribute("data-tier", "main");

		// THEN that doc's override reads as ABSENT (the conflicted bytes never became an override).
		expect((await harness.readNodeOverrides())[CONFLICT_DOCID]).toBeUndefined();

		// THEN the bad bytes were QUARANTINED, not obeyed and not deleted: the original file
		// is gone from its key and a `_malformed_` sibling holds the user's bytes for recovery.
		// Polled: the quarantine rename lands inside the warm the first build awaited, but the
		// disk peek is out-of-band of that await, so give it room to settle.
		await expect
			.poll(() => harness.listPerFileStoreFilenames().some((name) => /^docid_cfhub_e_malformed_.*\.json$/.test(name)))
			.toBe(true);
		expect(harness.listPerFileStoreFilenames()).not.toContain(`${CONFLICT_DOCID}.json`);
	});
});
