import type { AttachmentRef, FileMetadata, LinkProvider, OutgoingReference, OutlineEntry, VaultPath } from "../engine";
import { asFolderPath, asVaultPath, OutgoingReferences } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { BacklinksAdapter } from "./BacklinksAdapter";
import type { OrderedReference } from "./ReferenceOrder";
import { ReferenceOrder } from "./ReferenceOrder";
import type { CanvasReference } from "./CanvasFallbackParser";
import type { CanvasParseCache } from "./CanvasParseCache";
import type { CachedMetadataPort, MetadataCachePort, VaultFilePort, VaultPort } from "./obsidianPorts";

/** Kept local: "which files must be parsed as canvas" is adapter knowledge, not a shared file kind. */
const CANVAS_EXTENSION = "canvas";
/** Obsidian reports "/" as the parent path of vault-root files; the engine's root folder is "". */
const OBSIDIAN_ROOT_FOLDER = "/";
/** Display-title frontmatter properties, in precedence order (step-05 human decision). */
const FRONTMATTER_TITLE_PROPERTIES = ["title", "name"] as const;

/**
 * The two outline-related facts of one note, computed together because they share
 * the same eligibility guards. Named fields (never a tuple) and named exactly
 * like their {@link FileMetadata} counterparts, which lets `getFileMetadata`
 * spread them.
 */
interface NoteOutlineFacts {
	readonly outline: readonly OutlineEntry[];
	readonly imagePrecedesOutline: boolean;
}

/** A file offering no outline: nothing to render, and nothing an image could precede. */
const NO_OUTLINE_FACTS: NoteOutlineFacts = { outline: [], imagePrecedesOutline: false };

