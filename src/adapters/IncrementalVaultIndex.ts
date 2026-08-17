import type { VaultPath } from "../engine";
import { asVaultPath } from "../engine";
import type { MetadataCachePort, VaultFilePort, VaultPort } from "./obsidianPorts";

/**
 * Turns ONE file's raw content into its index entry, or `null` when the file
 * contributes nothing (so no entry is held for it). Supplied by the consumer —
 * this is the ONLY per-consumer knowledge in the whole machinery.
 *
 * Pure by contract: given the same `(path, content)` it must return the same
 * entry, because {@link IncrementalVaultIndex} re-invokes it on every change and
 * relies on REPLACE-WHOLE-ENTRY semantics (no diffing) for correctness. The first
 * consumer is the named-relationships index (`RelationshipStatements.parse` under
 * a thin adapter); the type is generic so future vault-wide content-derived
 * indexes reuse the build/maintain machinery below rather than re-growing it.
 */
export type VaultFileEntryParser<TEntry> = (path: VaultPath, content: string) => TEntry | null;

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
 *    metadataCache says carry links OR embeds — a parseable statement's target
 *    run always contains `[[x]]`/`![[x]]`, and `rel::![[x]]` lands in `embeds`,
 *    NOT `links`, so gating on links alone would silently skip embed-only files.
 *    Files with neither are skipped WITHOUT a byte read. Content via
 *    `vault.cachedRead`.
 *  - **Never blocks plugin load**: nothing here is awaited in `onload`; graph
 *    builds AWAIT {@link ensureReady} (precedent: async `ObsidianLinkProvider.create`
 *    and the lazy `PerDocStore` warm-up). Firing `void index.ensureReady()` in
 *    `onload` starts the scan eagerly without blocking; the builder's `await`
 *    joins the SAME promise, so the scan runs exactly once.
 *  - **Freshness** (wired in `main.ts`, beside the existing vault handlers):
 *    {@link handleFileChanged} (Obsidian's `metadataCache.on('changed')` hands the
 *    file's CONTENT to the callback — zero extra reads, just re-parse),
 *    {@link handleFileDeleted} (`vault.on('delete')`, sits beside `forgetDocs`),
 *    {@link handleFileRenamed} (`vault.on('rename')` REKEYS old path → new path —
 *    Obsidian rewriting links only fires `changed` on the WRITER files, so the
 *    renamed file's own content may be untouched and its entry would otherwise
 *    stay stale under the old path).
 *  - **Replace-whole-entry, no diffing**: every update re-parses the whole file
 *    and swaps the entry wholesale — trivially correct under any event ordering,
 *    including events racing the initial scan (see {@link settledDuringScan}).
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
		private readonly metadataCache: MetadataCachePort,
		private readonly parseEntry: VaultFileEntryParser<TEntry>,
		private readonly onChanged: () => void = () => {},
		private readonly concurrency: number = DEFAULT_SCAN_CONCURRENCY,
	) {}

	/**
	 * Resolve once the initial scan has populated the index. Idempotent: the first
	 * call starts the scan, every later call (and the builder's `await`) joins the
	 * same promise, so the vault is swept exactly once per session.
	 */
	ensureReady(): Promise<void> {
		if (this.scan === null) {
			this.scan = this.runInitialScan();
		}
		return this.scan;
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
		this.store(path, this.parseEntry(path, content));
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
	 * Content is unchanged by a rename, so the entry stays valid under the new key;
	 * no re-parse. A file with no entry (never indexed) rekeys to nothing.
	 */
	handleFileRenamed(rawOldPath: string, rawNewPath: string): void {
		const oldPath = asVaultPath(rawOldPath);
		const newPath = asVaultPath(rawNewPath);
		this.markSettledIfScanning(oldPath);
		this.markSettledIfScanning(newPath);
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
			const gated = this.vault.getFiles().filter((file) => this.hasLinksOrEmbeds(file));
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
				this.store(path, this.parseEntry(path, content));
			});
		} finally {
			this.scanning = false;
			this.settledDuringScan.clear();
			this.onChanged();
		}
	}

	/** Whether metadataCache reports any link OR embed for this file — the read gate. */
	private hasLinksOrEmbeds(file: VaultFilePort): boolean {
		const cache = this.metadataCache.getFileCache(file);
		return (cache?.links?.length ?? 0) > 0 || (cache?.embeds?.length ?? 0) > 0;
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
