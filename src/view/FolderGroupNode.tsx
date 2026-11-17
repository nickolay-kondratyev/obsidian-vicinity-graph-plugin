import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";
import { groupHiddenTitleText, plusNText } from "./badgeText";
import type { FlowGroupData } from "./flowMapping";
import { useGraphUi } from "./GraphUiContext";
import type { Tag } from "../shared/Tags";
import { GraphModeCopy } from "./graphMode";
import { useNoteOpen } from "./NoteOpenContext";
import { opensInNewTab } from "./nodeOpenIntent";
import { useTagFilter } from "./TagFilterContext";
import type { GraphUiPort, NodeMenuEntry, NoteOpenPort, TagFilterPort } from "./viewPorts";

/**
 * Group container (step-05), rendered from the mode-agnostic
 * {@link FlowGroupData} — it never asks which grouper made the box. Neutral
 * Obsidian-theme styling — visible neutral border, secondary-background fill,
 * name label — deliberately NO folder colors (human decision, CLARIFICATION
 * palette section). A box that carries a `colorToken` (every TAG box) paints it
 * as a tinted border + header through `data-color` (graph-view.css, "tag colours"),
 * a theme variable per token, so light and dark both work. The "+N"
 * badge surfaces the group's truncated-away members (Q4). Member nodes
 * render on top because React Flow orders parents before children.
 *
 * The NAME LABEL navigates to the folder's folder-note candidate(s) when any
 * exist (ticket `nid_2pobjyfp5zgspx283bfukaugn_e`): one candidate opens
 * directly (ctrl/cmd = new tab, the same gesture as a node click); several open
 * the native candidate menu at the cursor. No candidates = the label stays
 * inert (no handler, unchanged muted styling). A TAG box's label instead enters
 * tag-filtered mode for its tag (several tags: a menu asks which).
 */

export type FolderGroupNodeType = Node<FlowGroupData, "folder-group">;

export const FolderGroupNode = memo(function FolderGroupNode({
	data,
}: NodeProps<FolderGroupNodeType>): ReactElement {
	const noteOpen = useNoteOpen();
	const ui = useGraphUi();
	const tagFilter = useTagFilter();
	const candidates = data.folderNoteCandidates;
	const labelTags = data.labelTags ?? NO_LABEL_TAGS;
	const onLabelClick = (event: ReactMouseEvent<HTMLSpanElement>): void => {
		// The label is a CONTROL riding the group node: without this the click also
		// bubbles into React Flow's onNodeClick pipeline (a folder-group id is inert
		// there, but its handler still closes the preview drawer) — the label owns
		// its gesture outright, leaving group-level behaviour untouched.
		event.stopPropagation();
		if (labelTags.length > 0) {
			showTaggedNotesFromLabel(event, labelTags, tagFilter, ui);
			return;
		}
		const [winner, ...losers] = candidates;
		if (winner === undefined) {
			return; // Unreachable — the handler is only attached when candidates or tags exist.
		}
		if (losers.length === 0) {
			noteOpen.openNote(winner, { newTab: opensInNewTab(event) });
			return;
		}
		// 2+ candidates: the native menu at the click position, in precedence order,
		// each labelled by its vault path (R2). Menu selections open in the current
		// tab — the Menu callback carries no modifier state through this seam (v1).
		ui.showNodeMenu({
			nativeEvent: event.nativeEvent,
			entries: [candidateMenuEntry(winner, noteOpen), ...losers.map((path) => candidateMenuEntry(path, noteOpen))],
		});
	};
	const isNavigable = candidates.length > 0 || labelTags.length > 0;
	return (
		<div
			className="vicinity-graph-group"
			{...(data.folder === null ? {} : { "data-folder": data.folder })}
			{...(data.colorToken === null ? {} : { "data-color": data.colorToken })}
			// The tag box's DOM hook (the twin of `data-folder`): its label tag keys.
			{...(data.labelTags === undefined ? {} : { "data-tags": data.labelTags.map((tag) => tag.key).join(" ") })}
		>
			{/* Hidden edge anchors so collapsed edges can point at the group box
			    (mirrors NoteNode). isConnectable=false keeps groups non-interactive
			    for links — they are edge-addressable only. */}
			<Handle
				type="target"
				position={Position.Top}
				className="vicinity-graph-node__handle"
				isConnectable={false}
			/>
			<div className="vicinity-graph-group__header">
				<span
					className={labelClassName(data.fullPathLabel, isNavigable)}
					title={labelTitle(data.fullLabel, labelTags)}
					{...(isNavigable ? { onClick: onLabelClick } : {})}
				>
					{data.label}
				</span>
				{data.hiddenCount > 0 && (
					<span
						className="vicinity-graph-group__badge"
						title={groupHiddenTitleText(data.hiddenCount)}
					>
						{plusNText(data.hiddenCount)}
					</span>
				)}
			</div>
			<Handle
				type="source"
				position={Position.Bottom}
				className="vicinity-graph-node__handle"
				isConnectable={false}
			/>
		</div>
	);
});