/**
 * The real {@link LinkProvider} over Obsidian's metadata cache (step-03).
 *
 * Async construction, sync queries (binding decision, step-02 CLARIFICATION
 * Q2): {@link create} performs everything that cannot be answered
 * synchronously — reading and parsing EVERY `.canvas` file — after which queries
 * answer synchronously against the live metadata cache (`getFileCache`,
 * `resolvedLinks` and `getBacklinksForFile` are all sync at runtime), so a
 * provider never holds a stale copy of markdown links.
 *
 * Canvas links come from OUR parser, always — never from `resolvedLinks`. That
 * retires the per-canvas "which source serves it" split, whose input was a boot
 * race (ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`), and it is what lets a canvas
 * reference report its {@link LinkKind}: `resolvedLinks` merges links and embeds
 * into one count and can name neither.
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
		/**
		 * EVERY canvas in the vault → its resolved references in canvas reference
		 * order, duplicates kept because they are the link COUNT. Membership means
		 * "this is a canvas we parsed", nothing more: canvas links never come from
		 * `resolvedLinks` (see {@link create}).
		 */
		private readonly canvasOutgoingByPath: ReadonlyMap<string, readonly OutgoingReference[]>,
		/** Target path → the canvases referencing it. */
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
		const canvasOutgoing = new Map<string, readonly OutgoingReference[]>();
		const canvasIncoming = new Map<string, string[]>();
		for (const file of vault.getFiles()) {
			if (file.extension !== CANVAS_EXTENSION) {
				continue;
			}
			// EVERY canvas, indexed by core or not. `resolvedLinks` merges links and
			// embeds into one count, so a core-served canvas could not say WHICH of its
			// references are embeds — and whether a given canvas is indexed is a boot
			// race (ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`), so consulting it would make
			// link KINDS boot-timing-dependent. Parsing everything costs one mtime-cached
			// read + JSON.parse per canvas and resolves through the SAME
			// `getFirstLinkpathDest` core uses, so it is not a downgrade.
			const references = await canvasParseCache.referencesOf(vault, file);
			const resolved = resolvedCanvasReferencesOf(vault, metadataCache, file.path, references);
			canvasOutgoing.set(file.path, resolved);
			for (const target of OutgoingReferences.targetsOf(resolved)) {
				appendToMultimap(canvasIncoming, target, file.path);
			}
		}
		return new ObsidianLinkProvider(
			vault,
			metadataCache,
			canvasOutgoing,
			canvasIncoming,
			BacklinksAdapter.isAvailable(metadataCache),
		);
	}

	/**
	 * The canvases THIS build parsed — every canvas in the vault. A provenance
	 * surface for manual QA (`main.ts`): its links are the edges core's
	 * `resolvedLinks` has no say over.
	 */
	get parsedCanvasPaths(): readonly string[] {
		return [...this.canvasOutgoingByPath.keys()];
	}

	getOutgoingReferences(path: VaultPath): readonly OutgoingReference[] {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return [];
		}
		const references = orderedReferencesOf(file, this.metadataCache.getFileCache(file));
		return this.outgoingReferencesOf(file, references);
	}

	getOutgoingLinks(path: VaultPath): readonly VaultPath[] {
		return OutgoingReferences.targetsOf(this.getOutgoingReferences(path));
	}

	getIncomingLinks(path: VaultPath): readonly VaultPath[] {
		const sources = this.backlinkSources(path);
		// Parsed canvas links are the authority for canvas sources — merge them in.
		const canvasSources = this.canvasIncomingByPath.get(path) ?? [];
		return dedupe([...sources, ...canvasSources]).map(asVaultPath);
	}

	/**
	 * DECLARED BEHAVIOR CHANGE (option 3a, ticket `nid_fay1hu5sxcoygizopkkg0f0d7_e`):
	 * for a CORE-INDEXED canvas this used to fall through to `resolvedLinks` —
	 * core's number — because such a canvas had no entry here. Every canvas is
	 * parsed now, so the rendered edge badge is OUR occurrence count for every
	 * canvas. That is deliberate, not incidental: the edge SET already comes from
	 * our parse, so sourcing the COUNT from core would (a) mix two authorities on
	 * one edge and (b) put the badge back on the boot race 3a removed — an edge we
	 * report but core has not indexed yet would read 0. One authority per edge.
	 * `ObsidianLinkProvider.test.ts` pins the multiplicity case where the two
	 * numbers genuinely differ.
	 */
	getLinkCount(source: VaultPath, target: VaultPath): number {
		const canvasReferences = this.canvasOutgoingByPath.get(source);
		if (canvasReferences !== undefined) {
			// Count occurrences. Kind-blind, exactly like the resolvedLinks number below.
			let count = 0;
			for (const parsed of canvasReferences) {
				if (parsed.target === target) {
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
			// Field names match {@link FileMetadata} by design — the facts are
			// computed together (shared guards) and travel unchanged.
			...this.outlineFactsOf(file, cache, references),
		};
	}

	/**
	 * The note's outline and the document-position fact behind the preview rule.
	 *
	 * ONE method, not two: the eligibility guards (outline-bearing, cached,
	 * has a first heading) are shared, and computing the fact separately would
	 * let the two answers drift apart ("a non-empty outline decided under a
	 * different guard than the fact"). The adapter reports; the view decides
	 * (see `FileMetadata.imagePrecedesOutline`).
	 */
	private outlineFactsOf(
		file: VaultFilePort,
		cache: CachedMetadataPort | null,
		references: readonly OrderedReference[] | null,
	): NoteOutlineFacts {
		if (!FileKinds.isOutlineBearingPath(file.path) || cache === null) {
			return NO_OUTLINE_FACTS;
		}
		const headings = cache.headings ?? [];
		const firstHeading = headings[0];
		if (firstHeading === undefined) {
			return NO_OUTLINE_FACTS;
		}
		// `references` is null only when the metadata cache cannot order this file's
		// links, and then nothing is KNOWN to sit above the first heading.
		const firstHeadingOffset = firstHeading.position.start.offset;
		return {
			// Obsidian's `headings` is already in document order — never re-sorted.
			outline: headings.map((heading) => ({ rawText: heading.heading, level: heading.level })),
			imagePrecedesOutline:
				references !== null && this.referencesImageAbove(firstHeadingOffset, file.path, references),
		};
	}

	/**
	 * Whether the note references an IMAGE above `offsetLimit` — the preview rule's
	 * fact asked directly ("is there an image before the first heading?").
	 *
	 * RESOLVED references only (the same resolution `attachments`/`firstImagePath`
	 * use), so an unresolvable `![[missing.png]]` cannot claim the preview slot while
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
	 * Resolved outgoing references in reference order, deduped per (target, kind) so
	 * a target that is both embedded and linked keeps both. `references` is `null`
	 * exactly when the metadata cache cannot order this file's links — the case the
	 * final fallback below exists for.
	 */
	private outgoingReferencesOf(
		file: VaultFilePort,
		references: readonly OrderedReference[] | null,
	): readonly OutgoingReference[] {
		const canvasReferences = this.canvasOutgoingByPath.get(file.path);
		if (canvasReferences !== undefined) {
			// A canvas: already resolved (and unresolvable references dropped) at build time.
			return OutgoingReferences.deduped(canvasReferences);
		}
		if (references !== null) {
			const resolved: OutgoingReference[] = [];
			for (const reference of references) {
				const target = this.resolveReference(reference.link, file.path);
				if (target !== undefined) {
					resolved.push({ target: asVaultPath(target), kind: reference.kind });
				}
			}
			return OutgoingReferences.deduped(resolved);
		}
		// Markdown not yet in getFileCache: resolvedLinks keys are already-resolved
		// targets (order not contractual, best available) — but that record MERGES
		// links and embeds, so the kind is unknowable here and degrades to `link`.
		// The degradation is confined to this one transient case: canvases, whose
		// kinds matter most, are always parsed (see {@link create}).
		//
		// DECIDED (Stage 3 of ticket nid_fay1hu5sxcoygizopkkg0f0d7_e): ACCEPT the
		// degradation rather than returning `[]` for an uncached markdown file.
		// It is now user-VISIBLE — with `embedDepthOut` 0, a note embedded from a
		// not-yet-cached source is walked as a plain link and still appears, i.e.
		// the setting does not hold during the boot window. Returning `[]` would
		// instead make that source's WHOLE neighbourhood vanish for the same window,
		// and rendering a node too many for a moment is a gentler failure than
		// rendering a graph too few: the omission looks like a broken plugin, the
		// extra node looks like the setting has not applied yet. Either way the next
		// `metadataCache` event rebuilds. Pinned by the "degrade to plain links" test.
		return Object.keys(this.metadataCache.resolvedLinks[file.path] ?? {}).map((target) => ({
			target: asVaultPath(target),
			kind: "link" as const,
		}));
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

	/**
	 * Attachments = outgoing references to non-node-bearing files, in reference
	 * order. KIND-BLIND by owner decision (D5 on the embed-depth ticket): a diagram
	 * is an attachment whether written `[[diagram.png]]` or `![[diagram.png]]`.
	 */
	private attachmentsOf(file: VaultFilePort, references: readonly OrderedReference[] | null): readonly AttachmentRef[] {
		return OutgoingReferences.targetsOf(this.outgoingReferencesOf(file, references))
			.filter((target) => !FileKinds.isNodeBearingPath(target))
			.map((target) => ({ path: target, isImage: FileKinds.isImagePath(target) }));
	}
}

/**
 * The vault paths a canvas's parsed references point at, in reference order,
 * with everything that resolves to nothing dropped and duplicates KEPT (they
 * are what `getLinkCount` counts).
 *
 * Resolution lives here, not in the parser, because the two reference kinds
 * resolve through different Obsidian facilities and only this layer holds them:
 * a file node's `file` is already a literal vault path (exact lookup — Obsidian
 * writes it that way), while a text-node link is link TEXT and goes through the
 * SAME `getFirstLinkpathDest` resolution as a markdown body link, relative to
 * the canvas itself. That is precisely what makes our parse agree with what
 * core reports elsewhere in Obsidian (tickets `nid_s676x55uojmtcwh9t4l9mc6zl_e`,
 * `nid_ygo7h95ssgmunaqsprc1zlmfh_e`) — markdown-style destinations included:
 * they arrive already normalised to link text, so they share this one resolver
 * rather than a second literal-path lookup that would diverge on relative
 * paths, folder notes and shortest-path targets.
 */
function resolvedCanvasReferencesOf(
	vault: VaultPort,
	metadataCache: MetadataCachePort,
	canvasPath: string,
	references: readonly CanvasReference[],
): readonly OutgoingReference[] {
	const resolved: OutgoingReference[] = [];
	for (const reference of references) {
		const target =
			reference.kind === "file-node"
				? vault.getFileByPath(reference.filePath)?.path
				: metadataCache.getFirstLinkpathDest(reference.linkText, canvasPath)?.path;
		if (target !== undefined) {
			// `linkKind` travels from the parser untouched: HOW a reference is resolved
			// and WHETHER it embeds are independent facts.
			resolved.push({ target: asVaultPath(target), kind: reference.linkKind });
		}
	}
	return resolved;
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
			// which would leak into rendered node titles.
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
