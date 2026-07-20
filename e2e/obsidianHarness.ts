import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

/**
 * Launches a REAL Obsidian (Electron) on a throwaway copy of `.dev-vault`,
 * fully sandboxed from any system Obsidian install.
 *
 * Connection: Obsidian is spawned with `--remote-debugging-port=0` and the
 * suite attaches via `chromium.connectOverCDP` to the "DevTools listening on
 * ws://…" endpoint the app prints on stderr.
 * WHY-NOT Playwright's `_electron.launch`: it additionally needs the Electron
 * MAIN process's node inspector (`--inspect=0`), which Obsidian's packaged
 * build ignores (Electron fuses), so `_electron.launch` hangs until timeout —
 * verified against Obsidian 1.12.7. All our automation is renderer-level
 * (locators + `window.app`), so browser-level CDP is sufficient.
 *
 * Sandbox mechanism (mirrors what `obsidian-launcher` does, verified in its
 * source — WHY we don't depend on it: plain Playwright covers our one launch
 * scenario without a second launcher framework):
 * - `--user-data-dir=<sandbox dir>` isolates Obsidian's own config; a
 *   pre-written `obsidian.json` registers the vault with `open: true` so the
 *   app boots straight into it (no vault picker) and `updateDisabled: true`
 *   stops auto-update traffic.
 * - `--no-sandbox` on Linux: Electron's SUID chrome-sandbox is unavailable in
 *   most CI containers (electron/electron#42510).
 * - Community plugins are enabled AT RUNTIME via `app.plugins.setEnable(true)`
 *   instead of pre-seeding Chromium's localStorage leveldb (WHY-NOT: seeding
 *   requires a leveldb writer dependency for zero extra value here).
 */

/** The subset of the plugin's persisted global view settings the e2e suite asserts on. */
export interface GlobalViewSnapshot {
	readonly nodeCap: number;
	readonly sizing: { readonly metrics: Record<string, { readonly enabled: boolean; readonly weight: number }> };
}

export const PLUGIN_ID = "obsidian-neighborhood-graph";
/** Command id = `<pluginId>:<commandId>` (Obsidian namespacing). */
export const OPEN_GRAPH_COMMAND_ID = `${PLUGIN_ID}:open-neighborhood-graph`;
/**
 * Duplicates `VIEW_TYPE_NEIGHBORHOOD_GRAPH` from `src/view/NeighborhoodGraphView.tsx`
 * on purpose: importing that module here would drag the `obsidian` package (types-only,
 * no runtime) into the node-side test process and crash it.
 */
const VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV_VAULT_DIR = path.join(REPO_ROOT, ".dev-vault");
const E2E_TMP_DIR = path.join(REPO_ROOT, ".tmp", "e2e");
const VAULT_COPY_DIR = path.join(E2E_TMP_DIR, "vault");
const SANDBOX_CONFIG_DIR = path.join(E2E_TMP_DIR, "obsidian-config");
/** Fixed id for the sandbox `obsidian.json` vault entry (shape: 16 hex chars, like Obsidian's own). */
const E2E_VAULT_ID = "0e2e0e2e0e2e0e2e";

const LAUNCH_TIMEOUT_MS = 60_000;
const WINDOW_POLL_INTERVAL_MS = 250;
/** Wide graph pane for pointer tests — see openGraphView WHY comment. */
const RIGHT_SIDEBAR_WIDTH_PX = 500;
/** App boot → `layoutReady` covers vault index + workspace restore. */
const WORKSPACE_READY_TIMEOUT_MS = 60_000;
const PLUGIN_READY_TIMEOUT_MS = 30_000;

/**
 * e2e-only fixtures layered on top of the setup-dev-vault ones: a 4-note
 * `crowd/` folder all linking to note1. c1/c2 carry a large body so the
 * default `own-file-size` metric ranks them deterministically ABOVE every
 * other depth-1 neighbor — with `nodeCap: 2` exactly c1+c2 survive, giving a
 * rendered `crowd` group with a "+2" badge AND a corner "+N hidden" overlay.
 */
const CROWD_FILLER = "filler line for the own-file-size sizing metric\n".repeat(200);
const CROWD_FIXTURES: Record<string, string> = {
	"crowd/c1.md": `Crowd member one links to [[note1]].\n\n${CROWD_FILLER}`,
	"crowd/c2.md": `Crowd member two links to [[note1]].\n\n${CROWD_FILLER}`,
	"crowd/c3.md": "Crowd member three links to [[note1]].\n",
	"crowd/c4.md": "Crowd member four links to [[note1]].\n",
};

export class ObsidianHarness {
	private constructor(
		private readonly browser: Browser,
		private readonly obsidianProcess: childProcess.ChildProcess,
		readonly page: Page,
	) {}

