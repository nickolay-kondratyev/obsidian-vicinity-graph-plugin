import { Handle, NodeResizeControl, Position, ResizeControlVariant } from "@xyflow/react";
import type { Node, NodeProps, OnResizeEnd } from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";
import { attachmentGroupLabel, attachmentIconId } from "./attachmentIcons";
import type { AttachmentIconGroup } from "./attachmentIconStrip";
import { extraImageCountText } from "./badgeText";
import { useControlsActions } from "./ControlsActionsContext";
import type { FlowNodeData } from "./flowMapping";
import { useGraphUi } from "./GraphUiContext";
import { NodeOutline } from "./NodeOutline";
import { currentNodeContentChoice, planNodeContentMenu } from "./nodePreviewChoice";
import { planNodeLocalPinAction, planNodePinAction } from "./nodePinAction";
import { NODE_RESIZE_BOUNDS, planResetSizeAction, resizeEndToOverride } from "./nodeResize";
import type { NodeMenuEntry } from "./viewPorts";

/**
 * The rich note node (step-05): title, lazy first-image thumbnail
 * with a "+N" badge, and an attachment icon strip whose chips open a native
 * menu. Tier styling (MAIN / pinned-central / regular) is pure CSS keyed on
 * `data-tier`; content density adapts to the node's engine-driven height via
 * CSS container queries — no JS measuring. All Obsidian access goes through
 * {@link GraphUiContext}.
 *
 * Renders only: the outline-vs-thumbnail choice arrives pre-made as
 * `data.preview` (decided in `flowMapping`), so `data-preview` can never
 * advertise a region this component does not mount.
 */

export type NoteNodeType = Node<FlowNodeData, "note">;

/** Lucide id of the hover gear (per-node content menu) — the conventional settings glyph. */
const GEAR_ICON_ID = "settings";
/**
 * Native-menu section ids for the gear menu, kept apart so a separator is drawn
 * between the Content choices and "Reset size" (see {@link NodeMenuEntry.section}).
 */
