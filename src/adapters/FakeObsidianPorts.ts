import { VaultPathFacts } from "../shared/VaultPathFacts";
import type {
	CachedMetadataPort,
	MetadataCachePort,
	VaultFilePort,
	VaultPort,
} from "./obsidianPorts";

/** One file in a fake Obsidian vault. Defaults keep fixtures terse. */
export interface FakeObsidianFileSpec {
	readonly path: string;
	/** Default 0. */
	readonly mtime?: number;
	/** Default 0. */
	readonly size?: number;
	/** Raw content served by `cachedRead` (canvas JSON). Default "". */
	readonly content?: string;
}

export interface FakeObsidianSpec {
	readonly files: readonly FakeObsidianFileSpec[];
	/** Per source path: the `getFileCache` result (body/frontmatter references). */
	readonly fileCaches?: Readonly<Record<string, CachedMetadataPort>>;
	/** source path → (resolved target path → count), verbatim `resolvedLinks`. */
	readonly resolvedLinks?: Readonly<Record<string, Readonly<Record<string, number>>>>;
	/** link text → target path, backing `getFirstLinkpathDest`. Unlisted texts are unresolved. */
	readonly resolutions?: Readonly<Record<string, string>>;
	/**
	 * SOURCE path → (link text → target path), for the fixtures that care that a link
	 * resolves RELATIVE TO the file it was written in (Obsidian resolves shortest-path
	 * link text against the source). Consulted before {@link resolutions}.
	 */
	readonly resolutionsFrom?: Readonly<Record<string, Readonly<Record<string, string>>>>;
	/**
	 * target path → linker source paths, served through a fake
	 * `getBacklinksForFile`. Omit to fake an install WITHOUT that API.
	 */
	readonly backlinks?: Readonly<Record<string, readonly string[]>>;
	/**
	 * target path → (source path → reference start offsets), for fixtures that
	 * care about PER-REFERENCE positions in the `getBacklinksForFile` result.
	 * Sources listed here are merged with {@link backlinks}; a source listed
	 * only in `backlinks` serves an empty reference list (position-less).
	 */
	readonly backlinkOffsets?: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>>;
}

/**
 * Test-side stand-in for the Obsidian objects behind {@link VaultPort} /
 * {@link MetadataCachePort} — declarative fixtures for the adapter tests, the
 * same role `FakeLinkProvider` plays for the engine. No obsidian import, so
 * tests need no runtime mock of the `obsidian` package.
 */
export class FakeObsidianPorts {
	readonly vault: VaultPort;
	readonly metadataCache: MetadataCachePort;

	private readonly filesByPath = new Map<string, VaultFilePort>();
	private readonly contentByPath = new Map<string, string>();

	constructor(private readonly spec: FakeObsidianSpec) {
		for (const file of spec.files) {
			this.filesByPath.set(file.path, FakeObsidianPorts.toFilePort(file));
			this.contentByPath.set(file.path, file.content ?? "");
		}
		this.vault = this.buildVaultPort();
		this.metadataCache = this.buildMetadataCachePort();
	}

	private static toFilePort(file: FakeObsidianFileSpec): VaultFilePort {
		const folder = VaultPathFacts.folderOf(file.path);
		return {
			path: file.path,
			extension: VaultPathFacts.extensionOf(file.path),
			stat: { mtime: file.mtime ?? 0, size: file.size ?? 0 },
			// Mirrors Obsidian: files at the vault root have parent path "/".
			parent: { path: folder === "" ? "/" : folder },
		};
	}

	private buildVaultPort(): VaultPort {
		return {
			getFileByPath: (path) => this.filesByPath.get(path) ?? null,
			getFiles: () => [...this.filesByPath.values()],
			cachedRead: (file) => Promise.resolve(this.contentByPath.get(file.path) ?? ""),
		};
	}

	private buildMetadataCachePort(): MetadataCachePort {
		const cache: MetadataCachePort = {
			resolvedLinks: structuredClone(this.spec.resolvedLinks ?? {}) as Record<
				string,
				Record<string, number>
			>,
			getFileCache: (file) => this.spec.fileCaches?.[file.path] ?? null,
			getFirstLinkpathDest: (linkpath, sourcePath) => {
				// Source-scoped resolutions win, so a fixture can prove that the caller
				// passes the RIGHT source path; the flat map stays the terse default.
				const targetPath =
					this.spec.resolutionsFrom?.[sourcePath]?.[linkpath] ?? this.spec.resolutions?.[linkpath];
				return targetPath === undefined ? null : (this.filesByPath.get(targetPath) ?? null);
			},
		};
		if (this.spec.backlinks !== undefined || this.spec.backlinkOffsets !== undefined) {
			return Object.assign(cache, {
				// Mirrors the undocumented runtime API: result.data is Map-like of
				// source path → reference objects (positions where the fixture gives them).
				getBacklinksForFile: (file: VaultFilePort) => ({
					data: this.backlinkDataFor(file.path),
				}),
			});
		}
		return cache;
	}

	private backlinkDataFor(targetPath: string): Map<string, readonly { position: { start: { offset: number } } }[]> {
		const offsetsBySource = this.spec.backlinkOffsets?.[targetPath] ?? {};
		const sources = new Set([...(this.spec.backlinks?.[targetPath] ?? []), ...Object.keys(offsetsBySource)]);
		return new Map(
			[...sources].map((source) => [
				source,
				(offsetsBySource[source] ?? []).map((offset) => ({ position: { start: { offset } } })),
			]),
		);
	}
}
