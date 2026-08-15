import type { DepthSettings, FrontmatterLinkSettings, NodeExclusionSettings, ViewSettings } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { UserNoticePort } from "../view/viewPorts";
import type { PinnedDocEntry, PluginData } from "./persistedShapes";
import { PersistedShapes, serializePluginData } from "./persistedShapes";
import type { PluginDataPort } from "./storagePorts";

/**
 * Total `loadData` attempts {@link PluginDataStore.init} spends before giving up
 * on reading `data.json` (the try plus the retries). The failures this guards are
 * TRANSIENT — Obsidian's `Vault.readJson` (verified byte-identical in the shipped
 * 1.12.4 and 1.12.7 bundles) returns `undefined` when the fs read or the JSON
 * parse threw for any reason OTHER than ENOENT, e.g. a resource-exhaustion error
 * under load — so a couple of short-spaced retries recover the user's real
 * settings instead of silently booting the session on defaults (ticket
 * nid_ghaeps3siekw0oe17mr4xpmad_e: restart-time stale controls). When the retries
 * exhaust, {@link PluginDataStore.recoverAfterExhaustedReads} runs the raw probe
 * that tells a PERMANENTLY corrupt file (which no retry could ever fix) from a
 * transient one (ticket nid_08ripmsxon0r9ncn42lp623g1_e).
 */
export const INIT_LOAD_ATTEMPTS = 3;

/** Pause between {@link INIT_LOAD_ATTEMPTS}: long enough for a transient fs error to clear, short enough to not delay onload noticeably. */
const INIT_RETRY_DELAY_MS = 100;

/**
 * Shown ONCE when every read attempt failed AND the raw probe could NOT prove the
 * file corrupt (no bytes on disk, bytes that DO parse, or a probe that itself
 * failed — a genuine transient): the session runs on defaults, the user's file is
 * left untouched, and restarting reloads it. The repeated-failure sentence is the
 * honesty the corruption story earns — a transient clears on restart, so a message
 * that keeps returning every session points at a file the probe still cannot read
 * (e.g. a permissions error that also blocks the raw probe), whose one manual fix
 * is to delete or rename it. Plain language, states the consequence and the way
 * back (interface-design guardrail: no raw error codes).
 *
 * `dataJsonPath` is the file's REAL vault-relative path (configurable config dir,
 * NOT a hardcoded `.obsidian` — obsidianmd/hardcoded-config-path), passed in from
 * {@link main.ts} where it is derived from `app.vault.configDir`.
 */
const initLoadFailedNotice = (dataJsonPath: string): string =>
	"Vicinity Graph couldn't read its saved settings, so defaults are shown for this session. " +
	"Your settings file was left untouched and changes made this session won't be saved over it — " +
	"restart Obsidian to load it again. If this message returns every time you restart, the settings " +
	"file is damaged and can't be read; deleting or renaming " +
	`“${dataJsonPath}” resets settings and clears it.`;

/**
 * Shown ONCE when the raw probe proved `data.json` is CORRUPT (present but
 * unparseable — a torn write or a sync conflict). The file was renamed aside
 * (never deleted) and the session starts fresh with writes ENABLED, so recovery is
 * automatic and the damaged bytes stay recoverable at `quarantineName`. Mirrors
 * the tone of {@link ./VaultFileStore VaultFileStore}'s quarantine notice.
 */
const initCorruptQuarantinedNotice = (quarantineName: string): string =>
	"Vicinity Graph's settings file was damaged and couldn't be read, so it was set aside as " +
	`“${quarantineName}” and settings were reset to defaults for a fresh start. ` +
	"Nothing was deleted — your old file is recoverable if you need it.";

/** Real wall-clock pause; injectable so tests retry on the microtask queue instead of waiting. */
const REAL_SLEEP = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Fallback used only by callers (tests) that don't inject the real path; production
 * ({@link main.ts}) always passes the `app.vault.configDir`-derived `data.json` path.
 * Deliberately NOT a `.obsidian`-prefixed literal — the config dir is user-configurable.
 */
const FALLBACK_DATA_JSON_DISPLAY_PATH = "the Vicinity Graph plugin's data.json";

/**
 * Typed owner of the plugin's `data.json`: the truly-global config dials
 * (`globalDepths`, `globalView`, `nodeExclusion`) AND the GLOBAL pinned set —
 * the one docid-keyed map the owner kept here (Obsidian-managed, one cheap
 * in-memory read) when the per-doc/per-main maps (`nodeOverrides`, `localPins`)
 * moved onto the per-file store ({@link ./PerDocStore PerDocStore}; ticket
 * `nid_8f8ey41extajt08zphwwxhnwq_e`).
 *
 * Holds the parsed state in memory after {@link init}; every mutation persists
 * through a serialized write chain (last write wins, no interleaved saveData
 * calls).
 */
