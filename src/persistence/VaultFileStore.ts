import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { UserNoticePort } from "../view/viewPorts";
import { formatQuarantineTimestamp } from "./quarantineTimestamp";
import type { VaultFsPort } from "./vaultFsPort";

/**
 * The version key every file's payload is wrapped under on disk: a file is
 * exactly `{ "v1": <payload> }`. Dispatching on WHICH `vN` key is present (rather
 * than a numeric `version` field inside the payload) lets a future NON-additive
 * shape (v2) be told apart from v1 instead of guessed — an unrecognised key is a
 * quarantine, not a silent misread.
 */
const CURRENT_VERSION_KEY = "v1";

/**
 * The version keys a read will accept. Only `v1` today; adding `v2` is this one
 * edit plus a branch in {@link VaultFileStore.unwrap} to map it onto the payload.
 */
const SUPPORTED_VERSION_KEYS: readonly string[] = [CURRENT_VERSION_KEY];

/** Infix that marks a quarantined file — excluded from {@link VaultFileStore.listKeys}. */
const QUARANTINE_INFIX = "_malformed_";

/** Suffix of the transient file an atomic write renames FROM — never read as a key. */
const TMP_SUFFIX = ".tmp";

/** Outcome of unwrapping a file's text — a valid payload, or "cannot read as data". */
type UnwrapResult = { readonly ok: true; readonly payload: unknown } | { readonly ok: false };

/**
 * A domain-agnostic store of versioned JSON files under ONE vault directory
 * subtree (e.g. `.plugin_data/vicinity_graph/`), sitting on a {@link VaultFsPort}
 * the way {@link ./PluginDataStore PluginDataStore} sits on `PluginDataPort`. It
 * knows NOTHING about pins/overrides — it is `<relPath> ↔ <parsed payload>`; the
 * domain layer (a dependent ticket) supplies the payload shapes.
 *
 * Living OUTSIDE `.obsidian/` (unlike `data.json`) it syncs as vault content, so
 * per-file bytes WILL meet git/Syncthing merge conflicts. Three properties make
 * that survivable:
 *
 * - **Versioned envelope** — {@link CURRENT_VERSION_KEY} tells a future shape from
 *   today's rather than guessing.
 * - **Atomic write** — write a `.tmp` sibling then rename over the target, so a
 *   crash or a concurrent read never sees a half-written file.
 * - **Quarantine, never delete** — an unreadable file (conflict markers,
 *   truncation, unknown version key) is renamed aside and treated as ABSENT; the
 *   caller falls back to defaults and the user's bytes are recoverable.
 *
 * Writes to the SAME key are serialised (last write wins, in order) on a per-key
 * {@link SerialPromiseChain}; different keys write in parallel — the multi-file
 * analogue of the single global chain `PluginDataStore` uses.
 */
export class VaultFileStore {
	/** One serialisation chain PER relPath, so a slow write to X never blocks Y. */
	private readonly chains = new Map<string, SerialPromiseChain>();

	/**
	 * @param rootDir vault-root-relative directory this store owns (no trailing slash).
	 * @param clock injected epoch-millis source — the ONLY time source; never `Date.now()` directly.
	 * @param notice optional: a quarantine emits ONE message here naming the set-aside file.
	 */
	constructor(
		private readonly rootDir: string,
		private readonly fs: VaultFsPort,
		private readonly clock: () => number,
		private readonly notice?: UserNoticePort,
	) {}

	/**
	 * The unwrapped payload of the file at `relPath`, or `null` when it is absent
	 * OR unreadable (in which case it is quarantined as a side effect). A `null`
	 * return is "no data here, use your default" — indistinguishable, on purpose,
	 * between never-written and set-aside.
	 */
	async read(relPath: string): Promise<unknown | null> {
		const fullPath = this.fullPath(relPath);
		if (!(await this.fs.exists(fullPath))) {
			return null;
		}
		const result = this.unwrap(await this.readText(fullPath));
		if (!result.ok) {
			await this.quarantine(fullPath);
			return null;
		}
		return result.payload;
	}