const NO_LABEL_TAGS: readonly Tag[] = [];

/**
 * A TAG box label enters tag mode (ticket `nid_6qj8n7uc7zz126l3ix8czfymq_e`): one
 * tag enters it directly; a box labelled with several tags (`#important
 * #follow-up`) asks which, through the same native menu the folder candidates use.
 */
function showTaggedNotesFromLabel(
	event: ReactMouseEvent<HTMLSpanElement>,
	labelTags: readonly Tag[],
	tagFilter: TagFilterPort,
	ui: GraphUiPort,
): void {
	const [first, ...rest] = labelTags;
	if (first === undefined) {
		return; // Unreachable — the caller checked for tags.
	}
	if (rest.length === 0) {
		tagFilter.showTaggedNotes(first);
		return;
	}
	ui.showNodeMenu({
		nativeEvent: event.nativeEvent,
		entries: [tagMenuEntry(first, tagFilter), ...rest.map((tag) => tagMenuEntry(tag, tagFilter))],
	});
}

function tagMenuEntry(tag: Tag, tagFilter: TagFilterPort): NodeMenuEntry {
	return { title: GraphModeCopy.showTaggedNotes(tag), onClick: () => tagFilter.showTaggedNotes(tag) };
}

/**
 * A tag label's tooltip says what a click does AND names every tag of the label (one
 * tag: inside the action; several: on a first line); a folder label's shows its full path.
 */
function labelTitle(fullLabel: string, labelTags: readonly Tag[]): string {
	const [only, ...rest] = labelTags;
	if (only === undefined) {
		return fullLabel;
	}
	return rest.length === 0 ? GraphModeCopy.showTaggedNotes(only) : GraphModeCopy.pickTagToShow(labelTags);
}

/** One candidate as a native-menu entry: labelled by its vault path, opens in the current tab. */
function candidateMenuEntry(path: string, noteOpen: NoteOpenPort): NodeMenuEntry {
	return { title: path, onClick: () => noteOpen.openNote(path, { newTab: false }) };
}

/** Base label class, plus the front-truncation and clickable-navigation modifiers. */
function labelClassName(fullPathLabel: boolean, isNavigable: boolean): string {
	const classes = ["vicinity-graph-group__label"];
	if (fullPathLabel) {
		classes.push("vicinity-graph-group__label--fullpath");
	}
	if (isNavigable) {
		// "nodrag nopan" are React Flow escape hatches (same as the NoteNode chips):
		// a click on a NAVIGABLE label must never start a node drag or a canvas pan —
		// otherwise a pan gesture released over the label also fires its onClick.
		classes.push("vicinity-graph-group__label--navigable", "nodrag", "nopan");
	}
	return classes.join(" ");
}
