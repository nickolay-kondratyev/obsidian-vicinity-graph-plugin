import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";
import { attachmentGroupLabel, attachmentIconId } from "./attachmentIcons";
import type { AttachmentIconGroup } from "./attachmentIconStrip";
import { extraImageCountText } from "./badgeText";
import { useControlsActions } from "./ControlsActionsContext";
import type { FlowNodeData } from "./flowMapping";
import { useGraphUi } from "./GraphUiContext";
import { planNodePinAction } from "./nodePinAction";

/**
 * The rich note node (step-05): breadcrumbed title, lazy first-image thumbnail
 * with a "+N" badge, and an attachment icon strip whose chips open a native
 * menu. Tier styling (MAIN / pinned-central / regular) is pure CSS keyed on
 * `data-tier`; content density adapts to the node's engine-driven square via
 * CSS container queries — no JS measuring. All Obsidian access goes through
 * {@link GraphUiContext}.
 */

export type NoteNodeType = Node<FlowNodeData, "note">;

export const NoteNode = memo(function NoteNode({ data }: NodeProps<NoteNodeType>): ReactElement {
	const ui = useGraphUi();
	const actions = useControlsActions();
	const thumbnailUrl = useMemo(
		() => (data.firstImagePath === undefined ? null : ui.resourcePath(data.firstImagePath)),
		[ui, data.firstImagePath],
	);
	const extraImages = extraImageCountText(data.imageCount);

	// Pin/unpin is one shared pure decision (title/icon/applicability) driving
	// BOTH the hover button and the right-click menu (CLARIFICATION Q3).
	const pinAction = useMemo(() => planNodePinAction(data.tier), [data.tier]);
	const runPinAction = useCallback(() => {
		if (pinAction.kind === "pin") {
			void actions.pinNode(data.path);
		} else if (pinAction.kind === "unpin" && data.docid !== undefined) {
			void actions.unpinNode(data.docid);
		}
	}, [pinAction.kind, actions, data.path, data.docid]);
	const onContextMenu = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			// Suppress the browser menu and the RF pane; MAIN (kind "none") gets
			// neither our menu nor the native one.
			event.preventDefault();
			event.stopPropagation();
			if (pinAction.kind === "none") {
				return;
			}
			ui.showNodeMenu({
				nativeEvent: event.nativeEvent,
				entry: { title: pinAction.title, iconId: pinAction.iconId, onClick: runPinAction },
			});
		},
		[pinAction, ui, runPinAction],
	);

	return (
		<div
			className="neighborhood-graph-node"
			data-tier={data.tier}
			data-path={data.path}
			onContextMenu={onContextMenu}
		>
			{pinAction.kind !== "none" && <PinButton action={pinAction} onActivate={runPinAction} />}
			{/* Read-only graph: handles exist only as edge anchors (top target /
			    bottom source matches the elk DOWN direction) and are hidden in CSS. */}
			<Handle type="target" position={Position.Top} className="neighborhood-graph-node__handle" />
			<div className="neighborhood-graph-node__title" title={data.title}>
				{data.breadcrumbFolder !== undefined && (
					<span className="neighborhood-graph-node__breadcrumb">{data.breadcrumbFolder}/</span>
				)}
				{data.title}
			</div>
			{thumbnailUrl !== null && (
				<div className="neighborhood-graph-node__thumbnail">
					{/* alt="" — decorative; the adjacent title already names the note. */}
					<img src={thumbnailUrl} alt="" loading="lazy" draggable={false} />
					{extraImages !== null && (
						<span className="neighborhood-graph-node__thumbnail-badge">{extraImages}</span>
					)}
				</div>
			)}
			{data.attachmentGroups.length > 0 && (
				<div className="neighborhood-graph-node__attachments">
					{data.attachmentGroups.map((group) => (
						<AttachmentChip key={group.extension} group={group} />
					))}
				</div>
			)}
			<Handle type="source" position={Position.Bottom} className="neighborhood-graph-node__handle" />
		</div>
	);
});

/**
 * Hover-reveal pin/unpin button (top-right of the node). Hidden until the node
 * is hovered (CSS), a `nodrag nopan` escape hatch so the click never starts a
 * node drag or canvas pan. Its click carries the same shared pin decision as
 * the context menu.
 */
function PinButton({
	action,
	onActivate,
}: {
	readonly action: { readonly title: string; readonly iconId: string };
	readonly onActivate: () => void;
}): ReactElement {
	const ui = useGraphUi();
	const iconRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (iconRef.current !== null) {
			ui.renderIcon(iconRef.current, action.iconId);
		}
	}, [ui, action.iconId]);
	const onClick = (event: ReactMouseEvent<HTMLButtonElement>): void => {
		// The button must not double as a node click (which would open the note).
		event.stopPropagation();
		onActivate();
	};
	return (
		<button
			type="button"
			className="neighborhood-graph-pin-button nodrag nopan"
			aria-label={action.title}
			title={action.title}
			onClick={onClick}
		>
			<span ref={iconRef} className="neighborhood-graph-pin-button__icon" aria-hidden="true" />
		</button>
	);
}

/** One icon-strip chip: extension icon + count; click opens the native attachment menu. */
function AttachmentChip({ group }: { readonly group: AttachmentIconGroup }): ReactElement {
	const ui = useGraphUi();
	const iconRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (iconRef.current !== null) {
			ui.renderIcon(iconRef.current, attachmentIconId(group.extension));
		}
	}, [ui, group.extension]);
	const label = attachmentGroupLabel(group.extension, group.count);
	const onClick = (event: ReactMouseEvent<HTMLButtonElement>): void => {
		// The chip must not double as a node click (which would open the note).
		event.stopPropagation();
		ui.showAttachmentMenu({ nativeEvent: event.nativeEvent, paths: group.paths });
	};
	return (
		// "nodrag nopan" are React Flow escape hatches: clicking the chip must
		// not start a node drag or a canvas pan.
		<button
			type="button"
			className="neighborhood-graph-attachment nodrag nopan"
			data-extension={group.extension}
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			<span ref={iconRef} className="neighborhood-graph-attachment__icon" aria-hidden="true" />
			<span className="neighborhood-graph-attachment__count">{group.count}</span>
		</button>
	);
}
