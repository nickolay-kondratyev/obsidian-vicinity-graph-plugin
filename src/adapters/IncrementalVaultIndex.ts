import type { VaultPath } from "../engine";
import { asVaultPath } from "../engine";
import type { MetadataCachePort, VaultFilePort, VaultPort } from "./obsidianPorts";

/**
 * Turns ONE file's raw content into its index entry, or `null` when the file
 * contributes nothing (so no entry is held for it). Supplied by the consumer —
 * together with the {@link VaultScanGate} it is ALL the per-consumer knowledge
 * in the machinery.
 *
 * Pure by contract, and the entry must be derivable from `content` ALONE —
 * `path` is context for diagnostics/logging, never entry data — because
 * {@link IncrementalVaultIndex} re-invokes the parser on every change, relies on
 * REPLACE-WHOLE-ENTRY semantics (no diffing) for correctness, and REKEYS a
 * renamed file's entry without re-parsing ({@link IncrementalVaultIndex.handleFileRenamed}),
 * so a path-dependent entry would go silently stale on rename. (The path a
 * consumer's derived structure needs is the entry's KEY in {@link IncrementalVaultIndex.allEntries},
 * which the rekey does keep fresh.) A throw
 * is absorbed as "no entry" (logged), same policy as an unreadable file. The first
 * consumer is the named-relationships index (`RelationshipStatements.parse` under
 * a thin adapter); the type is generic so future vault-wide content-derived
 * indexes reuse the build/maintain machinery below rather than re-growing it.
 */
export type VaultFileEntryParser<TEntry> = (path: VaultPath, content: string) => TEntry | null;

/**
 * Decides whether the initial scan READS a file at all — the read gate, supplied
 * by the consumer alongside the parser. It must admit every file the consumer's
 * parser could derive an entry from: a false negative silently loses the file for
 * the whole session, a false positive only costs one read. Freshness events are
 * NOT gated (their content is already in hand), so the gate is purely a scan
 * optimisation, never a correctness input. A throw is absorbed as ADMIT (logged)
 * — the safe direction, and unlike the parser's per-file absorption it must never
 * reject the scan: the gate runs before any file is read, so a deterministic
 * throw would re-reject every retry and brick the index for the session.
 */
export type VaultScanGate = (file: VaultFilePort) => boolean;

/**
 * The scan gate for LINK-DERIVED indexes: admit files metadataCache reports any
 * link OR embed for. A parseable named-relationship statement's target run always
 * contains `[[x]]`/`![[x]]`, and `rel::![[x]]` lands in `embeds`, NOT `links`, so
 * gating on links alone would silently skip embed-only files. Files with neither
 * are skipped WITHOUT a byte read.
 *
 * Trusts metadataCache AS OF scan time: a file whose cache is stale or not yet
 * indexed at plugin load is skipped, which is safe only because the freshness
 * path is ungated — when Obsidian (re)indexes the file it fires
 * `metadataCache.on('changed')`, and {@link IncrementalVaultIndex.handleFileChanged}
 * re-parses it then.
 */
export function linksOrEmbedsScanGate(metadataCache: MetadataCachePort): VaultScanGate {
	return (file) => {
		const cache = metadataCache.getFileCache(file);
		return (cache?.links?.length ?? 0) > 0 || (cache?.embeds?.length ?? 0) > 0;
	};
}

/** ~8-16 was the signed-off band; 12 sits mid-range. Overridable for tests. */
export const DEFAULT_SCAN_CONCURRENCY = 12;

