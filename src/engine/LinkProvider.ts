import type { LinkKind } from "../shared/LinkKind";
import type { AttachmentRef, FolderPath, OutlineEntry, RelationLabel, VaultPath } from "./types";

/**
 * One resolved outgoing reference: WHERE it points and HOW it points there.
 *
 * The kind is carried per REFERENCE, not per pair, because a note can both embed
 * and plainly link the same target — so `A → B` may legitimately appear twice,
 * once per kind.
 */
export interface OutgoingReference {
	readonly target: VaultPath;
	readonly kind: LinkKind;
	/**
	 * NAMED-RELATIONSHIP labels carried by this reference (feature
	 * `named-relationships`). A named link is STILL a link — the adapter merges the
	 * relation label onto the very same reference the plain link produces, so the
	 * one occurrence is served to BOTH the plain link/embed channel (by {@link kind})
	 * AND the named channel (by carrying labels) — the EITHER-BUDGET union. ABSENT
	 * (or empty) ⇒ a plain, unnamed reference. Multiple statements naming the same
	 * (target, kind) aggregate here — the deduped reference carries them all.
	 */
	readonly relations?: readonly RelationLabel[];
}

/** Views over a reference list. The kind-blind collapse lives HERE, once. */
export class OutgoingReferences {
	/**
	 * The distinct TARGETS of `references`, first occurrence first — the kind-blind
	 * view, for the consumers that ask "what does this file point at" without
	 * caring how (node sizing, attachments, today's traversal).
	 */
	static targetsOf(references: readonly OutgoingReference[]): readonly VaultPath[] {
		return [...new Set(references.map((reference) => reference.target))];
	}

	/**
	 * The distinct targets of `references` reached by `kind`, first occurrence first
	 * — ONE traversal channel's neighbor list. A target that is both embedded and
	 * plainly linked appears in BOTH kinds' views, which is exactly right: either
	 * relationship alone justifies the edge.
	 */
	static targetsOfKind(references: readonly OutgoingReference[], kind: LinkKind): readonly VaultPath[] {
		return OutgoingReferences.targetsOf(references.filter((reference) => reference.kind === kind));
	}

	/**
	 * `references` collapsed to ONE reference per (target, kind) pair, first-occurrence
	 * order — the deduplication every {@link LinkProvider} owes its callers, so a target
	 * both embedded and plainly linked keeps ONE reference per kind. Any
	 * {@link OutgoingReference.relations} on the collapsed duplicates are MERGED onto the
	 * survivor (a named link and a plain link to the same target are one reference that
	 * carries the name), so a dedup never drops a relation label.
	 */
	static deduped(references: readonly OutgoingReference[]): readonly OutgoingReference[] {
		const order: string[] = [];
		const byIdentity = new Map<string, { target: VaultPath; kind: LinkKind; relations: RelationLabel[] }>();
		for (const reference of references) {
			const identity = `${reference.kind}:${reference.target}`;
			let entry = byIdentity.get(identity);
			if (entry === undefined) {
				entry = { target: reference.target, kind: reference.kind, relations: [] };
				byIdentity.set(identity, entry);
				order.push(identity);
			}
			if (reference.relations !== undefined) {
				entry.relations.push(...reference.relations);
			}
		}
		return order.map((identity) => {
			// Non-null: every identity in `order` was just set in `byIdentity`.
			const entry = byIdentity.get(identity) as { target: VaultPath; kind: LinkKind; relations: RelationLabel[] };
			return entry.relations.length === 0
				? { target: entry.target, kind: entry.kind }
				: { target: entry.target, kind: entry.kind, relations: entry.relations };
		});
	}

	/**
	 * The distinct targets `references` NAMES — reached by at least one named
	 * relationship (a reference carrying {@link OutgoingReference.relations}), first
	 * occurrence first. ONE named channel's outgoing neighbor list, kind-blind: a named
	 * link and a named embed both qualify (the displayed kind is still decided at edge
	 * assembly). A target both named and plainly linked appears here AND in
	 * {@link targetsOfKind} — the either-budget union.
	 */
	static namedTargetsOf(references: readonly OutgoingReference[]): readonly VaultPath[] {
		return OutgoingReferences.targetsOf(
			references.filter((reference) => reference.relations !== undefined && reference.relations.length > 0),
		);
	}
}

/**
 * Per-file facts the engine needs. Everything here is ADAPTER truth: the
 * provider (not the engine) owns eligibility and attachment rules, because
 * only the adapter can consult real vault knowledge (extensions, embeds,
 * canvas capability). The engine merely consumes these flags.
 */
