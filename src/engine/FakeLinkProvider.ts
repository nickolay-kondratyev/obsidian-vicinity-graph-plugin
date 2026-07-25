import { FileKinds } from "../shared/FileKinds";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import type { FileMetadata, LinkProvider } from "./LinkProvider";
import type { AttachmentRef, OutlineEntry, VaultPath } from "./types";
import { asFolderPath, asVaultPath } from "./types";

/** One file in a fixture vault. Defaults keep fixtures terse. */
export interface FakeFileSpec {
	readonly path: string;
	/** Default 0. */
	readonly sizeBytes?: number;
	/** Default: derived from extension (`.md` / `.canvas` → true). */
	readonly nodeBearing?: boolean;
	/** Default: derived from extension (png/jpg/jpeg/gif/svg/webp). */
	readonly image?: boolean;
	/** Frontmatter display-title override (`title`/`name` already resolved). Default: none. */
	readonly frontmatterTitle?: string;
	/**
	 * Heading outline the real adapter would have produced (raw heading text +
	 * level, in document order). Default: none. Independent of {@link image} and
	 * of {@link imagePrecedesOutline}: the adapter reports both sides, so a
	 * fixture supplies both and nothing re-derives the preview rule here.
	 */
	readonly outline?: readonly OutlineEntry[];
	/**
	 * The adapter's document-position FACT: a resolved image sits above the note's
	 * first heading. Default `false` — the fixture supplies the fact, and the
	 * outline-vs-image DECISION stays in the view (`nodePreviewChoice`).
	 */
	readonly imagePrecedesOutline?: boolean;
}

/** Fixture vault: files + ordered outgoing links (incoming derived by inversion). */
export interface FakeVaultSpec {
	readonly files: readonly FakeFileSpec[];
	readonly links?: Readonly<Record<string, readonly string[]>>;
}

interface FakeFile {
	readonly metadata: FileMetadata;
	readonly nodeBearing: boolean;
	readonly image: boolean;
}

/**
 * In-memory {@link LinkProvider} over declarative fixture data — the test-side
 * stand-in for step-03's Obsidian adapters. Mirrors adapter behavior:
 * attachments are the outgoing references to non-node-bearing files, in link
 * order. Links to undeclared paths fail construction loudly (fixture bug —
 * real providers only ever surface resolved links).
 *
 * Query counters exist so tests can assert traversal never re-expands a node.
 */
export class FakeLinkProvider implements LinkProvider {
	private readonly files = new Map<VaultPath, FakeFile>();
	/** Deduplicated (mirrors the real adapter's link-list contract). */
	private readonly outgoing = new Map<VaultPath, readonly VaultPath[]>();
	private readonly incoming = new Map<VaultPath, VaultPath[]>();
	/** Raw fixture links WITH duplicates — the multiplicity truth behind getLinkCount. */
	private readonly rawOutgoing = new Map<VaultPath, readonly VaultPath[]>();
	private readonly outgoingQueryCountsMutable = new Map<VaultPath, number>();

	constructor(spec: FakeVaultSpec) {
		for (const file of spec.files) {
			this.declareFile(file);
		}
		for (const [from, targets] of Object.entries(spec.links ?? {})) {
			this.declareLinks(from, targets);
		}
		this.attachAttachmentsToMetadata();
	}

	getOutgoingLinks(path: VaultPath): readonly VaultPath[] {
		this.outgoingQueryCountsMutable.set(path, (this.outgoingQueryCountsMutable.get(path) ?? 0) + 1);
		return this.outgoing.get(path) ?? [];
	}

	getIncomingLinks(path: VaultPath): readonly VaultPath[] {
		return this.incoming.get(path) ?? [];
	}

	getFileMetadata(path: VaultPath): FileMetadata | undefined {
		return this.files.get(path)?.metadata;
	}

	getLinkCount(source: VaultPath, target: VaultPath): number {
		let count = 0;
		for (const raw of this.rawOutgoing.get(source) ?? []) {
			if (raw === target) {
				count += 1;
			}
		}
		return count;
	}

	/** Times {@link getOutgoingLinks} was queried for `path` (test instrumentation). */
	outgoingQueryCount(path: VaultPath): number {
		return this.outgoingQueryCountsMutable.get(path) ?? 0;
	}

	private declareFile(file: FakeFileSpec): void {
		const path = asVaultPath(file.path);
		const nodeBearing = file.nodeBearing ?? FileKinds.isNodeBearingPath(file.path);
		this.files.set(path, {
			nodeBearing,
			image: file.image ?? FileKinds.isImagePath(file.path),
			metadata: {
				folder: asFolderPath(VaultPathFacts.folderOf(file.path)),
				sizeBytes: file.sizeBytes ?? 0,
				frontmatterTitle: file.frontmatterTitle,
				isNodeBearing: nodeBearing,
				attachments: [], // replaced by attachAttachmentsToMetadata()
				outline: file.outline ?? [],
				imagePrecedesOutline: file.imagePrecedesOutline ?? false,
			},
		});
	}

	private declareLinks(from: string, targets: readonly string[]): void {
		const fromPath = this.requireDeclared(from, "link source");
		const targetPaths = targets.map((target) => this.requireDeclared(target, `link target of [${from}]`));
		this.rawOutgoing.set(fromPath, targetPaths);
		// Deduplicate like the real adapter: duplicate fixture links only surface
		// through getLinkCount, never through the link lists.
		this.outgoing.set(fromPath, [...new Set(targetPaths)]);
		for (const target of new Set(targetPaths)) {
			const linkers = this.incoming.get(target) ?? [];
			if (!linkers.includes(fromPath)) {
				linkers.push(fromPath);
			}
			this.incoming.set(target, linkers);
		}
	}

	private requireDeclared(path: string, role: string): VaultPath {
		const vaultPath = asVaultPath(path);
		if (!this.files.has(vaultPath)) {
			throw new Error(`FakeLinkProvider fixture bug: ${role} [${path}] is not a declared file`);
		}
		return vaultPath;
	}

	/** Attachments = outgoing references to non-node-bearing files, in link order. */
	private attachAttachmentsToMetadata(): void {
		for (const [path, file] of this.files) {
			const attachments: AttachmentRef[] = [];
			for (const target of this.outgoing.get(path) ?? []) {
				const targetFile = this.files.get(target);
				if (targetFile !== undefined && !targetFile.nodeBearing) {
					attachments.push({ path: target, isImage: targetFile.image });
				}
			}
			this.files.set(path, { ...file, metadata: { ...file.metadata, attachments } });
		}
	}
}