/**
 * REUSABLE session-held vault-wide derived-index infrastructure (plan ticket
 * `nid_fg66tanwkoyq3cqs1wdxagn21_e`; infra ticket `nid_82g9goy92k9ciyy64m1r6jofe_e`).
 *
 * Obsidian's metadataCache carries no `::` prefixes (and, in general, no
 * content-derived facts a plugin invents), so the raw markdown must be parsed.
 * This class owns the LIFECYCLE of doing that once per file and keeping it fresh;
 * a consumer supplies only the {@link VaultFileEntryParser} and reads the entries
 * back to build whatever query structure it needs (e.g. a reverse index). The
 * first consumer is the named-relationships index; the machinery is deliberately
 * generic so the next one is a new caller, not an edit here.
 *
 * ## Lifecycle
 *  - **Initial scan** ({@link ensureReady}, idempotent): a bounded-concurrency
 *    ({@link DEFAULT_SCAN_CONCURRENCY}) sweep that reads + parses ONLY the files
 *    the consumer's {@link VaultScanGate} admits (link-derived consumers pass
 *    {@link linksOrEmbedsScanGate}). Content via `vault.cachedRead`. A rejected
 *    scan is NOT memoised — the next {@link ensureReady} retries, so one
 *    transient failure never bricks the index for the session.
 *  - **Never blocks plugin load**: nothing here is awaited in `onload`; graph
 *    builds AWAIT {@link ensureReady} (precedent: async `ObsidianLinkProvider.create`
 *    and the lazy `PerDocStore` warm-up). Calling {@link startEagerly} in `onload`
 *    starts the scan eagerly without blocking; the builder's `await` joins the
 *    SAME promise, so the scan runs exactly once.
 *  - **Freshness** (wired in `main.ts`, beside the existing vault handlers):
 *    {@link handleFileChanged} (Obsidian's `metadataCache.on('changed')` hands the
 *    file's CONTENT to the callback — zero extra reads, just re-parse; file
 *    CREATION needs no fourth handler, metadataCache indexes the new file and
 *    fires 'changed' for it),
 *    {@link handleFileDeleted} (`vault.on('delete')`, sits beside `forgetDocs`),
 *    {@link handleFileRenamed} (`vault.on('rename')` REKEYS old path → new path —
 *    Obsidian rewriting links only fires `changed` on the WRITER files, so the
 *    renamed file's own content may be untouched and its entry would otherwise
 *    stay stale under the old path).
 *  - **Replace-whole-entry, no diffing**: every update re-parses the whole file
 *    and swaps the entry wholesale — trivially correct under any event ordering,
 *    including events racing the initial scan (see {@link settledDuringScan} and
 *    the scan's file-identity guard).
 *  - **Session-held, NEVER persisted**: derived data, same stance as folder
 *    relations — rebuilt from the vault every launch.
 */
export class IncrementalVaultIndex<TEntry> {
	private readonly entries = new Map<VaultPath, TEntry>();
	/** Memoised initial scan; `ensureReady` starts it once and every caller joins it. */
	private scan: Promise<void> | null = null;
	/** True only while the initial scan is in flight — gates {@link settledDuringScan}. */
	private scanning = false;
	/**
	 * Paths a freshness event finalized WHILE the initial scan was in flight. An
	 * event carries the newest truth (its content, or a delete/rename); the scan's
	 * `cachedRead` may have captured an older snapshot before the change and resolve
	 * LATER, so the scan must never write these paths — the event already won.
	 * Cleared when the scan completes.
	 */
	private readonly settledDuringScan = new Set<VaultPath>();

	/**
	 * @param onChanged fired after EVERY mutation (scan completion and each event),
	 *   so a consumer holding a derived structure over the entries can invalidate it
	 *   lazily. Optional — a consumer that reads on demand needs no callback.
	 */
	constructor(
		private readonly vault: VaultPort,
		private readonly scanGate: VaultScanGate,
		private readonly parseEntry: VaultFileEntryParser<TEntry>,
		private readonly onChanged: () => void = () => {},
		private readonly concurrency: number = DEFAULT_SCAN_CONCURRENCY,
	) {}

	/**
	 * Resolve once the initial scan has populated the index. Idempotent: the first
	 * call starts the scan, every later call (and the builder's `await`) joins the
	 * same promise, so the vault is swept exactly once per session — unless the
	 * scan REJECTED, in which case the memo is dropped and the next call retries
	 * (replace-whole-entry makes a re-sweep safe under any interleaving).
	 */
	ensureReady(): Promise<void> {
		if (this.scan === null) {
			this.scan = this.runInitialScan().catch((error: unknown) => {
				this.scan = null;
				throw error;
			});
		}
		return this.scan;
	}

