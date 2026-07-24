import type { AttachmentRef, FileMetadata, LinkProvider, OutlineEntry, VaultPath } from "../engine";
import { asFolderPath, asVaultPath } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { BacklinksAdapter } from "./BacklinksAdapter";
import type { OrderedReference } from "./ReferenceOrder";
import { ReferenceOrder } from "./ReferenceOrder";
import type { CanvasCapability } from "./CanvasCapability";
import { CanvasCapabilityDetector } from "./CanvasCapability";
import type { CanvasParseCache } from "./CanvasParseCache";
import type { CachedMetadataPort, MetadataCachePort, VaultFilePort, VaultPort } from "./obsidianPorts";

/** Kept local: canvas capability detection is adapter-specific knowledge, not a shared file kind. */
const CANVAS_EXTENSION = "canvas";
/** Obsidian reports "/" as the parent path of vault-root files; the engine's root folder is "". */
const OBSIDIAN_ROOT_FOLDER = "/";
/** Display-title frontmatter properties, in precedence order (step-05 human decision). */
const FRONTMATTER_TITLE_PROPERTIES = ["title", "name"] as const;

/**
 * The real {@link LinkProvider} over Obsidian's metadata cache (step-03).
 *
 * Async construction, sync queries (binding decision, step-02 CLARIFICATION
 * Q2): {@link create} performs everything that cannot be answered
 * synchronously — reading `.canvas` files for the fallback parser — and
 * detects per-install capabilities ONCE. Queries then answer synchronously
 * against the live metadata cache (`getFileCache`, `resolvedLinks` and
 * `getBacklinksForFile` are all sync at runtime), so a provider never holds a
 * stale copy of markdown links.
 *
 * Incoming links use `getBacklinksForFile` per visited node — bounded by the
 * node cap, not vault size — with a resolvedLinks-inversion fallback when the
 * undocumented API is absent or answers in an unrecognized shape
 * (CLARIFICATION Q1).
 */
export class ObsidianLinkProvider implements LinkProvider {
	/** Lazily/eagerly built inversion of `resolvedLinks`: target path → source paths. */
	private invertedIncoming: ReadonlyMap<string, readonly string[]> | null = null;