const CONTENT_MENU_SECTION = "content";
const SIZE_MENU_SECTION = "size";

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
	// Every node toggles — including MAIN, whose pin keeps it central after
	// the human navigates to another note.
	// This is the GLOBAL pin toggle; the local-pin control is the dependent UI ticket.
	const pinAction = useMemo(() => planNodePinAction(data.isGloballyPinned), [data.isGloballyPinned]);
	const runPinAction = useCallback(() => {
		if (pinAction.kind === "pin") {
			void actions.pinNode(data.path);
		} else if (data.docid !== undefined) {
			void actions.unpinNode(data.docid);
		}
	}, [pinAction.kind, actions, data.path, data.docid]);
	// The SECOND, independent pin toggle (LOCAL PINNING): a target pinned only while
	// this main is active. Withheld on the MAIN node itself — a note cannot be locally
	// pinned under itself (decision Q4) — so both the hover chip and the menu entry are
	// gated on this. A node can hold BOTH pin kinds; each toggle reads its own flag.
	const offersLocalPin = data.tier !== "main";
	const localPinAction = useMemo(() => planNodeLocalPinAction(data.isLocallyPinned), [data.isLocallyPinned]);
	const runLocalPinAction = useCallback(() => {
		if (localPinAction.kind === "local-pin") {
			void actions.localPinNode(data.path);
		} else if (data.docid !== undefined) {
			void actions.localUnpinNode(data.docid);
		}
	}, [localPinAction.kind, actions, data.path, data.docid]);
	const onContextMenu = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			// Suppress the browser menu and the RF pane menu.
			event.preventDefault();
			event.stopPropagation();
			// Pin/unpin is the entry EVERY node has, so it is what makes the menu non-empty.
			const entries: [NodeMenuEntry, ...NodeMenuEntry[]] = [
				{ title: pinAction.title, iconId: pinAction.iconId, onClick: runPinAction },
			];
			// The local-pin entry sits right after the global one (the two pin toggles read
			// as a pair) — but only off the MAIN, which cannot be locally pinned under itself.
			if (offersLocalPin) {
				entries.push({
					title: localPinAction.title,
					iconId: localPinAction.iconId,
					onClick: runLocalPinAction,
				});
			}
			const resetSize = planResetSizeAction(data.hasSizeOverride);
			if (resetSize !== null) {
				entries.push({
					title: resetSize.title,
					iconId: resetSize.iconId,
					description: resetSize.description,
					onClick: () => void actions.resetNodeSize(data.path),
				});
			}
			ui.showNodeMenu({ nativeEvent: event.nativeEvent, entries });
		},
		[
			pinAction,
			offersLocalPin,
			localPinAction,
			ui,
			runPinAction,
			runLocalPinAction,
			actions,
			data.hasSizeOverride,
			data.path,
		],
	);
	// Commit-on-release (the drag itself only moves the local React Flow box —
	// see VicinityGraphFlow's onNodesChange): persist the released box as the
	// doc's global size override, then the pipeline's fan-out runs the ONE
	// rebuild/relayout.
	const onResizeEnd = useCallback<OnResizeEnd>(
		(_event, params) => {
			void actions.resizeNode(data.path, resizeEndToOverride(params.width, params.height));
		},
		[actions, data.path],
	);
	// The hover gear's per-node menu: a Content override row (Inherit / Title only /
	// Outline / Image, the current one checked) and — once a size override exists —
	// "Reset size". `NoteNode` assembles the plan into native entries and wires the
	// clicks; the decision of WHAT to show is the pure planner's.
	const onGearClick = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			// The gear must not double as a node click (which would open the note).
			event.stopPropagation();
			const contentEntries: NodeMenuEntry[] = planNodeContentMenu(
				currentNodeContentChoice(data.contentOverride),
			).map((item) => ({
				title: item.label,
				checked: item.checked,
				section: CONTENT_MENU_SECTION,
				onClick: () => {
					if (item.choice === "inherit") {
						void actions.clearNodeContentOverride(data.path);
					} else {
						void actions.setNodeContentOverride(data.path, item.choice);
					}
				},
			}));
			// The Content row is never empty (Inherit is always offered), so this holds;
			// the guard makes that a type fact, not a `!`.
			const [firstContent, ...restContent] = contentEntries;
			if (firstContent === undefined) {
				return;
			}
			const entries: [NodeMenuEntry, ...NodeMenuEntry[]] = [firstContent, ...restContent];
			const resetSize = planResetSizeAction(data.hasSizeOverride);
			if (resetSize !== null) {
				entries.push({
					title: resetSize.title,
					iconId: resetSize.iconId,
					description: resetSize.description,
					section: SIZE_MENU_SECTION,
					onClick: () => void actions.resetNodeSize(data.path),
				});
			}
			ui.showNodeMenu({ nativeEvent: event.nativeEvent, entries });
		},
		[actions, ui, data.contentOverride, data.hasSizeOverride, data.path],
	);

	return (
		<>
			{/* Drag-to-resize (hover-revealed via CSS): BOTTOM/RIGHT edges + corner
			    only, deliberately no top/left controls — those resize by MOVING the
			    node's origin, and node positions are controller-owned (elk layout,
			    reused on data-only rebuilds), so a moved origin would snap back on
			    the commit rebuild. Anchored growth has no such lie.

			    SIBLINGS of `.vicinity-graph-node`, not children of it: React Flow
			    centres each grip ON the node's edge (`left/top: 100%` + a 50%
			    translate), while `.vicinity-graph-node` is `overflow: hidden` (it
			    must clip its title/thumbnail). Nested, that clip cut the grips down
			    to the sliver that fell inside the padding box — the 1px edge lines
			    all but vanished and only a quarter of the corner chip survived.
			    `.react-flow__node` is positioned and clips nothing, so the grips
			    keep the geometry React Flow computes for them. */}
			<NodeResizeControl
				variant={ResizeControlVariant.Line}
				position="right"
				{...NODE_RESIZE_BOUNDS}
				onResizeEnd={onResizeEnd}
			/>
			<NodeResizeControl
				variant={ResizeControlVariant.Line}
				position="bottom"
				{...NODE_RESIZE_BOUNDS}
				onResizeEnd={onResizeEnd}
			/>
			<NodeResizeControl position="bottom-right" {...NODE_RESIZE_BOUNDS} onResizeEnd={onResizeEnd} />
			<div
				className="vicinity-graph-node"
				data-tier={data.tier}
				data-path={data.path}
				data-preview={data.preview}
				onContextMenu={onContextMenu}
			>
				{offersLocalPin && (
					<PinButton
						action={localPinAction}
						onActivate={runLocalPinAction}
						variantClassName="vicinity-graph-local-pin-button"
					/>
				)}
				<PinButton
					action={pinAction}
					onActivate={runPinAction}
					variantClassName="vicinity-graph-pin-button"
				/>
				<GearButton onActivate={onGearClick} />
				{/* Read-only graph: handles exist only as edge anchors (top target /
				    bottom source matches the elk DOWN direction) and are hidden in CSS. */}
				<Handle type="target" position={Position.Top} className="vicinity-graph-node__handle" />
				<div className="vicinity-graph-node__content">
					<div className="vicinity-graph-node__title" title={data.title}>
						{data.title}
					</div>
					{data.preview === "thumbnail" && thumbnailUrl !== null && (
						<div className="vicinity-graph-node__thumbnail">
							{/* alt="" — decorative; the adjacent title already names the note. */}
							<img src={thumbnailUrl} alt="" loading="lazy" draggable={false} />
							{extraImages !== null && (
								<span className="vicinity-graph-node__thumbnail-badge">{extraImages}</span>
							)}
						</div>
					)}
				</div>
				{/* A SIBLING of the content zone, not a child: whichever of the two is
				    growing must be the one that reaches the node's spare height. In
				    outline mode CSS hands the grow to the outline (the content zone
				    drops to `flex: 0 0 auto`), which only works while the outline is
				    the zone's sibling — nested, it would be capped by the zone. */}
				{data.preview === "outline" && <NodeOutline notePath={data.path} entries={data.outline} />}
				{data.attachmentGroups.length > 0 && (
					<div className="vicinity-graph-node__attachments">
						{data.attachmentGroups.map((group) => (
							<AttachmentChip key={group.extension} group={group} />
						))}
					</div>
				)}
				<Handle type="source" position={Position.Bottom} className="vicinity-graph-node__handle" />
			</div>
		</>
	);
});