	/**
	 * Fire-and-forget eager start for `onload`: kicks off the initial scan without
	 * blocking AND without an unhandled rejection when the scan fails — a failure
	 * only logs here, because {@link ensureReady} already dropped the memo, so the
	 * next build's `await` retries; nobody else ever observes this promise.
	 */
	startEagerly(): void {
		this.ensureReady().catch((error: unknown) => {
			console.error("vicinity-graph: eager index scan failed; will retry on next build", error);
		});
	}

	/** The parsed entry held for `path`, or `undefined` when the file contributes none. */
	entryFor(path: VaultPath): TEntry | undefined {
		return this.entries.get(path);
	}

	/**
	 * A live READ-ONLY view of every held entry, for a consumer building a derived
	 * structure (e.g. a reverse index). Read fresh after an {@link onChanged}
	 * invalidation — never cache the map across events, its contents move.
	 */
	allEntries(): ReadonlyMap<VaultPath, TEntry> {
		return this.entries;
	}

	/**
	 * Re-parse and REPLACE the entry for a changed file (`metadataCache.on('changed')`
	 * hands `content` straight to the callback — no read). No cache gate here: if the
	 * file lost its links the parser returns `null` and the entry drops, so
	 * correctness needs only the content.
	 */
	handleFileChanged(rawPath: string, content: string): void {
		const path = asVaultPath(rawPath);
		this.markSettledIfScanning(path);
		this.store(path, this.parseSafely(path, content));
		this.onChanged();
	}

	/** Drop the deleted file's entry (`vault.on('delete')`). */
	handleFileDeleted(rawPath: string): void {
		const path = asVaultPath(rawPath);
		this.markSettledIfScanning(path);
		this.entries.delete(path);
		this.onChanged();
	}

	/**
	 * REKEY the renamed file's entry old path → new path (`vault.on('rename')`).
	 * Content is unchanged by a rename and an entry is content-derived by the
	 * {@link VaultFileEntryParser} contract, so the entry stays valid under the new
	 * key; no re-parse. A file with no entry (never indexed) rekeys to nothing.
	 *
	 * Against a racing scan, SETTLEDNESS FOLLOWS THE FILE, not the path name.
	 * Obsidian mutates `TFile.path` to the new path BEFORE firing 'rename', so the
	 * scan's read of this file lands under the NEW path; the new path therefore
	 * takes the INCOMING file's settled state:
	 *  - Old path NOT already settled (no event finalized this file yet): the scan's
	 *    read is as fresh as the rekeyed entry (a rename changes no content), so the
	 *    new path becomes UNSETTLED — even a stale mark left by a PREVIOUS occupant
	 *    (deleted or renamed away mid-scan) is cleared, or the scan would skip a
	 *    never-indexed file renamed onto that path, losing it for the session.
	 *  - Old path ALREADY settled (a {@link handleFileChanged}/delete beat the scan):
	 *    the rekey carries that newer event truth, so the new path is settled too —
	 *    otherwise the scan's stale late read would clobber it under the new key.
	 * The VACATED old path is unsettled either way: its mark described this file,
	 * which no longer answers to that name, and a different file renamed onto it
	 * next deserves its own fresh scan write.
	 */
	handleFileRenamed(rawOldPath: string, rawNewPath: string): void {
		const oldPath = asVaultPath(rawOldPath);
		const newPath = asVaultPath(rawNewPath);
		if (this.scanning) {
			if (this.settledDuringScan.has(oldPath)) {
				this.settledDuringScan.add(newPath);
			} else {
				this.settledDuringScan.delete(newPath);
			}
			this.settledDuringScan.delete(oldPath);
		}
		const entry = this.entries.get(oldPath);
		this.entries.delete(oldPath);
		if (entry !== undefined) {
			this.entries.set(newPath, entry);
		}
		this.onChanged();
	}