	/**
	 * Wraps `payload` as `{ v1: payload }` and writes it ATOMICALLY: `mkdir -p` the
	 * parent, write a `.tmp` sibling, then rename over the target. Keys are sorted
	 * on serialise so a human diff/merge of these vault-content files is minimal and
	 * stable. Serialised behind any in-flight write to the SAME key.
	 */
	async write(relPath: string, payload: unknown): Promise<void> {
		await this.chainFor(relPath).run(() => this.writeNow(relPath, payload));
	}

	/** Removes the file at `relPath` (a no-op if already gone); serialised on the key's chain. */
	async remove(relPath: string): Promise<void> {
		await this.chainFor(relPath).run(async () => {
			const fullPath = this.fullPath(relPath);
			if (await this.fs.exists(fullPath)) {
				await this.fs.remove(fullPath);
			}
		});
	}

	exists(relPath: string): Promise<boolean> {
		return this.fs.exists(this.fullPath(relPath));
	}

	/**
	 * The relPath keys of the IMMEDIATE child files of `subDir` (e.g. `per_file`) —
	 * quarantined siblings (`*_malformed_*`) and transient `*.tmp` files excluded,
	 * so a caller sees only live keys it could `read`. Empty when the dir is absent.
	 * Used by the dependent ticket's sweep to reconcile stored ids against live docids.
	 */
	async listKeys(subDir: string): Promise<string[]> {
		const fullDir = this.fullPath(subDir);
		if (!(await this.fs.exists(fullDir))) {
			return [];
		}
		const { files } = await this.fs.list(fullDir);
		const rootPrefix = `${this.rootDir}/`;
		return files
			.map((filePath) => (filePath.startsWith(rootPrefix) ? filePath.slice(rootPrefix.length) : filePath))
			.filter((relPath) => !VaultFileStore.isQuarantine(relPath) && !relPath.endsWith(TMP_SUFFIX));
	}

	private async writeNow(relPath: string, payload: unknown): Promise<void> {
		const fullPath = this.fullPath(relPath);
		const tmpPath = `${fullPath}${TMP_SUFFIX}`;
		await this.ensureDir(VaultFileStore.dirOf(fullPath));
		await this.fs.write(tmpPath, VaultFileStore.serialize(payload));
		// Rename OVER the target. WHY-NOT rename directly onto an existing file: the
		// platform adapters disagree on whether rename can overwrite (POSIX yes,
		// Windows/Capacitor no), so remove-then-rename is the portable path. The
		// window where neither exists is tiny AND the bytes still live in `.tmp`,
		// so a crash there loses nothing recoverable.
		if (await this.fs.exists(fullPath)) {
			await this.fs.remove(fullPath);
		}
		await this.fs.rename(tmpPath, fullPath);
	}

	/**
	 * Renames an unreadable file aside to `<base>_malformed_<ts><ext>` (a SIBLING,
	 * collision-safe via a `_2`, `_3`, … suffix) and tells the user ONCE. Never
	 * deletes: a quarantine is recoverable, a delete is not.
	 */
	private async quarantine(fullPath: string): Promise<void> {
		const quarantinePath = await this.freeQuarantinePath(fullPath);
		await this.fs.rename(fullPath, quarantinePath);
		const message = VaultFileStore.quarantineNotice(fullPath, quarantinePath);
		console.warn(`[vicinity-graph] ${message}`);
		this.notice?.show(message);
	}

	/** The first free `<base>_malformed_<ts>[_n]<ext>` sibling of `fullPath`. */
	private async freeQuarantinePath(fullPath: string): Promise<string> {
		const dir = VaultFileStore.dirOf(fullPath);
		const { base, ext } = VaultFileStore.splitExt(VaultFileStore.nameOf(fullPath));
		const stamped = `${base}${QUARANTINE_INFIX}${formatQuarantineTimestamp(this.clock())}`;
		for (let attempt = 1; ; attempt++) {
			const suffix = attempt === 1 ? "" : `_${attempt}`;
			const candidate = `${dir}/${stamped}${suffix}${ext}`;
			if (!(await this.fs.exists(candidate))) {
				return candidate;
			}
		}
	}