	private constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
		readonly canvasCapability: CanvasCapability,
		/** Only populated in fallback mode: canvas path → ordered resolved-or-not file paths. */
		private readonly canvasOutgoingByPath: ReadonlyMap<string, readonly string[]>,
		/** Only populated in fallback mode: target path → canvas paths referencing it. */
		private readonly canvasIncomingByPath: ReadonlyMap<string, readonly string[]>,
		backlinksAvailable: boolean,
	) {
		if (!backlinksAvailable) {
			// Q1 fallback: no backlinks API on this install — invert once, up front.
			this.invertedIncoming = this.invertResolvedLinks();
		}
	}

	static async create(
		vault: VaultPort,
		metadataCache: MetadataCachePort,
		canvasParseCache: CanvasParseCache,
	): Promise<ObsidianLinkProvider> {
		const capability = CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks));
		const canvasOutgoing = new Map<string, readonly string[]>();
		const canvasIncoming = new Map<string, string[]>();
		if (capability === "fallback-required") {
			for (const file of vault.getFiles()) {
				if (file.extension !== CANVAS_EXTENSION) {
					continue;
				}
				const filePaths = await canvasParseCache.filePathsOf(vault, file);
				canvasOutgoing.set(file.path, filePaths);
				for (const target of new Set(filePaths)) {
					appendToMultimap(canvasIncoming, target, file.path);
				}
			}
		}
		return new ObsidianLinkProvider(
			vault,
			metadataCache,
			capability,
			canvasOutgoing,
			canvasIncoming,
			BacklinksAdapter.isAvailable(metadataCache),
		);
	}

	getOutgoingLinks(path: VaultPath): readonly VaultPath[] {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return [];
		}
		const references = orderedReferencesOf(file, this.metadataCache.getFileCache(file));
		return this.outgoingPathsOf(file, references).map(asVaultPath);
	}

	getIncomingLinks(path: VaultPath): readonly VaultPath[] {
		const sources = this.backlinkSources(path);
		// Fallback-parsed canvas links exist nowhere in the metadata cache — merge them in.
		const canvasSources = this.canvasIncomingByPath.get(path) ?? [];
		return dedupe([...sources, ...canvasSources]).map(asVaultPath);
	}

	getLinkCount(source: VaultPath, target: VaultPath): number {
		const file = this.vault.getFileByPath(source);
		if (file !== null && file.extension === CANVAS_EXTENSION && this.canvasCapability === "fallback-required") {
			// Fallback-parsed canvas links exist nowhere in resolvedLinks — count occurrences.
			let count = 0;
			for (const parsed of this.canvasOutgoingByPath.get(source) ?? []) {
				if (parsed === target) {
					count += 1;
				}
			}
			return count;
		}
		// resolvedLinks is Obsidian's own source → target → link-count map.
		return this.metadataCache.resolvedLinks[source]?.[target] ?? 0;
	}

	getFileMetadata(path: VaultPath): FileMetadata | undefined {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return undefined;
		}
		// One cache read serves the title, the outline and the outgoing references
		// (they ask the same `getFileCache` question about the same file), and the
		// reference ORDERING is derived once here for the same reason: the outline's
		// image rule and the attachment resolution below read the same sorted array.
		const cache = this.metadataCache.getFileCache(file);
		const references = orderedReferencesOf(file, cache);
		return {
			folder: asFolderPath(engineFolderOf(file)),
			sizeBytes: file.stat.size,
			frontmatterTitle: frontmatterTitleOf(file, cache),
			isNodeBearing: FileKinds.isNodeBearingPath(file.path),
			attachments: this.attachmentsOf(file, references),
			outline: this.outlineOf(file, cache, references),
		};
	}

	/**
	 * The note's heading outline, or EMPTY when the note offers none: not
	 * outline-bearing (canvas, `*.excalidraw.md`), no headings, or its first
	 * IMAGE sits before its first heading — the documented "show the picture
	 * instead" escape hatch. Only the adapter can see document offsets, so the
	 * whole rule lives here (see `FileMetadata.outline`).
	 */
	private outlineOf(
		file: VaultFilePort,
		cache: CachedMetadataPort | null,
		references: readonly OrderedReference[] | null,
	): readonly OutlineEntry[] {
		if (!FileKinds.isOutlineBearingPath(file.path) || cache === null) {
			return [];
		}
		const headings = cache.headings ?? [];
		const firstHeading = headings[0];
		if (firstHeading === undefined) {
			return [];
		}
		// `references` is null only when the metadata cache cannot order this file's
		// links, and then nothing is KNOWN to sit above the first heading.
		const firstHeadingOffset = firstHeading.position.start.offset;
		if (references !== null && this.referencesImageAbove(firstHeadingOffset, file.path, references)) {
			return []; // The image wins.
		}
		// Obsidian's `headings` is already in document order — never re-sorted.
		return headings.map((heading) => ({ rawText: heading.heading, level: heading.level }));
	}

	/**
	 * Whether the note references an IMAGE above `offsetLimit` — the outline rule
	 * asked directly ("is there an image before the first heading?").
	 *
	 * RESOLVED references only (the same resolution `attachments`/`firstImagePath`
	 * use), so an unresolvable `![[missing.png]]` cannot suppress the outline while
	 * producing no thumbnail — a silently blank node. `references` arrive ascending
	 * by offset, so the scan stops at the limit rather than resolving the whole
	 * file: only the references ABOVE the first heading are resolved here, and
	 * `attachments` (which resolves all of them) stays the single full pass.
	 */
	private referencesImageAbove(offsetLimit: number, path: string, references: readonly OrderedReference[]): boolean {
		for (const reference of references) {
			if (reference.offset >= offsetLimit) {
				return false; // Ascending order: nothing further can be above the limit.
			}
			const target = this.resolveReference(reference.link, path);
			if (target !== undefined && FileKinds.isImagePath(target)) {
				return true;
			}
		}
		return false;
	}

	/** The vault path a link text resolves to from `fromPath`, or `undefined` when it dangles. */
	private resolveReference(link: string, fromPath: string): string | undefined {
		return this.metadataCache.getFirstLinkpathDest(link, fromPath)?.path;
	}

	/**
	 * Resolved outgoing targets in reference order, deduped (first occurrence wins).
	 * `references` is `null` exactly when the metadata cache cannot order this
	 * file's links — the two cases the fallbacks below exist for.
	 */
	private outgoingPathsOf(file: VaultFilePort, references: readonly OrderedReference[] | null): readonly string[] {
		if (file.extension === CANVAS_EXTENSION && this.canvasCapability === "fallback-required") {
			const parsedPaths = this.canvasOutgoingByPath.get(file.path) ?? [];
			return dedupe(parsedPaths.filter((target) => this.vault.getFileByPath(target) !== null));
		}
		if (references !== null) {
			const resolved: string[] = [];
			for (const reference of references) {
				const target = this.resolveReference(reference.link, file.path);
				if (target !== undefined) {
					resolved.push(target);
				}
			}
			return dedupe(resolved);
		}
		// Core-indexed canvas, and markdown not yet in getFileCache: resolvedLinks
		// keys are already-resolved targets (order not contractual, best available).
		return Object.keys(this.metadataCache.resolvedLinks[file.path] ?? {});
	}

	private backlinkSources(path: string): readonly string[] {
		if (this.invertedIncoming !== null) {
			return this.invertedIncoming.get(path) ?? [];
		}
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			// A path the vault does not know has no cache-known backlinks —
			// NOT a reason to abandon the working API (only shape trouble is).
			return [];
		}
		const sources = BacklinksAdapter.backlinkSourcePaths(this.metadataCache, file);
		if (sources !== null) {
			return sources;
		}
		// API present but answered in an unrecognized shape: from here on,
		// serve every query from the inversion (built sync, memoized).
		this.invertedIncoming = this.invertResolvedLinks();
		return this.invertedIncoming.get(path) ?? [];
	}

	private invertResolvedLinks(): ReadonlyMap<string, readonly string[]> {
		const inverted = new Map<string, string[]>();
		for (const [source, targets] of Object.entries(this.metadataCache.resolvedLinks)) {
			for (const target of Object.keys(targets)) {
				appendToMultimap(inverted, target, source);
			}
		}
		return inverted;
	}

	/** Attachments = outgoing references to non-node-bearing files, in reference order. */
	private attachmentsOf(file: VaultFilePort, references: readonly OrderedReference[] | null): readonly AttachmentRef[] {
		return this.outgoingPathsOf(file, references)
			.filter((target) => !FileKinds.isNodeBearingPath(target))
			.map((target) => ({ path: asVaultPath(target), isImage: FileKinds.isImagePath(target) }));
	}
}

