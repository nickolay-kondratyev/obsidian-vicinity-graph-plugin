import type {
	OutgoingReference,
	RelationLabel,
	RelationProvider,
	RelationshipStatement,
	VaultPath,
} from "../engine";
import { asVaultPath, RelationshipStatements } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { IncrementalVaultIndex, linksOrEmbedsScanGate } from "./IncrementalVaultIndex";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";

/**
 * THE named-relationships vault index (feature `named-relationships`, ticket
 * `nid_wldz7yfjecf9fuwtlezlbde9s_e`): the pure statement parser
 * ({@link RelationshipStatements}) run over the reusable
 * {@link IncrementalVaultIndex} machinery, plus the query-time RESOLUTION that
 * turns parsed link text into vault paths.
 *
 * Split of responsibilities:
 * - The ENTRY is the raw parsed statements — content-derived only, per the
 *   {@link import("./IncrementalVaultIndex").VaultFileEntryParser} contract (a
 *   rename rekeys it without a re-parse, so nothing path-dependent may be
 *   stored). {@link statementsOf} exposes them verbatim: spans, qualifiers and
 *   rel-note occurrences are the flyout's provenance surface (view ticket
 *   `nid_wnagjm2j144u0jsgixpcmmpar_e`).
 * - RESOLUTION happens per query against the LIVE metadataCache
 *   (`getFirstLinkpathDest`, relative to the source — the same resolver every
 *   other link source uses), so a created/renamed target re-resolves without
 *   touching the entry.
 *
 * Two consumers, one truth:
 * - {@link namedReferences}: the label-bearing {@link OutgoingReference}s
 *   `ObsidianLinkProvider` merges into its outgoing stream — a named link is
 *   STILL a link, so `OutgoingReferences.deduped` folds each label onto the very
 *   reference the plain cache link produces (the either-budget union).
 * - {@link relNoteFolds}: the engine's {@link RelationProvider} port — one entry
 *   per rel-note NAME occurrence, feeding the engine's folding choke point.
 *
 * Lifecycle: plugin-lived; `main.ts` calls {@link startEagerly} at load and
 * wires the freshness handlers; `ObsidianLinkProvider.create` awaits
 * {@link ensureReady}, so queries after construction are synchronous — the same
 * "async construction, sync queries" contract as every other link source.
 */
export class NamedRelationshipsIndex implements RelationProvider {
	private readonly index: IncrementalVaultIndex<readonly RelationshipStatement[]>;

	constructor(
		vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
	) {
		const linkGate = linksOrEmbedsScanGate(metadataCache);
		this.index = new IncrementalVaultIndex(
			vault,
			// Markdown only: statements are a markdown syntax, and canvas links have
			// their own parser. The link/embed gate then skips the byte read for
			// markdown with no links at all (a statement needs a `[[x]]` target).
			(file) => FileKinds.isMarkdownPath(file.path) && linkGate(file),
			(_path, content) => {
				const statements = RelationshipStatements.parse(content);
				return statements.length === 0 ? null : statements;
			},
		);
	}

	/** Resolves when the initial vault scan has populated the index. Idempotent. */
	ensureReady(): Promise<void> {
		return this.index.ensureReady();
	}

	/** Fire-and-forget scan start for `onload` — never blocks plugin load. */
	startEagerly(): void {
		this.index.startEagerly();
	}

	/** Freshness: `metadataCache.on('changed')` hands the new content — re-parse. */
	handleFileChanged(path: string, content: string): void {
		if (!FileKinds.isMarkdownPath(path)) {
			return; // Only markdown carries statements; a canvas 'changed' is noise here.
		}
		this.index.handleFileChanged(path, content);
	}

	/** Freshness: `vault.on('delete')`. */
	handleFileDeleted(path: string): void {
		this.index.handleFileDeleted(path);
	}

	/** Freshness: `vault.on('rename')` — rekeys, content-derived entries need no re-parse. */
	handleFileRenamed(oldPath: string, newPath: string): void {
		this.index.handleFileRenamed(oldPath, newPath);
	}

	/**
	 * The raw parsed statements of `source`, in written order — the provenance
	 * surface (spans, qualifiers, rel-note occurrences) for the edge flyout. `[]`
	 * for a file with none.
	 */
	statementsOf(source: VaultPath): readonly RelationshipStatement[] {
		return this.index.entryFor(source) ?? [];
	}

	/**
	 * The label-bearing outgoing references `source`'s statements contribute — one
	 * reference per (statement, resolvable target), each carrying that statement's
	 * ONE {@link RelationLabel}. Unresolvable targets are skipped (they are not
	 * cache links either — the graceful-degradation rule: nothing appears, nothing
	 * dangles). NOT deduplicated: `ObsidianLinkProvider` merges these into its
	 * outgoing stream through `OutgoingReferences.deduped`, which folds every label
	 * onto the one surviving reference per (target, kind).
	 */
	namedReferences(source: VaultPath): readonly OutgoingReference[] {
		const references: OutgoingReference[] = [];
		for (const statement of this.statementsOf(source)) {
			const label = this.labelOf(source, statement);
			for (const target of statement.targets) {
				const resolved = this.resolve(target.linkText, source);
				if (resolved === undefined) {
					continue;
				}
				references.push({
					target: resolved,
					kind: target.isEmbed ? "embed" : "link",
					relations: [label],
				});
			}
		}
		return references;
	}

	/**
	 * {@link RelationProvider}: the resolved rel-note NAME targets of `source`, one
	 * entry PER STATEMENT OCCURRENCE. A name that resolves to nothing contributes
	 * no fold — consistent with the plain link stream, where an unresolved
	 * `[[he supports]]` produces no link occurrence to subtract from.
	 */
	relNoteFolds(source: VaultPath): readonly VaultPath[] {
		const folds: VaultPath[] = [];
		for (const statement of this.statementsOf(source)) {
			if (statement.name.kind !== "rel-note") {
				continue;
			}
			const resolved = this.resolve(statement.name.linkText, source);
			if (resolved !== undefined) {
				folds.push(resolved);
			}
		}
		return folds;
	}

	/** One statement's {@link RelationLabel} — shared by every target of its run. */
	private labelOf(source: VaultPath, statement: RelationshipStatement): RelationLabel {
		// An empty qualifier (`[supports:: [[x]]]` — wrapper closed right after the
		// run) reads the same as no qualifier, so it is not carried.
		const qualifier =
			statement.qualifier !== null && statement.qualifier !== "" ? { qualifier: statement.qualifier } : {};
		if (statement.name.kind === "text") {
			return { name: statement.name.text, ...qualifier };
		}
		// Rel-note name: the label always shows (alias-else-basename, decided at
		// parse time); the flyout link exists only when the rel note resolves.
		const relNoteTarget = this.resolve(statement.name.linkText, source);
		return {
			name: statement.name.label,
			...qualifier,
			...(relNoteTarget !== undefined ? { relNoteTarget } : {}),
		};
	}

	/** The vault path `linkText` resolves to from `source`, or `undefined` when it dangles. */
	private resolve(linkText: string, source: VaultPath): VaultPath | undefined {
		const file = this.metadataCache.getFirstLinkpathDest(linkText, source);
		return file === null ? undefined : asVaultPath(file.path);
	}
}
