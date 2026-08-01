import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, RefObject } from "react";
import { DrawerResizeHandle } from "./DrawerResizeHandle";
import { DRAWER_KEYBOARD_STEP_PX, DrawerResizeMath, sessionDrawerSizes } from "./drawerResize";
import type { DrawerPointerPosition, DrawerResizeAxis, DrawerSizeSnapshot } from "./drawerResize";
import { LinkPreviewContent } from "./LinkPreviewContent";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import type { EdgePreviewModel } from "./linkPreviewModel";

/**
 * The in-graph link-preview drawer (ticket `nid_5j9mygfywppaiakuim3utf6r2_e`):
 * the retired `LinkPreviewModal`'s chrome, rebuilt as a slide-out panel INSIDE
 * the graph pane. Which edge it slides from is pure CSS (`link-preview.css`,
 * container query on the pane's aspect ratio) — this component only owns the
 * header, the close affordances and the close-on-GO contract; all list
 * behaviour stays in {@link LinkPreviewContent}.
 *
 * A non-modal dialog on purpose: the graph behind it stays interactive, and
 * clicking another node/edge simply retargets the drawer (store semantics).
 */

/** Lucide icon of the header close button. */
export const CLOSE_ICON_ID = "x";

export interface LinkPreviewDrawerProps {
	readonly model: EdgePreviewModel;
	/** The `GraphUiPort.renderIcon` seam — built-in (lucide) icon into `el`. */
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	/** The `GraphUiPort.renderMarkdown` seam — Obsidian-rendered snippet into `el`. */
	readonly renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => Promise<void>;
	/** Click on a rendered `a.internal-link` anchor inside a snippet. */
	readonly onOpenLink: (linktext: string, sourcePath: string) => void;
	/** Dismiss the drawer (close button, Escape; the flow adds pane clicks). */
	readonly onClose: () => void;
	/** GO click. The drawer closes itself first — the editor takes over. */
	readonly onGo: (target: LinkPreviewGoTarget) => void;
}

export function LinkPreviewDrawer({
	model,
	renderIcon,
	renderMarkdown,
	onOpenLink,
	onClose,
	onGo,
}: LinkPreviewDrawerProps): ReactElement {
	// Escape must work without the drawer holding focus (the graph usually has
	// it), so listen on the window for the drawer's lifetime.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);
	const resize = useDrawerResize();
	const title = titleOf(model);
	return (
		<div
			ref={resize.drawerRef}
			className={drawerClassName(resize.sizes)}
			style={drawerSizeStyle(resize.sizes)}
			role="dialog"
			aria-label={title}
		>
			<DrawerResizeHandle axis="height" onDragTo={resize.dragTo("height")} onNudge={resize.nudge("height")} />
			<DrawerResizeHandle axis="width" onDragTo={resize.dragTo("width")} onNudge={resize.nudge("width")} />
			<header className="vicinity-graph-link-preview-drawer__header">
				<h2 className="vicinity-graph-link-preview-drawer__title" title={title}>
					{title}
				</h2>
				<CloseButton renderIcon={renderIcon} onClose={onClose} />
			</header>
			<div className="vicinity-graph-link-preview-drawer__body">
				<LinkPreviewContent
					model={model}
					renderIcon={renderIcon}
					renderMarkdown={renderMarkdown}
					onOpenLink={onOpenLink}
					onGo={(target) => {
						onClose();
						onGo(target);
					}}
				/>
			</div>
		</div>
	);
}

interface DrawerResizeState {
	readonly drawerRef: RefObject<HTMLDivElement>;
	readonly sizes: DrawerSizeSnapshot;
	readonly dragTo: (axis: DrawerResizeAxis) => (pointer: DrawerPointerPosition) => void;
	readonly nudge: (axis: DrawerResizeAxis) => (direction: 1 | -1) => void;
}

/**
 * Drawer-side half of resizing (ticket `nid_nsuszxnzggbck1ajwte4mqwzf_e`):
 * turns handle gestures into a clamped size, remembers it in the session
 * memory (a reopened drawer keeps its size) and republishes it as the CSS
 * variables `link-preview.css` sizes the drawer with. The clamp here is the
 * primary bound; the stylesheet keeps a 90% backstop for panes that shrink
 * after the drag.
 */
function useDrawerResize(): DrawerResizeState {
	const drawerRef = useRef<HTMLDivElement>(null);
	const [sizes, setSizes] = useState<DrawerSizeSnapshot>(() => sessionDrawerSizes.snapshot());

	const resizeTo = (axis: DrawerResizeAxis, rawPx: number): void => {
		const container = drawerRef.current?.parentElement;
		if (container == null) {
			return;
		}
		const containerPx = axis === "height" ? container.clientHeight : container.clientWidth;
		sessionDrawerSizes.set(axis, DrawerResizeMath.clampSize(axis, rawPx, containerPx));
		setSizes(sessionDrawerSizes.snapshot());
	};

	const dragTo = (axis: DrawerResizeAxis) => (pointer: DrawerPointerPosition) => {
		const container = drawerRef.current?.parentElement;
		if (container == null) {
			return;
		}
		resizeTo(axis, DrawerResizeMath.sizeFromPointer(axis, pointer, container.getBoundingClientRect()));
	};

	const nudge = (axis: DrawerResizeAxis) => (direction: 1 | -1) => {
		const stored = sizes[axis];
		const current = stored ?? renderedSize(drawerRef.current, axis);
		resizeTo(axis, current + direction * DRAWER_KEYBOARD_STEP_PX);
	};

	return { drawerRef, sizes, dragTo, nudge };
}

/** First keyboard nudge on a never-resized drawer starts from its laid-out size. */
function renderedSize(drawer: HTMLDivElement | null, axis: DrawerResizeAxis): number {
	if (drawer === null) {
		return 0;
	}
	return axis === "height" ? drawer.offsetHeight : drawer.offsetWidth;
}

function drawerClassName(sizes: DrawerSizeSnapshot): string {
	const classes = ["vicinity-graph-link-preview-drawer"];
	if (sizes.height !== undefined) {
		classes.push("vicinity-graph-link-preview-drawer--height-resized");
	}
	if (sizes.width !== undefined) {
		classes.push("vicinity-graph-link-preview-drawer--width-resized");
	}
	return classes.join(" ");
}

function drawerSizeStyle(sizes: DrawerSizeSnapshot): CSSProperties {
	const style: Record<string, string> = {};
	if (sizes.height !== undefined) {
		style["--vicinity-drawer-height"] = `${sizes.height}px`;
	}
	if (sizes.width !== undefined) {
		style["--vicinity-drawer-width"] = `${sizes.width}px`;
	}
	return style as CSSProperties;
}

function CloseButton({
	renderIcon,
	onClose,
}: {
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	readonly onClose: () => void;
}): ReactElement {
	const iconRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (iconRef.current !== null) {
			renderIcon(iconRef.current, CLOSE_ICON_ID);
		}
	}, [renderIcon]);
	return (
		<button
			type="button"
			className="vicinity-graph-link-preview-drawer__close"
			aria-label="Close preview"
			title="Close preview"
			onClick={onClose}
		>
			<span ref={iconRef} className="vicinity-graph-link-preview-drawer__close-icon" aria-hidden="true" />
		</button>
	);
}

/**
 * The clicked visual's endpoint names — a folder-group endpoint reads as its
 * folder name, and a collapsed edge that unions both directions gets "↔"
 * instead of the directional arrow.
 */
function titleOf(model: EdgePreviewModel): string {
	return `${model.sourceName} ${model.bidirectional ? "↔" : "→"} ${model.targetName}`;
}
