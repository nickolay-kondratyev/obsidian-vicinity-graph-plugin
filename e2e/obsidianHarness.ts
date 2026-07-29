import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import {
	assertExternalLaunchAllowed,
	assertExternalVaultReady,
	resolveVaultTarget,
	VAULT_OVERRIDE_ENV_VAR,
	vaultDirOf,
} from "./vaultTarget";
import type { DevVaultCopyTarget, LaunchOptions, VaultTarget } from "./vaultTarget";
// Type-only, so it is erased at transpile — the pure engine barrel never loads in the node-side test process.
import type {
	DepthSettings,
	NodeExclusionSettings,
	NodePreviewPreference,
	ViewSettings,
	ViewSettingsOverride,
} from "../src/engine";

/**
 * Launches a REAL Obsidian (Electron) on a throwaway copy of `.dev-vault`,
 * fully sandboxed from any system Obsidian install.
 *
 * Opt-in override: with `VICINITY_E2E_VAULT` set, Obsidian opens THAT vault in
 * place instead (see `vaultTarget.ts`) — no copy, no wipe, no fixture writes.
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

/**
 * The plugin's three persisted GLOBAL slices, as the store exposes them.
 *
 * Typed off the engine's own settings interfaces rather than a hand-written
 * subset: those shapes are already declared once in `src/engine/types.ts`, so a
 * field rename there becomes a `tsc` error in the specs that read it instead of
 * a silently-`undefined` assertion at runtime.
 */
export interface PluginGlobalsSnapshot {
	readonly view: ViewSettings;
	readonly depths: DepthSettings;
	readonly exclusion: NodeExclusionSettings;
}

export const PLUGIN_ID = "vicinity-graph";
/** Command id = `<pluginId>:<commandId>` (Obsidian namespacing). */
export const OPEN_GRAPH_COMMAND_ID = `${PLUGIN_ID}:open-vicinity-graph`;
/** Places the graph in a main-area pane BELOW the active note (see GraphViewOpener). */
export const OPEN_GRAPH_BELOW_COMMAND_ID = `${PLUGIN_ID}:open-vicinity-graph-below`;
/** Mirrors `GraphViewPlacement`, plus the "neither region" case a spec must be able to see. */
export type ObservedGraphPlacement = "right-sidebar" | "main-area" | "other";
/**
 * Duplicates `VIEW_TYPE_VICINITY_GRAPH` from `src/view/VicinityGraphView.tsx`
 * on purpose: importing that module here would drag the `obsidian` package (types-only,
 * no runtime) into the node-side test process and crash it.
 */
const VIEW_TYPE_VICINITY_GRAPH = "vicinity-graph-view";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const E2E_TMP_DIR = path.join(REPO_ROOT, ".tmp", "e2e");
const VAULT_COPY_DIR = path.join(E2E_TMP_DIR, "vault");
const SANDBOX_CONFIG_DIR = path.join(E2E_TMP_DIR, "obsidian-config");
/** Fixed id for the sandbox `obsidian.json` vault entry (shape: 16 hex chars, like Obsidian's own). */
const E2E_VAULT_ID = "0e2e0e2e0e2e0e2e";

const LAUNCH_TIMEOUT_MS = 60_000;
/** Graceful-shutdown grace before SIGKILL in {@link ObsidianHarness.killAndWaitForExit}. */
const FORCE_KILL_AFTER_MS = 10_000;
const WINDOW_POLL_INTERVAL_MS = 250;
/** Wide graph pane for pointer tests — see openGraphView WHY comment. */
const RIGHT_SIDEBAR_WIDTH_PX = 500;
/**
 * Physical Obsidian window size pre-seeded into the sandbox (see
 * {@link ObsidianHarness.prepareSandboxConfigDir}). WHY: headless Obsidian
 * (Docker/CI, `--ozone-platform=headless`) otherwise boots into a tiny ~300×200
 * window; the 500px graph sidebar then overflows ENTIRELY off-screen, so no node
 * is physically clickable and the pointer-interaction tests can't reach a node
 * (DOM-assertion tests still pass — they query the DOM directly). A CDP
 * `Emulation.setDeviceMetricsOverride` only resizes the LAYOUT viewport, not the
 * input surface, so real clicks still miss; resizing the actual window is the
 * only fix. Obsidian restores this from `<userdata>/<vaultId>.json` at boot, so
 * pre-writing it makes the window real-sized on any host. Sized generously so
 * `fitView` keeps every node inside the pane.
 */