	/** Fails fast with an actionable message when the binary env var is absent. */
	static resolveObsidianPath(): string {
		const obsidianPath = process.env["OBSIDIAN_PATH"];
		if (obsidianPath === undefined || obsidianPath === "") {
			throw new Error(
				"OBSIDIAN_PATH is not set. Point it at an Obsidian binary, e.g.\n" +
					"  Linux:  ./Obsidian-x.y.z.AppImage --appimage-extract && export OBSIDIAN_PATH=$PWD/squashfs-root/obsidian\n" +
					"  macOS:  export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'\n" +
					"  Windows: set OBSIDIAN_PATH to Obsidian.exe\n" +
					"Then re-run: npm run test:e2e",
			);
		}
		if (!fs.existsSync(obsidianPath)) {
			throw new Error(`OBSIDIAN_PATH does not exist: obsidianPath=[${obsidianPath}]`);
		}
		return obsidianPath;
	}

	/**
	 * Fresh launch: (re)seeds a throwaway vault copy + sandbox config, then boots
	 * Obsidian. `extraFixtures` are extra `vaultRelativePath → content` notes
	 * layered on top of the built-in `crowd/` set (used by suites that need their
	 * own graph shape, e.g. depth chains for restart round-trips).
	 */
	static async launch(options: { extraFixtures?: Record<string, string> } = {}): Promise<ObsidianHarness> {
		ObsidianHarness.prepareVaultCopy(options.extraFixtures);
		ObsidianHarness.prepareSandboxConfigDir();
		return ObsidianHarness.spawnAndConnect();
	}

	/**
	 * Restarts Obsidian against the SAME vault copy + sandbox config — deliberately
	 * WITHOUT re-seeding them (no `prepareVaultCopy` wipe). This automates the
	 * step-06 "settings round-trip through an Obsidian restart" exit criterion: all
	 * plugin state persists to `.obsidian/plugins/<id>/data.json` inside the copy,
	 * so a real relaunch reloads exactly what was written. Closes the current
	 * instance first, then returns a FRESH harness bound to the new window.
	 */
	async relaunch(): Promise<ObsidianHarness> {
		await this.close();
		return ObsidianHarness.spawnAndConnect();
	}