export class PluginDataStore {
	private data: PluginData = PersistedShapes.defaultPluginData();
	private readonly writes = new SerialPromiseChain();

	/**
	 * True when {@link init} exhausted every read attempt AND the file is a TRANSIENT
	 * failure (not corruption): memory holds defaults while the user's REAL `data.json`
	 * sits intact and unread on disk. Every mutator persists the whole in-memory object,
	 * so any write let through now would overwrite the user's settings and pins with
	 * defaults — {@link persist} therefore refuses, and the rejection reaches the user
	 * through the settings pipeline's / `runGuarded`'s one failure policy. A CORRUPT file
	 * takes the other branch — it is quarantined and this stays `false`, so the fresh
	 * session writes normally.
	 */
	private protectingUnreadDataJson = false;

	/**
	 * @param notice optional: an init that exhausted its read retries says so ONCE here.
	 * @param sleep injected pause between retries (tests pass an immediate resolve).
	 * @param dataJsonPath the file's REAL vault-relative path (from `app.vault.configDir`,
	 *   never a hardcoded `.obsidian`), shown in the exhausted-reads notice's recovery hint.
	 */
	constructor(
		private readonly port: PluginDataPort,
		private readonly notice?: UserNoticePort,
		private readonly sleep: (ms: number) => Promise<void> = REAL_SLEEP,
		private readonly dataJsonPath: string = FALLBACK_DATA_JSON_DISPLAY_PATH,
	) {}

	/** Loads and defensively parses data.json (first run / malformed → defaults). */
	async init(): Promise<void> {
		this.data = PersistedShapes.parsePluginData(await this.loadRawResiliently());
	}

	/**
	 * The raw `data.json` content, retried on TRANSIENT failure. Obsidian's
	 * `Plugin.loadData` answers three ways (see {@link INIT_LOAD_ATTEMPTS}):
	 * parsed JSON, `null` (no file — a genuine first run, a DEFINITE answer never
	 * retried), or `undefined` (the read/parse FAILED with the file intact on
	 * disk). Only the failure is retried; treating it like a first run is exactly
	 * the silent-defaults bug this guards against — and worse, a later settings
	 * write would then persist those defaults OVER the user's intact file. A port
	 * rejection (the real one never rejects; fakes may) counts as a failed read.
	 * When every attempt fails, {@link recoverAfterExhaustedReads} decides corrupt
	 * vs transient.
	 */
	private async loadRawResiliently(): Promise<unknown> {
		for (let attempt = 1; attempt <= INIT_LOAD_ATTEMPTS; attempt += 1) {
			let raw: unknown = undefined;
			try {
				raw = await this.port.loadData();
			} catch (error: unknown) {
				console.error("vicinity-graph: reading data.json threw", { attempt }, error);
			}
			if (raw !== undefined) {
				return raw;
			}
			if (attempt < INIT_LOAD_ATTEMPTS) {
				await this.sleep(INIT_RETRY_DELAY_MS);
			}
		}
		return this.recoverAfterExhaustedReads();
	}

	/**
	 * Every `loadData` attempt came back `undefined` — the read OR the parse failed,
	 * indistinguishably. Probe the raw bytes to tell the two apart:
	 *
	 * - Bytes present but UNPARSEABLE ⇒ the file is permanently CORRUPT (a torn write
	 *   or a sync conflict), and retrying every session can never fix it. Quarantine it
	 *   (rename aside, never delete) and start FRESH with writes enabled — the one path
	 *   that self-recovers instead of degrading forever behind a manual delete.
	 * - No bytes, bytes that DO parse now, the probe itself failed, OR the file is
	 *   corrupt but the quarantine rename itself failed ⇒ fall back to TRANSIENT
	 *   protection: keep the intact/damaged file on disk and refuse writes so this
	 *   session's defaults never overwrite the user's bytes (the write-protection this
	 *   deliberately preserves). A quarantine that cannot set the corrupt file aside
	 *   MUST NOT enable writes — a later save would then clobber the only recoverable
	 *   copy with defaults; the manual-delete guidance in {@link INIT_LOAD_FAILED_NOTICE}
	 *   is the way back.
	 *
	 * Either way this returns `null` (defaults for the session) and never throws — a
	 * failure here must degrade the plugin, never crash `onload`.
	 */
	private async recoverAfterExhaustedReads(): Promise<unknown> {
		if (await this.isCorruptOnDisk() && (await this.quarantineAndStartFresh())) {
			return null;
		}
		return this.protectAsTransient();
	}

	/**
	 * Sets the corrupt file aside and enables fresh writes; returns `false` (never
	 * throws) when the quarantine rename itself failed — a locked or read-only file —
	 * so the caller falls back to transient protection instead of crashing `onload`.
	 */
	private async quarantineAndStartFresh(): Promise<boolean> {
		let quarantineName: string;
		try {
			quarantineName = await this.port.quarantineData();
		} catch (error: unknown) {
			console.error("vicinity-graph: quarantining corrupt data.json failed; leaving it in place, writes refused", error);
			return false;
		}
		console.warn(
			`vicinity-graph: data.json was corrupt; set aside as [${quarantineName}], starting fresh with writes enabled`,
		);
		this.notice?.show(initCorruptQuarantinedNotice(quarantineName));
		return true;
	}

