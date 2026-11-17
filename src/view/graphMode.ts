import type { VicinityGraph } from "../engine";
import { Tags } from "../shared/Tags";
import type { Tag } from "../shared/Tags";

/**
 * WHAT a graph view shows (tags-v1 decisions 9-12) — per VIEW, never a setting:
 *
 * - `note`: the vicinity of the active note. Follows the open note.
 * - `tag`: every note carrying {@link tag} (or a nested child tag), links or not.
 *   STICKY: opening other notes does not change it; only an explicit exit does.
 *
 * Pure (no `obsidian` / `react`): the controller, the view shell's saved state and
 * the status pill all read this one module.
 */
export type GraphMode = { readonly kind: "note" } | { readonly kind: "tag"; readonly tag: Tag };

export const NOTE_GRAPH_MODE: GraphMode = { kind: "note" };

/**
 * The mode AS RENDERED: what the status pill says about the graph on screen.
 * Derived from the mode plus the published graph — never stored beside them.
 */
export type GraphModeStatus =
	| {
			readonly kind: "note";
			/** The MAIN note's title; `null` while no graph is on screen. */
			readonly noteTitle: string | null;
	  }
	| {
			readonly kind: "tag";
			readonly tag: Tag;
			/** Every note the filter matched — the ones the node cap hid included. */
			readonly noteCount: number;
	  };

/** The per-leaf view-state key the mode is saved under (`VicinityGraphView.getState`). */
export const GRAPH_MODE_STATE_KEY = "graphMode";

/** The saved shape: the tag by its DISPLAY name — the key is re-derived on load. */
export type SavedGraphMode = { readonly kind: "note" } | { readonly kind: "tag"; readonly tag: string };

const TAG_MARKER = "#";

export class GraphModes {
	static tag(tag: Tag): GraphMode {
		return { kind: "tag", tag };
	}

	/** Same mode ⇒ switching to it is a no-op (tags compare by identity, not casing). */
	static same(a: GraphMode, b: GraphMode): boolean {
		if (a.kind === "tag" && b.kind === "tag") {
			return a.tag.key === b.tag.key;
		}
		return a.kind === b.kind;
	}

	static statusOf(mode: GraphMode, graph: VicinityGraph | null): GraphModeStatus {
		if (mode.kind === "note") {
			return { kind: "note", noteTitle: graph?.nodes.find((node) => node.isMain)?.title ?? null };
		}
		return { kind: "tag", tag: mode.tag, noteCount: graph === null ? 0 : GraphModes.matchedNoteCount(graph) };
	}

	static toSaved(mode: GraphMode): SavedGraphMode {
		return mode.kind === "tag" ? { kind: "tag", tag: mode.tag.name } : { kind: "note" };
	}

	/**
	 * Reads a saved mode back. `undefined` when `raw` is not a mode this version
	 * understands (hand-edited workspace file, a future kind): the caller keeps the
	 * mode it has rather than guessing.
	 */
	static fromSaved(raw: unknown): GraphMode | undefined {
		if (typeof raw !== "object" || raw === null) {
			return undefined;
		}
		const saved = raw as { readonly kind?: unknown; readonly tag?: unknown };
		if (saved.kind === "note") {
			return NOTE_GRAPH_MODE;
		}
		if (saved.kind === "tag" && typeof saved.tag === "string") {
			const tag = Tags.parse(saved.tag);
			return tag === undefined ? undefined : GraphModes.tag(tag);
		}
		return undefined;
	}

	/** Visible + truncated: the engine reports the hidden ones per folder. */
	private static matchedNoteCount(graph: VicinityGraph): number {
		let hidden = 0;
		for (const count of graph.hiddenNodeCountsByFolder.values()) {
			hidden += count;
		}
		return graph.nodes.length + hidden;
	}
}

export interface GraphModeSummaryParts {
	readonly lead: string;
	readonly subject: string;
	readonly detail: string | null;
}

/** THE user-facing copy for the mode — the pill and the empty/failed states read it here. */
export class GraphModeCopy {
	static readonly EXIT_TAG_MODE = "Back to active note";

	static tagLabel(tag: Tag): string {
		return TAG_MARKER + tag.name;
	}

	/**
	 * The pill's wording, in the three parts it styles apart: the muted mode word,
	 * the subject (note title / tag) and an optional muted detail.
	 */
	static parts(status: GraphModeStatus): GraphModeSummaryParts {
		if (status.kind === "note") {
			return { lead: "Vicinity of", subject: status.noteTitle ?? "the active note", detail: null };
		}
		return {
			lead: "Tagged",
			subject: GraphModeCopy.tagLabel(status.tag),
			detail: GraphModeCopy.noteCount(status.noteCount),
		};
	}

	/** `1 note` / `12 notes` — the pill and the tag picker count notes in one wording. */
	static noteCount(count: number): string {
		return count === 1 ? "1 note" : `${count} notes`;
	}

	/** The pill's wording as one line (`Tagged #todo · 12 notes`). */
	static summary(status: GraphModeStatus): string {
		const { lead, subject, detail } = GraphModeCopy.parts(status);
		return detail === null ? `${lead} ${subject}` : `${lead} ${subject} · ${detail}`;
	}

	/** The hover explanation: what this mode shows and whether it follows the open note. */
	static explanation(status: GraphModeStatus): string {
		if (status.kind === "note") {
			return "Shows the note you have open and the notes linked to it. The graph follows whichever note you open.";
		}
		return (
			`Shows every note tagged ${GraphModeCopy.tagLabel(status.tag)}, whether or not they link to each other. ` +
			`The graph stays on this tag when you open other notes — use "${GraphModeCopy.EXIT_TAG_MODE}" to leave.`
		);
	}

	static readonly EXIT_TAG_MODE_HINT = "Go back to the vicinity of the note you have open";

	/** One entry of a several-tag box label's menu, and the tooltip of a clickable tag. */
	static showTaggedNotes(tag: Tag): string {
		return `Show notes tagged ${GraphModeCopy.tagLabel(tag)}`;
	}

	/** A several-tag box label's tooltip: clicking it asks which of its tags. */
	static readonly PICK_TAG_TO_SHOW = "Pick one of these tags to show the notes carrying it";

	static emptyTag(tag: Tag): string {
		return `No notes are tagged ${GraphModeCopy.tagLabel(tag)}.`;
	}

	static failedTag(tag: Tag): string {
		return `Could not build the graph of notes tagged ${GraphModeCopy.tagLabel(tag)}.`;
	}
}
