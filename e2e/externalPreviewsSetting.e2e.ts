import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import { ObsidianHarness } from "./obsidianHarness";
import { SettingsTabPage } from "./settingsTabPage";
import { settingsRowsFor } from "../src/view/settingsRows";

/**
 * Ticket `nid_21xio7iwxv742ze4qc4p4qbmq_e`: the ONE master switch for external-content
 * previews. The settings TAB has no `npm test` coverage at all (`obsidian` is types-only,
 * so the tab cannot mount under jsdom — see CLAUDE.md), so its behaviour is proven here,
 * against a real Obsidian, exactly as the ticket asks.
 *
 * What this spec pins is everything the toggle promises:
 *  1. It ships ON — the feature works out of the box.
 *  2. Flipping it PERSISTS (`data.json`, read back through the live store), not just
 *     repaints, in BOTH directions.
 *  3. The honest-disclosure copy reaches the screen — the whole reason the toggle exists:
 *     a user must be told external content is loaded and how to stop it BEFORE consenting.
 *     Asserted against the DECLARED row copy (`settingsRows.ts`), never a re-typed string.
 *
 * No debounce window is involved (a toggle is an AIMED control — the tab writes on change,
 * not on a settle timer like a typed field), so persistence is a web-first poll, never a
 * sleep — matching `settingsDependentRows.e2e.ts`.
 *
 * Screenshots → `.out/external-previews-setting/` (never source-controlled).
 */

test.describe.configure({ mode: "serial" });

const OUT_DIR = ".out/external-previews-setting";

/** The declared row — its label IS the toggle's accessible name, its description IS the disclosure. */
const EXTERNAL_PREVIEWS_ROW = (() => {
	const [row, ...rest] = settingsRowsFor("external-previews");
	if (row === undefined || rest.length > 0) {
		throw new Error(`expected exactly one declared "external-previews" row, found ${rest.length + (row ? 1 : 0)}`);
	}
	if (row.description === undefined) {
		throw new Error("the external-previews row must carry the third-party disclosure as its description");
	}
	return row;
})();

/** The toggle's accessible name (the declared row label) and its disclosure copy. */
const TOGGLE_LABEL = EXTERNAL_PREVIEWS_ROW.label;
const DISCLOSURE: string = EXTERNAL_PREVIEWS_ROW.description ?? "";

let harness: ObsidianHarness;
let page: Page;
let settingsTab: SettingsTabPage;

test.beforeAll(async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	harness = await ObsidianHarness.launch();
	page = harness.page;
	settingsTab = new SettingsTabPage(page);
});

test.afterAll(async () => {
	await harness?.close();
});

/**
 * Obsidian's toggle is a hidden checkbox inside `.checkbox-container`. Clicked
 * PROGRAMMATICALLY: a real pointer click would move focus, which is irrelevant here but
 * keeps this identical to the sibling spec's proven interaction.
 */
async function flipToggleIn(card: Locator): Promise<void> {
	await card.locator(".checkbox-container input").evaluate((el) => (el as HTMLInputElement).click());
}

/** The flip must reach the STORE, not merely paint its row (the write lands after an await). */
async function expectExternalPreviewsPersisted(enabled: boolean): Promise<void> {
	await expect
		.poll(async () => (await harness.readGlobals()).view.externalPreviews, {
			message: "the external-previews toggle must persist, not just repaint its row",
		})
		.toBe(enabled);
}

test("settings tab: WHEN the tab is opened THEN external previews ship ON and the third-party disclosure is shown", async () => {
	// Seed the shipped default explicitly, so this asserts the DEFAULT rather than whatever
	// a prior test left — the store is shared across this serial file.
	await harness.saveGlobalView({ externalPreviews: true });
	await settingsTab.open();
	await settingsTab.redisplay();

	const card = settingsTab.card("External content");
	await expect(card.locator(".checkbox-container")).toHaveClass(/is-enabled/);

	// The disclosure is the point of the toggle: it must be on screen, verbatim from the
	// declared row copy, so a user reads "external content is loaded / how to stop it".
	// Scoped to the toggle's OWN row — the card also holds the (empty) heading description
	// and the scoped restore row's description.
	await expect(settingsTab.rowHolding(TOGGLE_LABEL).locator(".setting-item-description")).toContainText(DISCLOSURE);

	await page.screenshot({ path: `${OUT_DIR}/01-on-by-default-with-disclosure.png` });
});

test("settings tab: WHEN external previews is switched off THEN the change persists (all external requests stop)", async () => {
	await harness.saveGlobalView({ externalPreviews: true });
	await settingsTab.open();
	await settingsTab.redisplay();

	const card = settingsTab.card("External content");
	await expect(card.locator(".checkbox-container")).toHaveClass(/is-enabled/);

	await flipToggleIn(card);

	await expect(card.locator(".checkbox-container")).not.toHaveClass(/is-enabled/);
	await expectExternalPreviewsPersisted(false);
	await page.screenshot({ path: `${OUT_DIR}/02-switched-off.png` });
});

test("settings tab: WHEN external previews is switched back on THEN the change persists", async () => {
	await harness.saveGlobalView({ externalPreviews: false });
	await settingsTab.open();
	await settingsTab.redisplay();

	const card = settingsTab.card("External content");
	await expect(card.locator(".checkbox-container")).not.toHaveClass(/is-enabled/);

	await flipToggleIn(card);

	await expect(card.locator(".checkbox-container")).toHaveClass(/is-enabled/);
	await expectExternalPreviewsPersisted(true);
	await page.screenshot({ path: `${OUT_DIR}/03-switched-back-on.png` });
});