	/** Runs the session on defaults with writes REFUSED, telling the user once (the way back). */
	private protectAsTransient(): null {
		console.error(
			`vicinity-graph: data.json unreadable after attempts=[${INIT_LOAD_ATTEMPTS}]; running this session on defaults, writes refused`,
		);
		this.notice?.show(initLoadFailedNotice(this.dataJsonPath));
		this.protectingUnreadDataJson = true;
		return null;
	}

	/**
	 * True only when the raw probe reads bytes that FAIL to parse as JSON — the
	 * definite signature of corruption. Absent bytes (`null`), bytes that parse, or a
	 * probe that itself threw all read as NOT-corrupt (transient), because none of
	 * them prove the file is unrecoverably damaged.
	 */
	private async isCorruptOnDisk(): Promise<boolean> {
		let raw: string | null;
		try {
			raw = await this.port.readRawData();
		} catch (error: unknown) {
			console.error("vicinity-graph: raw data.json probe threw", error);
			return false;
		}
		if (raw === null) {
			return false;
		}
		try {
			JSON.parse(raw);
			return false;
		} catch {
			return true;
		}
	}

	globalDepths(): DepthSettings {
		return this.data.globalDepths;
	}

	globalView(): ViewSettings {
		return this.data.globalView;
	}

	pins(): readonly PinnedDocEntry[] {
		return this.data.pins;
	}

	nodeExclusion(): NodeExclusionSettings {
		return this.data.nodeExclusion;
	}

	frontmatterLinks(): FrontmatterLinkSettings {
		return this.data.frontmatterLinks;
	}

	async saveGlobalDepths(globalDepths: DepthSettings): Promise<void> {
		await this.persist({ ...this.data, globalDepths });
	}

	async saveGlobalView(globalView: ViewSettings): Promise<void> {
		await this.persist({ ...this.data, globalView });
	}

	async saveNodeExclusion(nodeExclusion: NodeExclusionSettings): Promise<void> {
		await this.persist({ ...this.data, nodeExclusion });
	}

	async saveFrontmatterLinks(frontmatterLinks: FrontmatterLinkSettings): Promise<void> {
		await this.persist({ ...this.data, frontmatterLinks });
	}

	/** Re-pinning refreshes the timestamp (recency tiebreaker follows the newest pin intent). */
	async addPin(docid: string, pinTimestamp: number): Promise<void> {
		const withoutExisting = this.data.pins.filter((pin) => pin.docid !== docid);
		await this.persist({ ...this.data, pins: [...withoutExisting, { docid, pinTimestamp }] });
	}

	async removePins(docids: readonly string[]): Promise<void> {
		const removed = new Set(docids);
		await this.persist({ ...this.data, pins: this.data.pins.filter((pin) => !removed.has(pin.docid)) });
	}

	/**
	 * Drops the named docs from the GLOBAL pinned set (the only docid-keyed map
	 * still in `data.json`). Deleting a doc is NOT unpinning it, and it spans more
	 * than the pinned set — the per-file facts are dropped by
	 * {@link ./PerDocStore.PerDocStore.forgetDocs}, invoked alongside this by the
	 * live `vault.on('delete')` handler and the orphan sweep. A doc the pinned set
	 * never held is left untouched (vaults delete files the plugin never pinned).
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		const forgotten = new Set(docids);
		const pins = this.data.pins.filter((pin) => !forgotten.has(pin.docid));
		if (pins.length === this.data.pins.length) {
			return;
		}
		await this.persist({ ...this.data, pins });
	}

	/**
	 * In-memory state moves NOW, the disk write is serialised. The chain owns
	 * rejection isolation and caller-visible failure (see {@link SerialPromiseChain}).
	 *
	 * EXCEPT in a session protecting an unread `data.json` (see
	 * {@link protectingUnreadDataJson}): then the write is refused BEFORE memory
	 * moves, so the rebuild the caller's failure policy triggers snaps the screen
	 * back to the store rather than to a value that was never accepted.
	 */
	private persist(updated: PluginData): Promise<void> {
		if (this.protectingUnreadDataJson) {
			return Promise.reject(
				new Error("vicinity-graph: data.json was never read this session; refusing to overwrite it with defaults"),
			);
		}
		this.data = updated;
		// `serializePluginData` encodes the one non-finite field (an ∞ folder-grouping
		// depth) so `saveData`'s JSON.stringify does not silently drop it to `null`.
		return this.writes.run(() => this.port.saveData(serializePluginData(this.data)));
	}
}
