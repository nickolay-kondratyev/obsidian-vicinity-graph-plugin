/**
 * Structural ports over the slices of the Obsidian API the adapters consume
 * (DIP). Real `obsidian` objects (`Vault`, `MetadataCache`, `TFile`, `Plugin`,
 * `DataAdapter`, obsidian-id-lib's `DocIdService`) satisfy these structurally
 * — method parameters check bivariantly — so production code passes them in
 * unchanged while tests use plain fakes with NO obsidian runtime mock.
 */

export interface FileStatPort {
	readonly mtime: number;
	readonly size: number;
}

export interface VaultFolderPort {
	readonly path: string;
}

/** Structural slice of `TFile`. */
export interface VaultFilePort {
	readonly path: string;
	readonly extension: string;
	readonly stat: FileStatPort;
	/** `null` only for the vault root's own folder object; root FILES have parent path "/". */
	readonly parent: VaultFolderPort | null;
}

/** Structural slice of `Vault`. */
export interface VaultPort {
	getFileByPath(path: string): VaultFilePort | null;
	getFiles(): VaultFilePort[];
	cachedRead(file: VaultFilePort): Promise<string>;
}

/** Structural slice of a `ReferenceCache` (LinkCache / EmbedCache). */
export interface ReferencePort {
	readonly link: string;
	readonly position: { readonly start: { readonly offset: number } };
}

/** Structural slice of a `FrontmatterLinkCache` (property links carry no body offset). */
export interface FrontmatterLinkPort {
	readonly link: string;
}

/**
 * Structural slice of a `HeadingCache`. `heading` is the heading's SOURCE text
 * (the `#` marker is gone, inline markdown is not). `offset` only — no `line`:
 * the outline opens a note by heading TEXT (`path#Heading`), so a line number
 * would be a field we never read.
 */
export interface HeadingPort {
	readonly heading: string;
	readonly level: number;
	readonly position: { readonly start: { readonly offset: number } };
}

/** Structural slice of `CachedMetadata`. */
export interface CachedMetadataPort {
	readonly links?: readonly ReferencePort[];
	readonly embeds?: readonly ReferencePort[];
	readonly frontmatterLinks?: readonly FrontmatterLinkPort[];
	/** Markdown headings in document order (Obsidian's own ordering — never re-sorted). */
	readonly headings?: readonly HeadingPort[];
	/** Parsed frontmatter properties; values are user-controlled (any YAML shape). */
	readonly frontmatter?: Readonly<Record<string, unknown>>;
}

/** Structural slice of `MetadataCache`. */
export interface MetadataCachePort {
	/** source path → (resolved target path → link count). */
	readonly resolvedLinks: Record<string, Record<string, number>>;
	getFileCache(file: VaultFilePort): CachedMetadataPort | null;
	getFirstLinkpathDest(linkpath: string, sourcePath: string): VaultFilePort | null;
}

/** Structural slice of obsidian-id-lib's `DocIdService` (see its README for the contract). */
export interface DocIdPort {
	/** Lock-guarded read-or-create — ONLY on explicit write intent (pinning a doc). */
	ensureDocId(file: VaultFilePort): Promise<string | null>;
	/** READ-ONLY and lock-free — the bulk/read-path call (graph builds, sweeps). */
	getDocId(file: VaultFilePort): Promise<string | null>;
	isEligible(file: VaultFilePort): boolean;
}