const WINDOW_WIDTH_PX = 1280;
const WINDOW_HEIGHT_PX = 800;
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
		/** Carried so {@link relaunch} keeps the same mode without re-reading the env. */
		private readonly vaultMode: VaultTarget["mode"],
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
	 *
	 * `allowExternalVault` is the per-spec opt-in required under
	 * `VICINITY_E2E_VAULT` — see {@link assertExternalLaunchAllowed}.
	 */
	static async launch(options: LaunchOptions = {}): Promise<ObsidianHarness> {
		const target = resolveVaultTarget(process.env[VAULT_OVERRIDE_ENV_VAR], REPO_ROOT);
		if (target.mode === "dev-vault-copy") {
			ObsidianHarness.prepareVaultCopy(target, options.extraFixtures);
		} else {
			assertExternalLaunchAllowed(target.vaultDir, options);
			assertExternalVaultReady(target.vaultDir, PLUGIN_ID, REPO_ROOT);
		}
		ObsidianHarness.prepareSandboxConfigDir(vaultDirOf(target));
		return ObsidianHarness.spawnAndConnect(target.mode);
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
		// Obsidian saved its ACTUAL window size at shutdown; in a headless run
		// that is the tiny default (~300×200), so the relaunched pane would be a
		// sliver — fitView then legitimately can't show the whole graph and the
		// culling unmounts off-screen nodes. Window geometry is environment
		// plumbing (not the persisted plugin state under test), so re-seed it.
		ObsidianHarness.seedWindowState();
		return ObsidianHarness.spawnAndConnect(this.vaultMode);
	}

	/** Spawns the Obsidian process against the already-prepared dirs and attaches over CDP. */
	private static async spawnAndConnect(vaultMode: VaultTarget["mode"]): Promise<ObsidianHarness> {
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
			if (vaultMode === "dev-vault-copy") {
				await ObsidianHarness.enableCommunityPlugins(page);
			} else {
				await ObsidianHarness.waitForAlreadyEnabledPlugin(page);
			}
			return new ObsidianHarness(browser, obsidianProcess, page, vaultMode);
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
			await ObsidianHarness.killAndWaitForExit(this.obsidianProcess);
		}
	}

	/**
	 * Kills Obsidian and WAITS for the process to actually exit. WHY: a dying
	 * Obsidian still writes sandbox-config files (window state, workspace) on
	 * shutdown; returning before exit lets those writes race the next launch —
	 * observed as `relaunch()`'s re-seeded window state being clobbered and as
	 * `ENOTEMPTY` when the next spec wipes the config dir.
	 */
	private static killAndWaitForExit(proc: childProcess.ChildProcess): Promise<void> {
		if (proc.exitCode !== null || proc.signalCode !== null) {
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			// Backstop: escalate if graceful shutdown hangs (bounded, condition-based).
			const forceKillTimer = setTimeout(() => proc.kill("SIGKILL"), FORCE_KILL_AFTER_MS);
			proc.once("exit", () => {
				clearTimeout(forceKillTimer);
				resolve();
			});
			proc.kill();
		});
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

	/** Runs a plugin command by id, failing loudly when Obsidian reports it unavailable. */
	async executeCommand(commandId: string): Promise<void> {
		const executed = await this.page.evaluate(
			(id) => (window as unknown as { app: any }).app.commands.executeCommandById(id),
			commandId,
		);
		if (!executed) {
			throw new Error(`e2e: command did not execute: commandId=[${commandId}]`);
		}
	}

	/** The workspace region of every open graph view, in leaf order. */
	async graphViewPlacements(): Promise<ObservedGraphPlacement[]> {
		return this.page.evaluate((viewType) => {
			const app = (window as unknown as { app: any }).app;
			return app.workspace.getLeavesOfType(viewType).map((leaf: any) => {
				const root = leaf.getRoot();
				if (root === app.workspace.rightSplit) {
					return "right-sidebar";
				}
				return root === app.workspace.rootSplit ? "main-area" : "other";
			});
		}, VIEW_TYPE_VICINITY_GRAPH);
	}

	/** Runs the plugin's "Open vicinity graph" command and waits for the RF canvas to mount. */
	async openGraphView(): Promise<void> {
		await this.executeCommand(OPEN_GRAPH_COMMAND_ID);
		// The mounted view shows the empty state until a note-bearing file becomes
		// active (fresh boot lands on "New tab"), so wait for EITHER render mode.
		await expect(this.page.locator(".vicinity-graph-flow, .vicinity-graph-empty")).toBeAttached();
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
			{ viewType: VIEW_TYPE_VICINITY_GRAPH, sidebarWidthPx: RIGHT_SIDEBAR_WIDTH_PX },
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
		}, VIEW_TYPE_VICINITY_GRAPH);
		await this.openGraphView();
	}

	// --- persisted plugin state --------------------------------------------
	//
	// THE one place in the e2e suite that knows the `pluginDataStore` shape: every
	// spec goes through the typed methods below instead of hand-writing its own
	// `app.plugins.plugins[id].pluginDataStore` evaluate block.

	/**
	 * Reads all three persisted global slices in ONE round trip — the source of
	 * truth a restart reloads, with no rendered pixels in the middle.
	 */
	async readGlobals(): Promise<PluginGlobalsSnapshot> {
		return this.page.evaluate((pluginId) => {
			const store = (window as unknown as { app: any }).app.plugins.plugins[pluginId].pluginDataStore;
			return {
				view: store.globalView(),
				depths: store.globalDepths(),
				exclusion: store.nodeExclusion(),
			} as PluginGlobalsSnapshot;
		}, PLUGIN_ID);
	}

	/** The persisted global VIEW slice alone (see {@link readGlobals}). */
	async readGlobalView(): Promise<ViewSettings> {
		return (await this.readGlobals()).view;
	}

	/**
	 * Merges `patch` over the stored global view slice.
	 *
	 * SHALLOW merge, exactly like the store's own callers: a nested field
	 * (`sizing`, `forceLayout`) is REPLACED wholesale, so a caller changing one of
	 * its keys must spread the current value in itself (read it via
	 * {@link readGlobalView}). Explicit beats a deep-merge that silently decides
	 * which level it is patching.
	 */
	async saveGlobalView(patch: ViewSettingsOverride): Promise<void> {
		await this.page.evaluate(
			async ({ pluginId, viewPatch }) => {
				const store = (window as unknown as { app: any }).app.plugins.plugins[pluginId].pluginDataStore;
				await store.saveGlobalView({ ...store.globalView(), ...viewPatch });
			},
			{ pluginId: PLUGIN_ID, viewPatch: patch },
		);
	}

	/** Replaces the persisted global traversal depths (both directions are always written). */
	async saveGlobalDepths(depths: DepthSettings): Promise<void> {
		await this.page.evaluate(
			async ({ pluginId, value }) => {
				const store = (window as unknown as { app: any }).app.plugins.plugins[pluginId].pluginDataStore;
				await store.saveGlobalDepths(value);
			},
			{ pluginId: PLUGIN_ID, value: depths },
		);
	}

	/** Replaces the persisted node-exclusion slice (toggle + patterns are one atomic write). */
	async saveNodeExclusion(exclusion: NodeExclusionSettings): Promise<void> {
		await this.page.evaluate(
			async ({ pluginId, value }) => {
				const store = (window as unknown as { app: any }).app.plugins.plugins[pluginId].pluginDataStore;
				await store.saveNodeExclusion(value);
			},
			{ pluginId: PLUGIN_ID, value: exclusion },
		);
	}

	/**
	 * Rebuilds every OPEN graph view against the current store. A store write alone
	 * changes nothing on screen, so a caller that wants the graph (not the settings
	 * tab — that is `SettingsTabPage.redisplay()`) to reflect a write says so here.
	 */
	async refreshOpenViews(): Promise<void> {
		await this.page.evaluate((pluginId) => {
			(window as unknown as { app: any }).app.plugins.plugins[pluginId].refreshOpenViews();
		}, PLUGIN_ID);
	}

	/**
	 * Disables and re-enables the plugin, then waits for the new instance to be
	 * registered. WHY: it drops every in-memory store, so a read afterwards proves
	 * the value came back off `data.json` rather than out of RAM.
	 *
	 * PRECONDITION: close any UI owned by the outgoing instance first (e.g.
	 * `SettingsTabPage.close()`) — this method deliberately knows nothing about it.
	 */
	async reloadPlugin(): Promise<void> {
		await this.page.evaluate(async (pluginId) => {
			const app = (window as unknown as { app: any }).app;
			await app.plugins.disablePlugin(pluginId);
			await app.plugins.enablePlugin(pluginId);
		}, PLUGIN_ID);
		await this.page.waitForFunction(
			(pluginId) => Boolean((window as unknown as { app: any }).app.plugins.plugins[pluginId]),
			PLUGIN_ID,
			{ timeout: PLUGIN_READY_TIMEOUT_MS },
		);
	}

	/** Sets the global nodeCap through the plugin's own persistence API (no settings UI until step 06). */
	async setGlobalNodeCap(nodeCap: number): Promise<void> {
		await this.saveGlobalView({ nodeCap });
	}

	/**
	 * Sets the largest node size (mirrors {@link setGlobalNodeCap}). Centrals are
	 * always sized at `maxPx`, so this is the one deterministic lever for putting
	 * the MAIN node in a chosen density band (the CSS container-query thresholds).
	 */
	async setMaxNodeSizePx(maxPx: number): Promise<void> {
		const view = await this.readGlobalView();
		await this.saveGlobalView({ sizing: { ...view.sizing, maxPx } });
	}

	/**
	 * Sets the global node-preview preference (mirrors {@link setGlobalNodeCap}),
	 * then fans the change out to every open GRAPH view — a store write alone does
	 * not rebuild anything. A caller that needs the SETTINGS TAB to re-render
	 * instead wants `saveGlobalView` + `SettingsTabPage.redisplay()`.
	 *
	 * WHY not drive the pill: the two pills' own click paths are covered in
	 * `settingsUxVisual.e2e.ts`; suites that only need a given RENDERED preview
	 * want the setting, not the UI, in the middle.
	 */
	async setNodePreviewPreference(preference: NodePreviewPreference): Promise<void> {
		await this.saveGlobalView({ nodePreviewPreference: preference });
		await this.refreshOpenViews();
	}

	/**
	 * Forces the given Obsidian theme by body class — the MECHANISM Obsidian's own
	 * theme switch drives, so every `--theme-*` / `--text-*` variable resolves to
	 * that theme afterwards (`vicinityGraph.e2e.ts` asserts exactly that, per theme,
	 * through this lever).
	 *
	 * WHY-NOT `app.changeTheme(...)`: it additionally PERSISTS the choice into the
	 * vault's appearance config, which under `VICINITY_E2E_VAULT` would mutate the
	 * human's real vault for a purely visual assertion. Nothing in the suite reads
	 * the persisted theme id, and a class toggle is synchronous — so it also needs
	 * no post-switch wait.
	 */
	async setTheme(theme: "dark" | "light"): Promise<void> {
		await this.page.evaluate((mode) => {
			document.body.classList.toggle("theme-dark", mode === "dark");
			document.body.classList.toggle("theme-light", mode === "light");
		}, theme);
	}

	// --- launch internals ---------------------------------------------------

	/**
	 * Fresh copy of `.dev-vault` per run: tests stay idempotent, runtime
	 * mutations (nodeCap, plugin `data.json`/`doc-data/`) never leak into the
	 * human's vault, and e2e-only fixtures never pollute manual QA. The reverse
	 * leak is closed too — the copy's plugin state is wiped after the copy, so
	 * manual-QA settings and pins never reach a run.
	 */
	private static prepareVaultCopy(target: DevVaultCopyTarget, extraFixtures: Record<string, string> = {}): void {
		// Belt and braces: the union already keeps an external vault out of this
		// method; this asserts the ONE directory below is the throwaway copy dir
		// before anything destructive runs.
		// WHY-NOT write through `target.copyDir` afterwards: the destructive calls
		// deliberately name the module constant so the source scan in
		// `vaultTarget.test.ts` can verify their destination statically. This assert
		// is what keeps the two spellings from drifting.
		if (path.resolve(target.copyDir) !== path.resolve(VAULT_COPY_DIR)) {
			throw new Error(`Refusing to wipe a non-throwaway directory: copyDir=[${target.copyDir}]`);
		}
		if (!fs.existsSync(target.sourceDir)) {
			throw new Error(`Dev vault missing: dir=[${target.sourceDir}]. Run: npm run setup:dev-vault`);
		}
		const builtPluginFile = path.join(target.sourceDir, ".obsidian", "plugins", PLUGIN_ID, "main.js");
		if (!fs.existsSync(builtPluginFile)) {
			throw new Error(`Plugin build missing in dev vault: file=[${builtPluginFile}]. Run: npm run setup:dev-vault`);
		}
		fs.rmSync(VAULT_COPY_DIR, { recursive: true, force: true });
		fs.cpSync(target.sourceDir, VAULT_COPY_DIR, { recursive: true });
		// Fresh plugin state: BOTH persisted slices are wiped, so a run only ever sees
		// what the specs themselves put there.
		// - `data.json` = GLOBAL settings; a stale one (e.g. from a previously aborted
		//   run) would silently change caps/settings under the assertions.
		// - `doc-data/` = the PER-DOC `<docid>.json` files, i.e. where PINS live. These
		//   come from `.dev-vault` itself: a pin a human makes during manual QA is
		//   copied in by `cpSync` above and would break absence assertions such as
		//   "no central pinned THEN no Pinned centrals disclosure" (settingsUxVisual).
		// Both destinations name the VAULT_COPY_DIR constant literally — see the
		// WHY-NOT above and the source scan in `vaultTarget.test.ts`.
		fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "data.json"), { force: true });
		fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "doc-data"), {
			recursive: true,
			force: true,
		});
		for (const [relativePath, content] of Object.entries({ ...CROWD_FIXTURES, ...extraFixtures })) {
			// Written through the VAULT_COPY_DIR constant (not a local alias) so the
			// destructive-call source scan in vaultTarget.test.ts can see the destination.
			fs.mkdirSync(path.dirname(path.join(VAULT_COPY_DIR, relativePath)), { recursive: true });
			fs.writeFileSync(path.join(VAULT_COPY_DIR, relativePath), content);
		}
	}

	private static prepareSandboxConfigDir(vaultDir: string): void {
		fs.rmSync(SANDBOX_CONFIG_DIR, { recursive: true, force: true });
		fs.mkdirSync(SANDBOX_CONFIG_DIR, { recursive: true });
		const obsidianJson = {
			updateDisabled: true,
			vaults: {
				[E2E_VAULT_ID]: { path: vaultDir, ts: Date.now(), open: true },
			},
		};
		fs.writeFileSync(path.join(SANDBOX_CONFIG_DIR, "obsidian.json"), JSON.stringify(obsidianJson));
		ObsidianHarness.seedWindowState();
	}

	/**
	 * Per-vault window state Obsidian restores at boot (keyed by vault id):
	 * seed a real-sized window so headless runs don't default to ~300×200.
	 * See WINDOW_WIDTH_PX for WHY this matters to the pointer-interaction tests.
	 * Called on fresh launches AND on {@link relaunch} (Obsidian overwrites the
	 * file with the actual — headless-tiny — size at shutdown).
	 */
	private static seedWindowState(): void {
		const windowStateJson = { width: WINDOW_WIDTH_PX, height: WINDOW_HEIGHT_PX, zoom: 0 };
		fs.writeFileSync(path.join(SANDBOX_CONFIG_DIR, `${E2E_VAULT_ID}.json`), JSON.stringify(windowStateJson));
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

	/**
	 * External-vault mode: loads the plugin the USER already enabled in that vault.
	 *
	 * `setEnable(true)` is unavoidable — the "community plugins on" flag is written
	 * to `localStorage` (`enable-plugin-<appId>`), which lives in the Obsidian
	 * USER-DATA dir, i.e. our throwaway sandbox. So a fresh sandbox always boots
	 * with plugins off and nothing loads at all. Verified against Obsidian 1.12.7:
	 * the call writes no vault file, it just loads whatever this vault's
	 * `.obsidian/community-plugins.json` already lists.
	 *
	 * ACCEPTED CONSEQUENCE: that means EVERY community plugin enabled in the target
	 * vault loads and runs, exactly as when the human opens the vault themselves —
	 * documented in the README caveat. There is no per-plugin lever: `enablePlugin`
	 * requires the master switch to be on anyway.
	 *
	 * WHY-NOT `enablePlugin(pluginId)` (which the dev-vault path calls): it is not
	 * needed once the vault lists the plugin, and calling it here would mean loading
	 * our code — which then writes `data.json`/`doc-data/` into that vault — even
	 * when the human has NOT enabled it there.
	 */
	private static async waitForAlreadyEnabledPlugin(page: Page): Promise<void> {
		// A fresh sandbox user-data-dir shows first-boot modals (vault trust /
		// release notes); Escape dismisses them (best-effort, same as above).
		await page.keyboard.press("Escape");
		await page.evaluate(async () => {
			await (window as unknown as { app: any }).app.plugins.setEnable(true);
		});
		try {
			await page.waitForFunction(
				(pluginId) => Boolean((window as unknown as { app: any }).app.plugins.plugins[pluginId]),
				PLUGIN_ID,
				{ timeout: PLUGIN_READY_TIMEOUT_MS },
			);
		} catch (error) {
			throw new Error(
				`Plugin never loaded in the ${VAULT_OVERRIDE_ENV_VAR} vault: pluginId=[${PLUGIN_ID}]. ` +
					"Open that vault in Obsidian, turn on community plugins and enable it there, then re-run. " +
					`cause=[${String(error)}]`,
			);
		}
	}
}