	private async runInitialScan(): Promise<void> {
		this.scanning = true;
		try {
			const gated = this.vault.getFiles().filter((file) => this.admittedByGate(file));
			await this.forEachBounded(gated, async (file) => {
				const content = await this.readContent(file);
				if (content === null) {
					return; // Unreadable file: already logged; leave it absent from the index.
				}
				const path = asVaultPath(file.path);
				// An event finalized this path mid-scan — its content is newer than ours.
				if (this.settledDuringScan.has(path)) {
					return;
				}
				// The file no longer answers to this path (deleted mid-scan — a deleted
				// TFile keeps its path — or displaced by a rename): this read is a previous
				// occupant's stale snapshot. Settledness cannot catch it: a file renamed
				// onto the path rightly CLEARED the old occupant's mark so its own read is
				// not skipped. Obsidian holds ONE stable TFile instance per file (mutated
				// in place), so an identity check against the vault's current occupant is
				// exact; the path's truth is covered by events + that occupant's own read.
				if (this.vault.getFileByPath(path) !== file) {
					return;
				}
				this.store(path, this.parseSafely(path, content));
			});
		} finally {
			this.scanning = false;
			this.settledDuringScan.clear();
			this.onChanged();
		}
	}

	/**
	 * Invoke the consumer's scan gate, absorbing a throw as ADMIT (see
	 * {@link VaultScanGate}): a refused file is lost for the session, an admitted
	 * one costs a read — and the gate runs before any file is read, so letting the
	 * throw reject the scan would deterministically re-reject every retry.
	 */
	private admittedByGate(file: VaultFilePort): boolean {
		try {
			return this.scanGate(file);
		} catch (error: unknown) {
			console.error("vicinity-graph: index scan gate threw; admitting file", file.path, error);
			return true;
		}
	}

	private async readContent(file: VaultFilePort): Promise<string | null> {
		try {
			return await this.vault.cachedRead(file);
		} catch (error: unknown) {
			// One unreadable file must not sink the whole scan (background work, no
			// user-facing action to report against).
			console.error("vicinity-graph: index scan could not read file", file.path, error);
			return null;
		}
	}

	/**
	 * Invoke the consumer's parser, absorbing a throw as "no entry" — same policy
	 * as an unreadable file: one file the parser chokes on must neither sink the
	 * whole scan nor escape into Obsidian's event dispatcher.
	 */
	private parseSafely(path: VaultPath, content: string): TEntry | null {
		try {
			return this.parseEntry(path, content);
		} catch (error: unknown) {
			console.error("vicinity-graph: index could not parse file", path, error);
			return null;
		}
	}

	/** Store the parsed entry, or drop the file when the parser found nothing. */
	private store(path: VaultPath, entry: TEntry | null): void {
		if (entry === null) {
			this.entries.delete(path);
		} else {
			this.entries.set(path, entry);
		}
	}

	private markSettledIfScanning(path: VaultPath): void {
		if (this.scanning) {
			this.settledDuringScan.add(path);
		}
	}

	/**
	 * Run `task` over `items` with at most {@link concurrency} in flight — a fixed
	 * pool of workers pulling from a shared cursor, so slow reads never let the
	 * in-flight count exceed the bound (unlike `Promise.all` over the whole list).
	 */
	private async forEachBounded(
		items: readonly VaultFilePort[],
		task: (item: VaultFilePort) => Promise<void>,
	): Promise<void> {
		let cursor = 0;
		const worker = async (): Promise<void> => {
			for (;;) {
				const index = cursor;
				cursor += 1;
				const item = items[index];
				if (item === undefined) {
					return;
				}
				await task(item);
			}
		};
		const poolSize = Math.min(Math.max(1, this.concurrency), items.length);
		const workers: Promise<void>[] = [];
		for (let i = 0; i < poolSize; i += 1) {
			workers.push(worker());
		}
		await Promise.all(workers);
	}
}
