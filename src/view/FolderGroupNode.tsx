import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";
import { groupHiddenTitleText, plusNText } from "./badgeText";
import type { FlowGroupData } from "./flowMapping";
import { useGraphUi } from "./GraphUiContext";
import { useNoteOpen } from "./NoteOpenContext";
import { opensInNewTab } from "./nodeOpenIntent";
import type { NodeMenuEntry, NoteOpenPort } from "./viewPorts";

/**
 * Folder-group container (step-05): neutral Obsidian-theme styling — visible
 * neutral border, secondary-background fill, folder-name label — deliberately NO
 * folder colors (human decision, CLARIFICATION palette section). The "+N"
 * badge surfaces this folder's truncated-away members (Q4). Member nodes
 * render on top because React Flow orders parents before children.
 *
 * The NAME LABEL navigates to the folder's folder-note candidate(s) when any
 * exist (ticket `nid_2pobjyfp5zgspx283bfukaugn_e`): one candidate opens
 * directly (ctrl/cmd = new tab, the same gesture as a node click); several open
 * the native candidate menu at the cursor. No candidates = the label stays
 * inert (no handler, unchanged muted styling).
 */

export type FolderGroupNodeType = Node<FlowGroupData, "folder-group">;

export const FolderGroupNode = memo(function FolderGroupNode({
	data,
}: NodeProps<FolderGroupNodeType>): ReactElement {
	const noteOpen = useNoteOpen();
	const ui = useGraphUi();
	const candidates = data.folderNoteCandidates;
	const onLabelClick = (event: ReactMouseEvent<HTMLSpanElement>): void => {
		// The label is a CONTROL riding the group node: without this the click also
		// bubbles into React Flow's onNodeClick pipeline (a folder-group id is inert
		// there, but its handler still closes the preview drawer) — the label owns
		// its gesture outright, leaving group-level behaviour untouched.
		event.stopPropagation();
		const [winner, ...losers] = candidates;
		if (winner === undefined) {
			return; // Unreachable — the handler is only attached when candidates exist.
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
	return (
		<div className="vicinity-graph-group" data-folder={data.folder}>
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
					className={labelClassName(data)}
					title={data.folder}
					{...(candidates.length === 0 ? {} : { onClick: onLabelClick })}
				>
					{data.folderName}
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

/** One candidate as a native-menu entry: labelled by its vault path, opens in the current tab. */
function candidateMenuEntry(path: string, noteOpen: NoteOpenPort): NodeMenuEntry {
	return { title: path, onClick: () => noteOpen.openNote(path, { newTab: false }) };
}

/** Base label class, plus the front-truncation and clickable-navigation modifiers. */
function labelClassName(data: FlowGroupData): string {
	const classes = ["vicinity-graph-group__label"];
	if (data.fullPathLabel) {
		classes.push("vicinity-graph-group__label--fullpath");
	}
	if (data.folderNoteCandidates.length > 0) {
		// "nodrag nopan" are React Flow escape hatches (same as the NoteNode chips):
		// a click on a NAVIGABLE label must never start a node drag or a canvas pan —
		// otherwise a pan gesture released over the label also fires its onClick.
		classes.push("vicinity-graph-group__label--navigable", "nodrag", "nopan");
	}
	return classes.join(" ");
}