/**
 * Hover-reveal pin/unpin button. Two of these ride the node's top-RIGHT corner: the
 * GLOBAL pin just left of the gear, and — off the MAIN — the LOCAL pin one chip
 * further left, so the row reads LOCAL GLOBAL GEAR. `variantClassName` is the ONLY
 * difference between the two instances: it carries the per-chip horizontal placement
 * (`vicinity-graph-pin-button` / `vicinity-graph-local-pin-button`); everything else —
 * chrome, hover reveal, icon — is the shared chip. Hidden until the node is hovered
 * (CSS), a `nodrag nopan` escape hatch so the click never starts a node drag or canvas
 * pan. Its click carries the same shared pin decision as the matching context entry.
 */
function PinButton({
	action,
	onActivate,
	variantClassName,
}: {
	readonly action: { readonly title: string; readonly iconId: string };
	readonly onActivate: () => void;
	readonly variantClassName: string;
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
			className={`vicinity-graph-node-chip ${variantClassName} nodrag nopan`}
			aria-label={action.title}
			title={action.title}
			onClick={onClick}
		>
			<span ref={iconRef} className="vicinity-graph-node-chip__icon" aria-hidden="true" />
		</button>
	);
}

/**
 * Hover-reveal gear button (top-right corner of the node — the conventional
 * settings corner; the pin sits just to its left and the resize grips own the
 * bottom/right edges, so nothing here fights for the same clicks). Hidden until the node is hovered
 * (CSS), a `nodrag nopan` escape hatch so the click never starts a node drag or
 * canvas pan. Its click opens the per-node content/size menu at the cursor.
 */
function GearButton({
	onActivate,
}: {
	readonly onActivate: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}): ReactElement {
	const ui = useGraphUi();
	const iconRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (iconRef.current !== null) {
			ui.renderIcon(iconRef.current, GEAR_ICON_ID);
		}
	}, [ui]);
	return (
		<button
			type="button"
			className="vicinity-graph-node-chip vicinity-graph-gear-button nodrag nopan"
			aria-label="Node settings"
			title="Node settings"
			onClick={onActivate}
		>
			<span ref={iconRef} className="vicinity-graph-node-chip__icon" aria-hidden="true" />
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
			className="vicinity-graph-attachment nodrag nopan"
			data-extension={group.extension}
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			<span ref={iconRef} className="vicinity-graph-attachment__icon" aria-hidden="true" />
			<span className="vicinity-graph-attachment__count">{group.count}</span>
		</button>
	);
}
