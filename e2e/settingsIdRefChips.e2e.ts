import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import { SettingsTabPage } from "./settingsTabPage";
import { SettingsWriteWindow } from "./settingsWriteWindow";
import { soleRowControlName } from "./settingsBaseline";
import { IdRefFieldChips } from "../src/view/idRefFieldChips";

/**
 * The id-ref-fields CHIP row in the settings TAB (ticket
 * `nid_gpgudw7pfdy02wcqbs73si21x_e`). The panel side is component-tested under jsdom
 * (`src/view/IdRefFieldsRow.component.test.tsx`), but the tab presenter is hand-rolled
 * DOM that `npm test` cannot render at all — so its wiring (Enter adds and persists,
 * a chip's × removes and persists) has no coverage anywhere but here.
 *
 * The third test pins the interaction the two others cannot: the entry field's
 * blur-commit REPAINTS the chip list at the very moment a remove button is being
 * clicked (mousedown → blur → repaint → click). The tab reconciles chip elements per
 * field instead of rebuilding, precisely so the button under the cursor survives and
 * the click still lands — rebuild-on-repaint swallows the remove silently.
 *
 * Chip writes are immediate (no typing debounce — each add/remove is a whole
 * deliberate edit, like a toggle), so {@link SettingsWriteWindow.expectPersisted} is
 * a plain poll here and no drain barrier is needed.
 *
 * Expected strings are COMPUTED through {@link IdRefFieldChips}, the same projection
 * both presenters render from, so this file cannot disagree with the product about
 * what an add or a remove stores.
 */

test.describe.configure({ mode: "serial" });

const ENTRY_CONTROL = soleRowControlName("id-ref-fields");

let harness: ObsidianHarness;
let page: Page;
let settingsTab: SettingsTabPage;
let writeWindow: SettingsWriteWindow;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
	settingsTab = new SettingsTabPage(page);
	writeWindow = new SettingsWriteWindow(harness, settingsTab);
});

test.afterAll(async () => {
	await harness?.close();
});

/** GIVEN the tab open with a known stored field list, rendered as chips. */
async function givenStoredFields(idRefFields: string): Promise<void> {
	await harness.saveFrontmatterLinks({ idRefFields });
	await settingsTab.open();
	await settingsTab.redisplay();
	for (const field of IdRefFieldChips.list(idRefFields)) {
		await expect(settingsTab.control(IdRefFieldChips.removeName(field))).toBeVisible();
	}
}

test("settings tab: WHEN a field name is entered with Enter THEN it persists and shows as a chip", async () => {
	await givenStoredFields("deps");

	await settingsTab.typeInto(ENTRY_CONTROL, "links");
	await settingsTab.control(ENTRY_CONTROL).press("Enter");

	await writeWindow.expectPersisted(
		(globals) => globals.frontmatterLinks.idRefFields,
		IdRefFieldChips.add("deps", "links"),
		"an Enter-committed field must be appended to the stored list",
	);
	await expect(settingsTab.control(IdRefFieldChips.removeName("links"))).toBeVisible();
	await expect(settingsTab.control(ENTRY_CONTROL)).toHaveValue("");
});

test("settings tab: WHEN a chip's remove button is clicked THEN exactly its field leaves the store", async () => {
	await givenStoredFields("deps, links");

	await settingsTab.control(IdRefFieldChips.removeName("deps")).click();

	await writeWindow.expectPersisted(
		(globals) => globals.frontmatterLinks.idRefFields,
		IdRefFieldChips.remove("deps, links", "deps"),
		"a removed chip's field must leave the stored list",
	);
	await expect(settingsTab.control(IdRefFieldChips.removeName("deps"))).toHaveCount(0);
});

test("settings tab: WHEN a remove is clicked while the entry field holds an uncommitted name THEN both edits land", async () => {
	await givenStoredFields("deps");

	// The race under test: `fill` leaves the entry field FOCUSED, so the click's
	// mousedown blurs it first — the blur-commit adds "links" and repaints the chip
	// list while the click on "Remove deps" is still in flight.
	await settingsTab.typeInto(ENTRY_CONTROL, "links");
	await settingsTab.control(IdRefFieldChips.removeName("deps")).click();

	const afterBlurCommit = IdRefFieldChips.add("deps", "links");
	expect(afterBlurCommit, "precondition: the blur must have something to commit").toBeDefined();
	await writeWindow.expectPersisted(
		(globals) => globals.frontmatterLinks.idRefFields,
		IdRefFieldChips.remove(afterBlurCommit!, "deps"),
		"the remove click must not be swallowed by the blur-commit repaint",
	);
	await expect(settingsTab.control(IdRefFieldChips.removeName("deps"))).toHaveCount(0);
	await expect(settingsTab.control(IdRefFieldChips.removeName("links"))).toBeVisible();
});