	private async readText(fullPath: string): Promise<string | null> {
		try {
			return await this.fs.read(fullPath);
		} catch {
			// A file that `exists` reported present but `read` rejects for (a transient
			// lock, a vanished-mid-read file) is treated as unreadable, not crashed.
			return null;
		}
	}

	/**
	 * Parses `text` and dispatches on its version key. `null` text (unreadable),
	 * non-JSON, a non-object, or an object with NO supported version key all fail —
	 * the caller quarantines. Otherwise the matched key's value is the payload.
	 */
	private unwrap(text: string | null): UnwrapResult {
		if (text === null) {
			return { ok: false };
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return { ok: false };
		}
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { ok: false };
		}
		const envelope = parsed as Record<string, unknown>;
		const versionKey = SUPPORTED_VERSION_KEYS.find((key) => key in envelope);
		if (versionKey === undefined) {
			return { ok: false };
		}
		return { ok: true, payload: envelope[versionKey] };
	}

	private chainFor(relPath: string): SerialPromiseChain {
		const existing = this.chains.get(relPath);
		if (existing !== undefined) {
			return existing;
		}
		const chain = new SerialPromiseChain();
		this.chains.set(relPath, chain);
		return chain;
	}

	/** `mkdir -p`: each cumulative prefix, idempotent (the port swallows "already exists"). */
	private async ensureDir(dir: string): Promise<void> {
		if (dir === "") {
			return;
		}
		const segments = dir.split("/");
		let prefix = "";
		for (const segment of segments) {
			prefix = prefix === "" ? segment : `${prefix}/${segment}`;
			await this.fs.mkdir(prefix);
		}
	}

	private fullPath(relPath: string): string {
		return `${this.rootDir}/${relPath}`;
	}

	/** `{ v1: payload }` with keys sorted recursively — deterministic, diff-stable output. */
	private static serialize(payload: unknown): string {
		return JSON.stringify(VaultFileStore.withSortedKeys({ [CURRENT_VERSION_KEY]: payload }), null, 2);
	}

	/** Deep copy with every object's keys in sorted order (arrays keep their order). */
	private static withSortedKeys(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value.map((element) => VaultFileStore.withSortedKeys(element));
		}
		if (value !== null && typeof value === "object") {
			const sorted: Record<string, unknown> = {};
			for (const key of Object.keys(value as Record<string, unknown>).sort()) {
				sorted[key] = VaultFileStore.withSortedKeys((value as Record<string, unknown>)[key]);
			}
			return sorted;
		}
		return value;
	}

	private static isQuarantine(path: string): boolean {
		return VaultFileStore.nameOf(path).includes(QUARANTINE_INFIX);
	}

	private static dirOf(path: string): string {
		const slash = path.lastIndexOf("/");
		return slash === -1 ? "" : path.slice(0, slash);
	}

	private static nameOf(path: string): string {
		const slash = path.lastIndexOf("/");
		return slash === -1 ? path : path.slice(slash + 1);
	}

	/** Splits a filename into `base` + `ext` (leading dot kept); a dotfile has no ext. */
	private static splitExt(name: string): { base: string; ext: string } {
		const dot = name.lastIndexOf(".");
		return dot <= 0 ? { base: name, ext: "" } : { base: name.slice(0, dot), ext: name.slice(dot) };
	}

	private static quarantineNotice(fullPath: string, quarantinePath: string): string {
		return `Vicinity graph set aside “${fullPath}” — it couldn't be read (likely a sync/merge conflict) and was renamed to “${VaultFileStore.nameOf(quarantinePath)}”. Your data is safe and nothing was deleted; delete or merge the set-aside file by hand.`;
	}
}
