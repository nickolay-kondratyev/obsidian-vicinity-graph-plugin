import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent, ReactElement } from "react";
import type { DrawerPointerPosition, DrawerResizeAxis } from "./drawerResize";

/**
 * The drag grip on the drawer's graph-facing edge (ticket
 * `nid_nsuszxnzggbck1ajwte4mqwzf_e`). Deliberately dumb: it reports pointer
 * positions and arrow-key nudges; the drawer owns the size math and state.
 * Both axes' handles are always rendered — `link-preview.css` shows the one
 * matching where the drawer is docked (top edge in bottom mode, left edge in
 * side mode), so this component never needs to know the pane's aspect ratio.
 */

export const RESIZE_HANDLE_LABEL = "Resize preview panel";

/** Grow direction per axis: the handle sits on the graph-facing edge, so
 * moving toward the graph (up / left) makes the drawer larger. */
const GROW_KEY: Readonly<Record<DrawerResizeAxis, string>> = { height: "ArrowUp", width: "ArrowLeft" };
const SHRINK_KEY: Readonly<Record<DrawerResizeAxis, string>> = { height: "ArrowDown", width: "ArrowRight" };

export interface DrawerResizeHandleProps {
	readonly axis: DrawerResizeAxis;
	/** A drag pointer moved — resize toward this position. */
	readonly onDragTo: (pointer: DrawerPointerPosition) => void;
	/** Arrow key on the focused handle: +1 grows the drawer, -1 shrinks it. */
	readonly onNudge: (direction: 1 | -1) => void;
}

export function DrawerResizeHandle({ axis, onDragTo, onNudge }: DrawerResizeHandleProps): ReactElement {
	// Own dragging flag instead of `hasPointerCapture` — jsdom implements
	// neither, and capture is only an enhancement (smooth off-element drags).
	const draggingRef = useRef(false);

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
		event.preventDefault();
		draggingRef.current = true;
		if (typeof event.currentTarget.setPointerCapture === "function") {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
	};
	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
		if (draggingRef.current) {
			onDragTo({ clientX: event.clientX, clientY: event.clientY });
		}
	};
	const endDrag = (): void => {
		draggingRef.current = false;
	};
	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
		const direction = event.key === GROW_KEY[axis] ? 1 : event.key === SHRINK_KEY[axis] ? -1 : null;
		if (direction !== null) {
			event.preventDefault();
			onNudge(direction);
		}
	};

	const edge = axis === "height" ? "top" : "left";
	return (
		<div
			role="separator"
			tabIndex={0}
			aria-label={RESIZE_HANDLE_LABEL}
			aria-orientation={axis === "height" ? "horizontal" : "vertical"}
			className={`vicinity-graph-link-preview-drawer__resize vicinity-graph-link-preview-drawer__resize--${edge}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
			onKeyDown={onKeyDown}
		/>
	);
}
