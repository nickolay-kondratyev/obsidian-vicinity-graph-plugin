import type { Node, NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { ReactElement } from "react";
import { groupHiddenTitleText, plusNText } from "./badgeText";
import type { FlowGroupData } from "./flowMapping";

/**
 * Folder-group container (step-05): neutral Obsidian-theme styling — subtle
 * border, secondary-background fill, folder-name label — deliberately NO
 * folder colors (human decision, CLARIFICATION palette section). The "+N"
 * badge surfaces this folder's truncated-away members (Q4). Member nodes
 * render on top because React Flow orders parents before children.
 */

export type FolderGroupNodeType = Node<FlowGroupData, "folder-group">;

export const FolderGroupNode = memo(function FolderGroupNode({
	data,
}: NodeProps<FolderGroupNodeType>): ReactElement {
	return (
		<div className="vicinity-graph-group" data-folder={data.folder}>
			<div className="vicinity-graph-group__header">
				<span className="vicinity-graph-group__label" title={data.folder}>
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
		</div>
	);
});
