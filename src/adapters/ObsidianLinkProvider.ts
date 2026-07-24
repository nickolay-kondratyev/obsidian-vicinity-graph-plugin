import type { AttachmentRef, FileMetadata, LinkProvider, OutlineEntry, VaultPath } from "../engine";
import { asFolderPath, asVaultPath } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { BacklinksAdapter } from "./BacklinksAdapter";
import { ReferenceOrder } from "./ReferenceOrder";
import type { CanvasCapability } from "./CanvasCapability";
import { CanvasCapabilityDetector } from "./CanvasCapability";
import type { CanvasParseCache } from "./CanvasParseCache";
import type { CachedMetadataPort, MetadataCachePort, VaultFilePort, VaultPort } from "./obsidianPorts";

/** A resolved outgoing reference paired with the document offset it was written at. */
interface ResolvedReference {
	readonly path: string;
	readonly offset: number;
}

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
		return this.resolvedOutgoingPaths(path).map(asVaultPath);
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
		// One cache read serves both the title and the outline (they ask the same
		// `getFileCache` question about the same file).
		const cache = this.metadataCache.getFileCache(file);
		return {
			folder: asFolderPath(engineFolderOf(file)),
			sizeBytes: file.stat.size,
			frontmatterTitle: frontmatterTitleOf(file, cache),
			isNodeBearing: FileKinds.isNodeBearingPath(file.path),
			attachments: this.attachmentsOf(path),
			outline: this.outlineOf(file, cache),
		};
	}

	/**
	 * The note's heading outline, or EMPTY when the note offers none: not
	 * outline-bearing (canvas, `*.excalidraw.md`), no headings, or its first
	 * IMAGE sits before its first heading — the documented "show the picture
	 * instead" escape hatch. Only the adapter can see document offsets, so the
	 * whole rule lives here (see `FileMetadata.outline`).
	 */
	private outlineOf(file: VaultFilePort, cache: CachedMetadataPort | null): readonly OutlineEntry[] {
		if (!FileKinds.isOutlineBearingPath(file.path) || cache === null) {
			return [];
		}
		const headings = cache.headings ?? [];
		const firstHeading = headings[0];
		if (firstHeading === undefined) {
			return [];
		}
		const firstImageOffset = this.firstImageOffsetOf(file.path, cache);
		if (firstImageOffset !== undefined && firstImageOffset < firstHeading.position.start.offset) {
			return []; // The image wins.
		}
		// Obsidian's `headings` is already in document order — never re-sorted.
		return headings.map((heading) => ({ rawText: heading.heading, level: heading.level }));
	}

	/**
	 * Document offset of the note's first referenced IMAGE, or `undefined` when it
	 * references none. Computed from RESOLVED references (the same pass that feeds
	 * `attachments`/`firstImagePath`), so an unresolvable `![[missing.png]]` cannot
	 * suppress the outline while producing no thumbnail — a silently blank node.
	 */
	private firstImageOffsetOf(path: string, cache: CachedMetadataPort): number | undefined {
		return this.orderedMarkdownReferences(path, cache).find((reference) =>
			FileKinds.isImagePath(reference.path),
		)?.offset;
	}

	/** Resolved markdown references in document order, WITH offsets, duplicates kept. */
	private orderedMarkdownReferences(path: string, cache: CachedMetadataPort): readonly ResolvedReference[] {
		const resolved: ResolvedReference[] = [];
		for (const reference of ReferenceOrder.orderedReferences(cache)) {
			const target = this.metadataCache.getFirstLinkpathDest(reference.link, path)?.path;
			if (target !== undefined) {
				resolved.push({ path: target, offset: reference.offset });
			}
		}
		return resolved;
	}

	/** Resolved outgoing targets in reference order, deduped (first occurrence wins). */
	private resolvedOutgoingPaths(path: string): readonly string[] {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return [];
		}
		if (file.extension === CANVAS_EXTENSION && this.canvasCapability === "fallback-required") {
			const parsedPaths = this.canvasOutgoingByPath.get(path) ?? [];
			return dedupe(parsedPaths.filter((target) => this.vault.getFileByPath(target) !== null));
		}
		if (FileKinds.isMarkdownPath(file.path)) {
			const cache = this.metadataCache.getFileCache(file);
			if (cache !== null) {
				return dedupe(this.orderedMarkdownReferences(path, cache).map((reference) => reference.path));
			}
		}
		// Core-indexed canvas, and markdown not yet in getFileCache: resolvedLinks
		// keys are already-resolved targets (order not contractual, best available).
		return Object.keys(this.metadataCache.resolvedLinks[path] ?? {});
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
	private attachmentsOf(path: string): readonly AttachmentRef[] {
		return this.resolvedOutgoingPaths(path)
			.filter((target) => !FileKinds.isNodeBearingPath(target))
			.map((target) => ({ path: asVaultPath(target), isImage: FileKinds.isImagePath(target) }));
	}
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
