import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";
import type { OutlineEntry } from "../engine";
import { outlineEntryOpenOptions } from "./nodeOpenIntent";
import { useNoteOpen } from "./NoteOpenContext";
import { buildOutlineTree } from "./outlineTree";
import type { OutlineTreeNode } from "./outlineTree";
import { outlineEntryLabel } from "./outlineEntryLabel";

/**
 * The note's markdown heading outline, rendered inside its graph node
 * (CLARIFICATION Q9). This component owns EVERYTHING about that UI — the scroll
 * container, the nested list, the labels and the click behaviour — deliberately
 * separate from `NoteNode` so this first-iteration UI (collapse toggles, active
 * heading, counts…) can be reworked without touching node rendering.
 *
 * Its props are a primitive plus a POJO array: no `FlowNodeData`, no callbacks.
 * That is what keeps the boundary real — `NoteNode` has nothing to leak in, and
 * new interactions are added here, not to `NoteNode`'s prop list.
 *
 * Styles live in `node-outline.css`; the single exception is the
 * `display: block` reveal at the 104px density threshold, which stays with the
 * rest of the ladder in `graph-view.css`.
 */

export interface NodeOutlineProps {
	/** Vault path of the note this outline belongs to — the open target. */
	readonly notePath: string;
	/** Depth-filtered, budget-capped entries in DOCUMENT ORDER, with RAW heading text. */
	readonly entries: readonly OutlineEntry[];
}

export function NodeOutline({ notePath, entries }: NodeOutlineProps): ReactElement {
	// WHY-NOT useMemo: `toFlowNodeData` mints a fresh `entries` array on every
	// rebuild, so a memo keyed on it could never hit. The work is a handful of
	// regex passes over ≤ OUTLINE_RENDER_LIMIT short strings.
	const tree = buildOutlineTree(entries);
	return (
		// React Flow's zoom is a NATIVE d3-zoom listener on the pane, so a React
		// onWheel + stopPropagation would not stop it; `nowheel` is the supported
		// escape hatch (checked inside RF's own wheel handler). Accepted cost: while
		// the pointer is over an outline the wheel scrolls the list rather than
		// zooming the canvas, even when the list does not overflow.
		<div className="vicinity-graph-outline nowheel nodrag nopan">
			<OutlineBranch nodes={tree} notePath={notePath} isRoot />
		</div>
	);
}

/** One `<ul>` level. Only the ROOT is labelled — nested lists inherit context
 *  from the DOM, and labelling each would announce "Note outline" per level. */
function OutlineBranch({
	nodes,
	notePath,
	isRoot = false,
}: {
	readonly nodes: readonly OutlineTreeNode[];
	readonly notePath: string;
	readonly isRoot?: boolean;
}): ReactElement {
	return (
		<ul className="vicinity-graph-outline__list" {...(isRoot ? { "aria-label": "Note outline" } : {})}>
			{nodes.map((node, index) => (
				// Heading text repeats within a note, so index-in-branch is the stable
				// identity here (the list is regenerated wholesale on every rebuild).
				<li className="vicinity-graph-outline__item" key={`${node.entry.level}:${index}:${node.entry.rawText}`}>
					<OutlineEntryButton entry={node.entry} notePath={notePath} />
					{node.children.length > 0 && <OutlineBranch nodes={node.children} notePath={notePath} />}
				</li>
			))}
		</ul>
	);
}

/** One heading row: the stripped label, opening the note at the RAW heading. */
function OutlineEntryButton({
	entry,
	notePath,
}: {
	readonly entry: OutlineEntry;
	readonly notePath: string;
}): ReactElement {
	const noteOpen = useNoteOpen();
	const label = outlineEntryLabel(entry.rawText);
	const onClick = (event: ReactMouseEvent<HTMLButtonElement>): void => {
		// Without this the canvas-level onNodeClick would ALSO fire and open the
		// note at its top — same pattern as PinButton / AttachmentChip.
		event.stopPropagation();
		noteOpen.openNote(notePath, outlineEntryOpenOptions(entry.rawText, event));
	};
	return (
		<button type="button" className="vicinity-graph-outline__entry" title={label} onClick={onClick}>
			{label}
		</button>
	);
}