/**
 * A markdown file's references in document order, or `null` when the metadata
 * cache cannot order them (not markdown, or not indexed yet). Ordering allocates
 * and sorts, so each caller derives this ONCE and shares the array between the
 * outline's image rule and the outgoing-link resolution.
 */
function orderedReferencesOf(
	file: VaultFilePort,
	cache: CachedMetadataPort | null,
): readonly OrderedReference[] | null {
	if (cache === null || !FileKinds.isMarkdownPath(file.path)) {
		return null;
	}
	return ReferenceOrder.orderedReferences(cache);
}

/**
 * Frontmatter `title` (else `name`) as the display title — step-05 human
 * decision. Only non-empty strings count: YAML lets users put any shape
 * (number, list) into these properties, and rendering those would violate POLS
 * worse than falling back to the basename.
 */
function frontmatterTitleOf(file: VaultFilePort, cache: CachedMetadataPort | null): string | undefined {
	if (!FileKinds.isMarkdownPath(file.path)) {
		return undefined; // Only markdown carries frontmatter.
	}
	const frontmatter = cache?.frontmatter;
	if (frontmatter === undefined) {
		return undefined;
	}
	for (const property of FRONTMATTER_TITLE_PROPERTIES) {
		const value = frontmatter[property];
		if (typeof value === "string" && value.trim() !== "") {
			// Trimmed: quoted YAML like `title: "  My Note  "` keeps its padding,
			// which would leak into rendered titles and breadcrumbs.
			return value.trim();
		}
	}
	return undefined;
}

function engineFolderOf(file: VaultFilePort): string {
	const parentPath = file.parent?.path ?? "";
	return parentPath === OBSIDIAN_ROOT_FOLDER ? "" : parentPath;
}

function dedupe(paths: readonly string[]): readonly string[] {
	return [...new Set(paths)];
}

function appendToMultimap(map: Map<string, string[]>, key: string, value: string): void {
	const values = map.get(key);
	if (values === undefined) {
		map.set(key, [value]);
	} else {
		values.push(value);
	}
}
