import type { VaultPath } from "../engine";
import { asVaultPath, parseIdRefFields } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

/**
 * The frontmatter property stable-ids-for-obsidian writes each note's docid into
 * (see its `FrontmatterDocIdStore`: "the id lives in the YAML frontmatter under
 * the 'id' key"). This feature READS that field only; stable-ids stays its sole
 * writer.
 */
const FRONTMATTER_ID_PROPERTY = "id";

/**
 * Cache-only reverse index behind the frontmatter-id links feature (part 2,
 * ticket `nid_phu0llxhfptse000j66ezrhh3_e`; plan `nid_sjojyvd55emyry45qynphei7o_e`).
 *
 * Two maps, both built in ONE pass over the vault's markdown files reading only
 * `metadataCache.getFileCache().frontmatter` — NEVER a vault file read:
 * - {@link ownerByIdMap}: `id` → the note that OWNS it (its `id:` frontmatter).
 *   A duplicate id claim resolves deterministically to the lexicographically
 *   smallest path (KISS, locked decision).
 * - {@link referrersByIdMap}: referenced-id → the notes referencing it through the
 *   CONFIGURED fields (the `idRefFields` setting), keyed by the raw referenced id.
 *
 * Query-time resolution (never the maps alone) turns those into edges: an
 * outgoing id-ref reads the source's configured fields and resolves each id
 * through {@link ownerByIdMap}; an incoming query looks the note's OWN id up in
 * {@link referrersByIdMap} — but only when the note actually owns that id (a
 * duplicate-id loser owns nothing, so no phantom incoming edge). Self-references
 * are dropped at query time in both directions.
 *
 * Lifecycle mirrors {@link import("../persistence/PerDocStore").PerDocStore}'s
 * lazy warm: {@link ensureBuilt} builds on the first graph build and is a no-op
 * afterwards, until {@link markStale} (fired by `metadataCache` 'changed' and
 * vault delete/rename in `main.ts`) or a change to the configured field list
 * forces a rebuild. An EMPTY configured field list leaves the index inert — the
 * maps stay empty and every query answers nothing, so the feature is fully off
 * at zero cost.
 */