export interface FileMetadata {
	readonly folder: FolderPath;
	readonly sizeBytes: number;
	/**
	 * Display-title override from the note's frontmatter (`title` property,
	 * else `name` — step-05 human decision); absent when neither is a
	 * non-empty string. The engine falls back to the basename.
	 */
	readonly frontmatterTitle?: string;
	/**
	 * True iff this file can be a graph node (adapter rule: `.md` + `.canvas`).
	 * Non-node-bearing files are never nodes — they surface as attachments.
	 */
	readonly isNodeBearing: boolean;
	/**
	 * Non-node-bearing files this file references, in reference order.
	 * Provider-owned so adapters can refine the rule (e.g. embeds vs. plain
	 * links) without an engine change (OCP).
	 */
	readonly attachments: readonly AttachmentRef[];
	/**
	 * Heading outline offered as this note's in-node preview, in document order.
	 * EMPTY only when the file HAS no offerable outline: no headings, or not
	 * outline-bearing (canvas, `*.excalidraw.md`). Whether the outline or the
	 * image ends up rendered is NOT decided here — the view owns that choice and
	 * reads {@link imagePrecedesOutline}. Provider-owned exactly like
	 * {@link attachments}: only the adapter sees document offsets.
	 */
	readonly outline: readonly OutlineEntry[];
	/**
	 * A RESOLVED image reference sits above this note's FIRST HEADING — the
	 * document-position FACT behind the "show the picture instead" preview rule.
	 * The adapter reports it; the view decides what to do with it.
	 *
	 * `false` when there is no first heading (nothing to precede), when the file
	 * is not outline-bearing, and when the reference above the heading does not
	 * resolve to an image (an unresolvable embed produces no thumbnail, so it must
	 * not be allowed to claim the preview slot).
	 */
	readonly imagePrecedesOutline: boolean;
}

/**
 * THE sole seam between the pure engine and Obsidian. Synchronous by design
 * (binding decision, step-02 CLARIFICATION Q2): adapters index up-front
 * (async construction), then answer queries synchronously.
 *
 * Step-03 implements `ObsidianLinkProvider` (resolvedLinks + backlinks) AND a
 * canvas-fallback provider against this SAME interface — keep it shaped around
 * path-keyed link lists + per-file metadata, never canvas-specific (OCP).
 */
export interface LinkProvider {
	/**
	 * Resolved outgoing references of `path`, in reference order, deduplicated per
	 * (target, kind) — so a target that is BOTH embedded and linked appears twice,
	 * once per kind. May include non-node-bearing files.
	 *
	 * THE outgoing truth: {@link getOutgoingLinks} is the kind-blind view of this
	 * same answer, never a second computation.
	 */
	getOutgoingReferences(path: VaultPath): readonly OutgoingReference[];
	/**
	 * Resolved link targets of `path`, in reference order, deduplicated. May include
	 * non-node-bearing files. Implementations MUST answer
	 * `OutgoingReferences.targetsOf(getOutgoingReferences(path))`.
	 */
	getOutgoingLinks(path: VaultPath): readonly VaultPath[];
	/** Paths of files linking TO `path`, deduplicated. */
	getIncomingLinks(path: VaultPath): readonly VaultPath[];
	/**
	 * Folder-note CHILDREN of `path`: the node-bearing files sitting directly in the
	 * folder `path` is the folder note of, minus `path` itself. Empty when `path`
	 * owns no folder. A FACT (the folder-note convention lives in
	 * {@link import("../shared/FolderNotes").FolderNotes}), not a traversal decision —
	 * the `descendants` channel walks these, the depth budget bounds the reach.
	 */
	getChildNotes(path: VaultPath): readonly VaultPath[];
	/**
	 * Folder-note PARENT of `path`, one hop UP the hierarchy: the folder note of
	 * `path`'s containing folder, or — when `path` IS that folder note — the folder
	 * note of the parent folder. `undefined` at the first folder-note gap. A FACT,
	 * like {@link getChildNotes}; the `ancestors` channel walks it.
	 */
	getParentNote(path: VaultPath): VaultPath | undefined;
	/** Metadata for `path`, or `undefined` when the file is unknown to the vault. */
	getFileMetadata(path: VaultPath): FileMetadata | undefined;
	/**
	 * Number of distinct resolved links `source` → `target`; 0 when none. The
	 * ONLY multiplicity source: link lists above are deduplicated, and the
	 * traversal cannot tally links itself (multi-root walks revisit pairs), so
	 * edge count badges must come from here.
	 *
	 * KIND-BLIND on purpose: it counts links and embeds together. Obsidian's own
	 * `resolvedLinks` — the number this reports for markdown — is itself a merged
	 * count, so a per-kind split would have to re-derive the TOTAL from the file
	 * cache and could therefore change a rendered badge. REVISITED for the stage-2
	 * embed-edge rendering (ticket `nid_2qygmn0z59t8fdlb5e9pap49m_e`) and
	 * deliberately KEPT merged: the edge's KIND summary comes from
	 * {@link getOutgoingReferences} at edge assembly, so styling never needed a
	 * per-kind count and the badge number is unchanged.
	 */
	getLinkCount(source: VaultPath, target: VaultPath): number;
}