	/** Spawns the Obsidian process against the already-prepared dirs and attaches over CDP. */
	private static async spawnAndConnect(): Promise<ObsidianHarness> {
		const executablePath = ObsidianHarness.resolveObsidianPath();
		const obsidianProcess = childProcess.spawn(executablePath, [
			`--user-data-dir=${SANDBOX_CONFIG_DIR}`,
			// Port 0 = OS-assigned; the concrete endpoint is read from stderr.
			"--remote-debugging-port=0",
			...(process.platform === "linux" ? ["--no-sandbox"] : []),
			// Escape hatch for environment-specific Chromium flags (e.g.
			// `--ozone-platform=headless` on display-less CI) without editing the harness.
			// Space-separated flags only — quoting is NOT supported, so no flag values with spaces.
			...(process.env["OBSIDIAN_E2E_EXTRA_ARGS"]?.split(" ").filter((arg) => arg !== "") ?? []),
		]);
		try {
			const cdpEndpoint = await ObsidianHarness.waitForDevtoolsEndpoint(obsidianProcess);
			const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: LAUNCH_TIMEOUT_MS });
			const page = await ObsidianHarness.waitForObsidianWindow(browser);
			await ObsidianHarness.waitForWorkspaceReady(page);
			await ObsidianHarness.enableCommunityPlugins(page);
			return new ObsidianHarness(browser, obsidianProcess, page);
		} catch (error) {
			obsidianProcess.kill();
			throw error;
		}
	}

	async close(): Promise<void> {
		// connectOverCDP close() only disconnects; the app process must be ended explicitly.
		// finally: if the CDP disconnect rejects (e.g. connection already dropped), the
		// Obsidian process must still be killed or it would outlive the suite as a zombie.
		try {
			await this.browser.close();
		} finally {
			this.obsidianProcess.kill();
		}
	}

	/** Opens a vault file in a MAIN-AREA leaf (mirrors ObsidianNoteNavigator's getLeaf(false)). */
	async openFile(vaultPath: string): Promise<void> {
		await this.page.evaluate(async (targetPath) => {
			// Undocumented-but-stable app globals; typed as any on purpose.
			const app = (window as unknown as { app: any }).app;
			const file = app.vault.getAbstractFileByPath(targetPath);
			if (!file) {
				throw new Error(`e2e: vault file not found: path=[${targetPath}]`);
			}
			await app.workspace.getLeaf(false).openFile(file);
		}, vaultPath);
	}

	/** Runs the plugin's "Open neighborhood graph" command and waits for the RF canvas to mount. */
	async openGraphView(): Promise<void> {
		const executed = await this.page.evaluate(
			(commandId) => (window as unknown as { app: any }).app.commands.executeCommandById(commandId),
			OPEN_GRAPH_COMMAND_ID,
		);
		if (!executed) {
			throw new Error(`e2e: command did not execute: commandId=[${OPEN_GRAPH_COMMAND_ID}]`);
		}
		// The mounted view shows the empty state until a note-bearing file becomes
		// active (fresh boot lands on "New tab"), so wait for EITHER render mode.
		await expect(this.page.locator(".neighborhood-graph-flow, .neighborhood-graph-empty")).toBeAttached();
		// Deterministic sidebar layout: stock right-sidebar tabs (backlinks,
		// outline, …) stack above/below the graph and their panes intercept
		// pointer events on nodes near the pane boundary in small windows —
		// observed as Playwright "subtree intercepts pointer events" click
		// failures. Detaching them gives the graph the whole sidebar.
		await this.page.evaluate(
			({ viewType, sidebarWidthPx }) => {
				const app = (window as unknown as { app: any }).app;
				const graphLeaf = app.workspace.getLeavesOfType(viewType)[0];
				const others: any[] = [];
				app.workspace.iterateAllLeaves((leaf: any) => {
					if (leaf !== graphLeaf && leaf.getRoot() === app.workspace.rightSplit) {
						others.push(leaf);
					}
				});
				for (const leaf of others) {
					leaf.detach();
				}
				// A wide sidebar lets `fitView` place the whole graph inside the
				// pane (its minZoom floor would otherwise overflow dense graphs).
				const rightSplit = app.workspace.rightSplit;
				if (typeof rightSplit?.setSize === "function") {
					rightSplit.setSize(sidebarWidthPx);
				}
			},
			{ viewType: VIEW_TYPE_NEIGHBORHOOD_GRAPH, sidebarWidthPx: RIGHT_SIDEBAR_WIDTH_PX },
		);
	}

	/**
	 * Detaches and re-opens the graph view. WHY: React Flow `fitView` runs on
	 * MOUNT only; after active-file switches the old viewport can leave nodes
	 * outside the visible pane, where real pointer clicks are impossible.
	 * Remounting refits the CURRENT graph — a real user gets the same effect by
	 * panning or reopening the view.
	 */
	async remountGraphView(): Promise<void> {
		await this.page.evaluate((viewType) => {
			const app = (window as unknown as { app: any }).app;
			for (const leaf of app.workspace.getLeavesOfType(viewType)) {
				leaf.detach();
			}
		}, VIEW_TYPE_NEIGHBORHOOD_GRAPH);
		await this.openGraphView();
	}

	/** Sets the global nodeCap through the plugin's own persistence API (no settings UI until step 06). */
	async setGlobalNodeCap(nodeCap: number): Promise<void> {
		await this.page.evaluate(
			async ({ pluginId, cap }) => {
				const app = (window as unknown as { app: any }).app;
				const store = app.plugins.plugins[pluginId].pluginDataStore;
				await store.saveGlobalView({ ...store.globalView(), nodeCap: cap });
			},
			{ pluginId: PLUGIN_ID, cap: nodeCap },
		);
	}

	/**
	 * Reads the plugin's persisted global view settings straight from the store —
	 * the source of truth that a restart reloads. Used to assert settings
	 * round-trip through {@link relaunch} without depending on rendered pixels.
	 */
	async readGlobalView(): Promise<GlobalViewSnapshot> {
		return this.page.evaluate((pluginId) => {
			const app = (window as unknown as { app: any }).app;
			return app.plugins.plugins[pluginId].pluginDataStore.globalView() as GlobalViewSnapshot;
		}, PLUGIN_ID);
	}

	/** Forces the given Obsidian theme by body class (how Obsidian itself switches). */
	async setTheme(theme: "dark" | "light"): Promise<void> {
		await this.page.evaluate((mode) => {
			document.body.classList.toggle("theme-dark", mode === "dark");
			document.body.classList.toggle("theme-light", mode === "light");
		}, theme);
	}

	// --- launch internals ---------------------------------------------------

	/**
	 * Fresh copy of `.dev-vault` per run: tests stay idempotent, runtime
	 * mutations (nodeCap, plugin data.json) never leak into the human's vault,
	 * and e2e-only fixtures never pollute manual QA.
	 */
	private static prepareVaultCopy(extraFixtures: Record<string, string> = {}): void {
		if (!fs.existsSync(DEV_VAULT_DIR)) {
			throw new Error(`Dev vault missing: dir=[${DEV_VAULT_DIR}]. Run: npm run setup:dev-vault`);
		}
		const builtPluginFile = path.join(DEV_VAULT_DIR, ".obsidian", "plugins", PLUGIN_ID, "main.js");
		if (!fs.existsSync(builtPluginFile)) {
			throw new Error(`Plugin build missing in dev vault: file=[${builtPluginFile}]. Run: npm run setup:dev-vault`);
		}
		fs.rmSync(VAULT_COPY_DIR, { recursive: true, force: true });
		fs.cpSync(DEV_VAULT_DIR, VAULT_COPY_DIR, { recursive: true });
		// Fresh plugin settings: a stale data.json (e.g. from a previous aborted
		// run) would silently change caps/settings under the assertions.
		fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "data.json"), { force: true });
		for (const [relativePath, content] of Object.entries({ ...CROWD_FIXTURES, ...extraFixtures })) {
			const target = path.join(VAULT_COPY_DIR, relativePath);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.writeFileSync(target, content);
		}
	}

	private static prepareSandboxConfigDir(): void {
		fs.rmSync(SANDBOX_CONFIG_DIR, { recursive: true, force: true });
		fs.mkdirSync(SANDBOX_CONFIG_DIR, { recursive: true });
		const obsidianJson = {
			updateDisabled: true,
			vaults: {
				[E2E_VAULT_ID]: { path: VAULT_COPY_DIR, ts: Date.now(), open: true },
			},
		};
		fs.writeFileSync(path.join(SANDBOX_CONFIG_DIR, "obsidian.json"), JSON.stringify(obsidianJson));
	}

	/** Resolves the "DevTools listening on ws://…" endpoint from the app's stderr. */
	private static waitForDevtoolsEndpoint(proc: childProcess.ChildProcess): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let stderrSoFar = "";
			const timer = setTimeout(() => {
				reject(
					new Error(`Obsidian never announced a DevTools endpoint. stderr so far:\n${stderrSoFar}`),
				);
			}, LAUNCH_TIMEOUT_MS);
			proc.stderr?.on("data", (chunk: Buffer) => {
				stderrSoFar += chunk.toString();
				const match = stderrSoFar.match(/DevTools listening on (ws:\/\/\S+)/);
				if (match?.[1] !== undefined) {
					clearTimeout(timer);
					resolve(match[1]);
				}
			});
			proc.on("exit", (code) => {
				clearTimeout(timer);
				reject(new Error(`Obsidian exited before CDP was available: code=[${code}]\n${stderrSoFar}`));
			});
			proc.on("error", (error) => {
				clearTimeout(timer);
				reject(error);
			});
		});
	}

	/** Waits for the vault window (`app://obsidian.md/...`) among the CDP-visible pages. */
	private static async waitForObsidianWindow(browser: Browser): Promise<Page> {
		const context = browser.contexts()[0];
		if (context === undefined) {
			throw new Error("CDP connected but Obsidian exposed no browser context");
		}
		const isVaultWindow = (page: Page): boolean => page.url().startsWith("app://obsidian.md");
		// State-poll (window creation AND its later navigation to app:// both
		// count) — CDP has no single event covering both, and the poll is bounded
		// and condition-based, not a race-masking sleep.
		const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
		while (Date.now() < deadline) {
			const vaultWindow = context.pages().find(isVaultWindow);
			if (vaultWindow !== undefined) {
				return vaultWindow;
			}
			await new Promise((resolveTick) => setTimeout(resolveTick, WINDOW_POLL_INTERVAL_MS));
		}
		throw new Error(
			`No Obsidian vault window appeared. pages=[${context.pages().map((p) => p.url()).join(", ")}]`,
		);
	}

	private static async waitForWorkspaceReady(page: Page): Promise<void> {
		await page.waitForFunction(
			() => (window as unknown as { app?: any }).app?.workspace?.layoutReady === true,
			undefined,
			{ timeout: WORKSPACE_READY_TIMEOUT_MS },
		);
	}

	private static async enableCommunityPlugins(page: Page): Promise<void> {
		// A fresh sandbox shows first-boot modals (vault trust / release notes).
		// Escape dismisses them; plugin enablement below does not depend on the
		// modal's buttons, so this is best-effort cleanup, not a wait.
		await page.keyboard.press("Escape");
		await page.evaluate(async (pluginId) => {
			const app = (window as unknown as { app: any }).app;
			// setEnable(true) = the "Turn on community plugins" switch: persists the
			// flag and loads every plugin listed in community-plugins.json.
			await app.plugins.setEnable(true);
			await app.plugins.enablePlugin(pluginId);
		}, PLUGIN_ID);
		await page.waitForFunction(
			(pluginId) => Boolean((window as unknown as { app: any }).app.plugins.plugins[pluginId]),
			PLUGIN_ID,
			{ timeout: PLUGIN_READY_TIMEOUT_MS },
		);
	}
}