export class FrontmatterIdIndex {
	/** id → owning note path. Duplicate claims resolve to the smallest path. */
	private readonly ownerByIdMap = new Map<string, string>();
	/** referenced-id → the note paths referencing it via the configured fields. */
	private readonly referrersByIdMap = new Map<string, Set<string>>();
	private built = false;
	/** The parsed field list the current maps were built from — a change forces a rebuild. */
	private builtFields: readonly string[] = [];

	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		/** Supplies the raw `idRefFields` setting string; parsed here through the one canonical parser. */
		private readonly rawIdRefFields: () => string,
	) {}

	/**
	 * Invalidate the index so the next {@link ensureBuilt} rebuilds. Cheap and
	 * idempotent: many `metadataCache` events between two graph builds collapse to
	 * ONE rebuild on the next build.
	 */
	markStale(): void {
		this.built = false;
	}

	/**
	 * Build the index if it is stale, never built, or the configured field list has
	 * changed since it was built. Synchronous — a pure walk of the already-loaded
	 * metadata cache. Callers invoke it once per graph build (via
	 * `ObsidianLinkProvider.create`), so a settings change is picked up on the next
	 * build without a bespoke settings-change subscription.
	 */
	ensureBuilt(): void {
		const fields = parseIdRefFields(this.rawIdRefFields());
		if (this.built && sameFields(fields, this.builtFields)) {
			return;
		}
		this.rebuild(fields);
	}

	/**
	 * Resolved id-ref targets of `sourcePath`, deduplicated and with self excluded —
	 * the outgoing edges this source contributes. Empty when the feature is off or
	 * the source references nothing that resolves.
	 */
	resolvedTargets(sourcePath: VaultPath): readonly VaultPath[] {
		const owners = this.resolvedOwnersOf(sourcePath);
		if (owners.length === 0) {
			return [];
		}
		const targets: VaultPath[] = [];
		const seen = new Set<string>();
		for (const owner of owners) {
			if (owner === sourcePath || seen.has(owner)) {
				continue; // Skip self-references and duplicates across multiple fields.
			}
			seen.add(owner);
			targets.push(asVaultPath(owner));
		}
		return targets;
	}

	/**
	 * The notes referencing `ownerPath`'s own id through a configured field — the
	 * incoming edges. Empty unless `ownerPath` actually OWNS its `id` (a duplicate-id
	 * loser owns nothing here) and self is always excluded.
	 */
	referrersOf(ownerPath: VaultPath): readonly VaultPath[] {
		const ownId = this.ownedIdOf(ownerPath);
		if (ownId === undefined) {
			return [];
		}
		const referrers = this.referrersByIdMap.get(ownId);
		if (referrers === undefined) {
			return [];
		}
		const sources: VaultPath[] = [];
		for (const source of referrers) {
			if (source !== ownerPath) {
				sources.push(asVaultPath(source));
			}
		}
		return sources;
	}

	/**
	 * How many configured-field id-ref VALUES in `source` resolve to `target` — the
	 * occurrence count so an id-ref edge's badge stays truthful. Counts multiplicity
	 * (a target referenced from two fields, or twice in one list, counts twice),
	 * matching how {@link import("./obsidianPorts").MetadataCachePort.resolvedLinks}
	 * counts wikilinks.
	 */
	occurrenceCount(source: VaultPath, target: VaultPath): number {
		let count = 0;
		for (const owner of this.resolvedOwnersOf(source)) {
			if (owner === target) {
				count += 1;
			}
		}
		return count;
	}

	/**
	 * The owner paths `sourcePath`'s configured-field values resolve to, as a
	 * MULTISET (self included, unresolved dropped) read fresh from the cache. Both
	 * the deduped {@link resolvedTargets} and the {@link occurrenceCount} multiplicity
	 * derive from this one read.
	 */
	private resolvedOwnersOf(sourcePath: VaultPath): readonly string[] {
		this.ensureBuilt();
		if (this.builtFields.length === 0) {
			return []; // Feature off — no configured fields to read.
		}
		const frontmatter = this.frontmatterOf(sourcePath);
		if (frontmatter === undefined) {
			return [];
		}
		const owners: string[] = [];
		for (const field of this.builtFields) {
			for (const raw of stringValuesOf(frontmatter[field])) {
				const id = raw.trim();
				if (id.length === 0) {
					continue;
				}
				const owner = this.ownerByIdMap.get(id);
				if (owner !== undefined) {
					owners.push(owner);
				}
			}
		}
		return owners;
	}

	/** The id `ownerPath` owns, or `undefined` when it declares none or lost a duplicate claim. */
	private ownedIdOf(ownerPath: VaultPath): string | undefined {
		const frontmatter = this.frontmatterOf(ownerPath);
		const id = idValueOf(frontmatter);
		if (id === undefined || this.ownerByIdMap.get(id) !== ownerPath) {
			return undefined;
		}
		return id;
	}

	private frontmatterOf(path: VaultPath): Readonly<Record<string, unknown>> | undefined {
		this.ensureBuilt();
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return undefined;
		}
		return this.metadataCache.getFileCache(file)?.frontmatter;
	}

	private rebuild(fields: readonly string[]): void {
		this.ownerByIdMap.clear();
		this.referrersByIdMap.clear();
		this.builtFields = fields;
		this.built = true;
		if (fields.length === 0) {
			return; // Feature off: inert index, nothing walked.
		}
		// Sorted so the duplicate-id winner is deterministic regardless of the order
		// `getFiles` happens to return, and referrer sets read in a stable order.
		const markdownFiles = this.vault
			.getFiles()
			.filter((file) => FileKinds.isMarkdownPath(file.path))
			.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
		for (const file of markdownFiles) {
			const frontmatter = this.metadataCache.getFileCache(file)?.frontmatter;
			if (frontmatter === undefined) {
				continue;
			}
			this.indexOwner(file.path, frontmatter);
			this.indexReferrers(file.path, fields, frontmatter);
		}
	}

	private indexOwner(path: string, frontmatter: Readonly<Record<string, unknown>>): void {
		const id = idValueOf(frontmatter);
		if (id === undefined) {
			return;
		}
		const existing = this.ownerByIdMap.get(id);
		// Lexicographically smallest path wins a duplicate id claim (KISS determinism).
		if (existing === undefined || path < existing) {
			this.ownerByIdMap.set(id, path);
		}
	}

	private indexReferrers(
		path: string,
		fields: readonly string[],
		frontmatter: Readonly<Record<string, unknown>>,
	): void {
		for (const field of fields) {
			for (const raw of stringValuesOf(frontmatter[field])) {
				const id = raw.trim();
				if (id.length === 0) {
					continue;
				}
				const referrers = this.referrersByIdMap.get(id);
				if (referrers === undefined) {
					this.referrersByIdMap.set(id, new Set([path]));
				} else {
					referrers.add(path);
				}
			}
		}
	}
}

/** The trimmed non-empty string `id` of a frontmatter block, or `undefined`. */
function idValueOf(frontmatter: Readonly<Record<string, unknown>> | undefined): string | undefined {
	if (frontmatter === undefined) {
		return undefined;
	}
	const raw = frontmatter[FRONTMATTER_ID_PROPERTY];
	if (typeof raw !== "string") {
		return undefined; // Numbers/objects are not ids we index (locked: strings only).
	}
	const id = raw.trim();
	return id.length === 0 ? undefined : id;
}

/**
 * The STRING values of a frontmatter field, accepting both a scalar
 * (`deps: note-id`) and a list (`deps: [a, b]`), keeping only strings — numbers,
 * objects and nested lists are skipped (locked: strings only). Quoted YAML
 * strings arrive already unquoted from the cache.
 */
function stringValuesOf(value: unknown): readonly string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === "string");
	}
	return [];
}

/** Same field names in the same order — a change means the referrer half must rebuild. */
function sameFields(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((name, index) => name === right[index]);
}
