import { FileKinds } from "../shared/FileKinds";
import type { LinkKind } from "../shared/LinkKind";
import type { YoutubeVideoIdentity } from "../shared/YoutubeHeroEmbed";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import type { FileMetadata, LinkProvider, OutgoingReference } from "./LinkProvider";
import { OutgoingReferences } from "./LinkProvider";
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
	 * outline-vs-image DECISION belongs to `nodePreviewKind`.
	 */
	readonly imagePrecedesOutline?: boolean;
	/**
	 * The adapter's resolved leading-YouTube-hero FACT: the note's first expanded
	 * `![](youtube-url)` embed sits above both the first heading and the first
	 * image. Default: none. The fixture supplies the resolved identity directly —
	 * the positional verdict is the real adapter's job, not re-derived here.
	 */
	readonly leadingVideo?: YoutubeVideoIdentity;
}

/** Fixture vault: files + ordered outgoing references (incoming derived by inversion). */
export interface FakeVaultSpec {
	readonly files: readonly FakeFileSpec[];
	/** Per source path: plainly LINKED targets, in reference order, duplicates allowed. */
	readonly links?: Readonly<Record<string, readonly string[]>>;
	/**
	 * Per source path: EMBEDDED targets (`![[x]]`), same shape as {@link links}. A
	 * separate map rather than a tagged list so the overwhelmingly common
	 * kind-blind fixture stays a bare array of paths; the cost is that a source's
	 * references order as "its links, then its embeds", which no fixture depends on.
	 */
	readonly embeds?: Readonly<Record<string, readonly string[]>>;
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
	/** Deduplicated per (target, kind) — mirrors the real adapter's reference-list contract. */
	private readonly outgoing = new Map<VaultPath, readonly OutgoingReference[]>();
	private readonly incoming = new Map<VaultPath, VaultPath[]>();
	/** Raw fixture references WITH duplicates — the multiplicity truth behind getLinkCount. */
	private readonly rawOutgoing = new Map<VaultPath, readonly OutgoingReference[]>();
	private readonly outgoingQueryCountsMutable = new Map<VaultPath, number>();

	constructor(spec: FakeVaultSpec) {
		for (const file of spec.files) {
			this.declareFile(file);
		}
		for (const from of FakeLinkProvider.referenceSourcesOf(spec)) {
			this.declareReferences(from, [
				...FakeLinkProvider.referencesOfKind(spec.links?.[from], "link"),
				...FakeLinkProvider.referencesOfKind(spec.embeds?.[from], "embed"),
			]);
		}
		this.attachAttachmentsToMetadata();
	}

	getOutgoingReferences(path: VaultPath): readonly OutgoingReference[] {
		this.outgoingQueryCountsMutable.set(path, (this.outgoingQueryCountsMutable.get(path) ?? 0) + 1);
		return this.outgoing.get(path) ?? [];
	}

	getOutgoingLinks(path: VaultPath): readonly VaultPath[] {
		return OutgoingReferences.targetsOf(this.getOutgoingReferences(path));
	}

	getIncomingLinks(path: VaultPath): readonly VaultPath[] {
		return this.incoming.get(path) ?? [];
	}

	getFileMetadata(path: VaultPath): FileMetadata | undefined {
		return this.files.get(path)?.metadata;
	}

	getLinkCount(source: VaultPath, target: VaultPath): number {
		let count = 0;
		// Kind-blind like the real provider: links and embeds of the same pair add up.
		for (const raw of this.rawOutgoing.get(source) ?? []) {
			if (raw.target === target) {
				count += 1;
			}
		}
		return count;
	}

	/** Times {@link getOutgoingReferences} was queried for `path` (test instrumentation). */
	outgoingQueryCount(path: VaultPath): number {
		return this.outgoingQueryCountsMutable.get(path) ?? 0;
	}

	/** Every source declaring references of EITHER kind, each once. */
	private static referenceSourcesOf(spec: FakeVaultSpec): readonly string[] {
		return [...new Set([...Object.keys(spec.links ?? {}), ...Object.keys(spec.embeds ?? {})])];
	}

	private static referencesOfKind(targets: readonly string[] | undefined, kind: LinkKind) {
		return (targets ?? []).map((target) => ({ target, kind }));
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
				leadingVideo: file.leadingVideo,
			},
		});
	}

	private declareReferences(from: string, declared: readonly { target: string; kind: LinkKind }[]): void {
		const fromPath = this.requireDeclared(from, "link source");
		const references = declared.map(
			(reference): OutgoingReference => ({
				target: this.requireDeclared(reference.target, `link target of [${from}]`),
				kind: reference.kind,
			}),
		);
		this.rawOutgoing.set(fromPath, references);
		// Deduplicate like the real adapter: duplicate fixture references only surface
		// through getLinkCount, never through the reference list.
		this.outgoing.set(fromPath, OutgoingReferences.deduped(references));
		// Incoming is kind-blind (scope decision): a linker is a linker.
		for (const target of OutgoingReferences.targetsOf(references)) {
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

	/**
	 * Attachments = outgoing references to non-node-bearing files, in reference
	 * order. KIND-BLIND by owner decision: a diagram is an attachment whether it is
	 * `[[diagram.png]]` or `![[diagram.png]]`.
	 */
	private attachAttachmentsToMetadata(): void {
		for (const [path, file] of this.files) {
			const attachments: AttachmentRef[] = [];
			for (const target of OutgoingReferences.targetsOf(this.outgoing.get(path) ?? [])) {
				const targetFile = this.files.get(target);
				if (targetFile !== undefined && !targetFile.nodeBearing) {
					attachments.push({ path: target, isImage: targetFile.image });
				}
			}
			this.files.set(path, { ...file, metadata: { ...file.metadata, attachments } });
		}
	}
}
