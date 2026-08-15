import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";

/**
 * Regression e2e for ticket nid_ofacqul281sr71qrdacqy8jv3_e: renaming a FOLDER
 * NOTE (a note named like its folder, e.g. `jon/jon.md`) with the community
 * "Folder notes" plugin installed used to leave a ghost node — React Flow
 * wrapper and resize grips rendered, node body invisible.
 *
 * Mechanism (root cause, reproduced verbatim below): that plugin
 * 1. renames the folder FROM INSIDE the note's `vault.rename` event dispatch
 *    (so the second rename races this plugin's own rename handlers), and
 * 2. re-tags folder notes by running
 *    `activeDocument.querySelectorAll("[data-path='<path>']")` DOCUMENT-WIDE and
 *    adding `is-folder-note` to every match, which its unscoped
 *    `.hide-folder-note .is-folder-note { display: none }` rule then hides.
 *    After a rename its retrying tag pass lands AFTER this plugin's rebuild, so
 *    the freshly rendered graph node was tagged and eaten.
 *
 * The fix: the graph node's vault path rides the plugin-scoped
 * `data-vicinity-path` attribute, never `data-path`, so a document-wide
 * `[data-path]` query can no longer reach it.
 */

test.describe.configure({ mode: "serial" });

const FIXTURES: Record<string, string> = {
	// The folder-note pair plus a child, mirroring the ticket's screenshot: MAIN
	// is a CHILD of the folder, not the folder note itself.
	"jon/jon.md": "Folder note jon links to [[note1]].\n",
	"jon/jsonb.md": "Child links to [[jon]] and [[note1]].\n",
};

const MAIN_PATH = "jon/jsonb.md";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(MAIN_PATH);
	await expect(noteNode(MAIN_PATH)).toHaveAttribute("data-tier", "main");
	// The Folder Notes plugin's "hide folder note" setting: the body class it
	// toggles plus the unscoped hide rule from its styles.css. Installed once for
	// the whole spec — exactly what a vault running that plugin has. Injected via
	// adoptedStyleSheets (same document-wide effect as that plugin's styles.css)
	// because Obsidian's publish review rejects any `style`-element creation in
	// the repo, even in this test-only stand-in for ANOTHER plugin's CSS.
	await page.evaluate(() => {
		document.body.classList.add("hide-folder-note");
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(".hide-folder-note .is-folder-note { display: none; }");
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
	});
	// Sanity: the adopted rule must actually hide tagged elements, or every
	// assertion below passes vacuously and the ghost regression goes unguarded.
	const hideRuleApplies = await page.evaluate(() => {
		const probe = document.createElement("div");
		probe.classList.add("is-folder-note");
		document.body.appendChild(probe);
		const display = getComputedStyle(probe).display;
		probe.remove();
		return display === "none";
	});
	expect(hideRuleApplies).toBe(true);
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string) {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

/**
 * Renames the folder note and lets a reentrant handler (the "Folder notes"
 * plugin stand-in) rename the folder the moment the note's rename event fires —
 * the same in-dispatch cascade the real plugin performs.
 */
async function renameFolderNoteWithCascade(
	fromNote: string,
	toNote: string,
	fromFolder: string,
	toFolder: string,
): Promise<void> {
	await page.evaluate(
		async ({ fromNotePath, toNotePath, fromFolderPath, toFolderPath }) => {
			const app = (window as unknown as { app: E2eObsidianApp }).app;
			const vault = app.vault as unknown as {
				rename(file: unknown, to: string): Promise<void>;
				getAbstractFileByPath(path: string): unknown;
				on(name: string, cb: (file: { path: string }, oldPath: string) => void): unknown;
				offref(ref: unknown): void;
			};
			let cascade: Promise<void> | null = null;
			const ref = vault.on("rename", (file, oldPath) => {
				if (oldPath === fromNotePath && cascade === null) {
					const folder = vault.getAbstractFileByPath(fromFolderPath);
					if (folder !== null) {
						cascade = vault.rename(folder, toFolderPath);
					}
				}
			});
			try {
				const note = vault.getAbstractFileByPath(fromNotePath);
				if (note === null) {
					throw new Error(`e2e: vault file not found: path=[${fromNotePath}]`);
				}
				await vault.rename(note, toNotePath);
				if (cascade !== null) {
					await cascade;
				}
			} finally {
				vault.offref(ref);
			}
		},
		{ fromNotePath: fromNote, toNotePath: toNote, fromFolderPath: fromFolder, toFolderPath: toFolder },
	);
}

/** The Folder Notes tag pass, verbatim (`addCSSClassToFileExplorerEl`): document-wide, by `data-path`. */
async function runFolderNotesTagPass(folderNotePath: string): Promise<void> {
	await page.evaluate((path) => {
		document.querySelectorAll(`[data-path='${CSS.escape(path)}']`).forEach((el) => {
			el.classList.add("is-folder-note");
		});
	}, folderNotePath);
}

test("renaming a folder note under the Folder Notes plugin keeps every node fully rendered", async () => {
	await renameFolderNoteWithCascade("jon/jon.md", "jon/jon1.md", "jon", "jon1");

	// The graph settles on the renamed vicinity first — this is the ordering that
	// used to ghost: the tag pass below lands on the ALREADY-rendered new node.
	await expect(noteNode("jon1/jsonb.md")).toHaveAttribute("data-tier", "main");
	await expect(noteNode("jon1/jon1.md")).toBeVisible();
	await runFolderNotesTagPass("jon1/jon1.md");

	// The renamed folder note's node keeps its body — no ghost.
	await expect(noteNode("jon1/jon1.md")).toBeVisible();
	// And every rendered node body is visible (a ghost is a wrapper whose body
	// `display: none`d away while its resize grips stayed).
	for (const body of await page.locator(".react-flow__node .vicinity-graph-node").all()) {
		await expect(body).toBeVisible();
	}
});

test("no element of the graph pane carries the file explorer's data-path attribute", async () => {
	// The collision surface itself: a document-wide `[data-path]` query (Folder
	// Notes, or any plugin following the file-explorer convention) must find
	// NOTHING inside the vicinity pane.
	await expect(page.locator(".vicinity-graph-flow [data-path]")).toHaveCount(0);
});
