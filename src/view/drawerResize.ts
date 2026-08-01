/**
 * Resize logic of the link-preview drawer (ticket
 * `nid_nsuszxnzggbck1ajwte4mqwzf_e`): the drawer grows/shrinks along ONE axis
 * decided by where it is docked — height when docked to the bottom edge,
 * width when docked to the right edge. Pure math + a session-scoped size
 * memory so a reopened drawer keeps the size the user last dragged it to.
 * Which axis is live never reaches this module: `link-preview.css` shows the
 * one handle matching the pane's aspect ratio, and each handle names its axis.
 */

export type DrawerResizeAxis = "height" | "width";

/** Below these the header/rows stop being usable — refuse smaller drags. */
export const DRAWER_MIN_SIZE_PX: Readonly<Record<DrawerResizeAxis, number>> = {
	height: 120,
	width: 240,
};

/** Leave a sliver of graph visible — the drawer never swallows the pane. */
export const DRAWER_MAX_CONTAINER_FRACTION = 0.9;

/** Arrow-key nudge on a focused handle. */
export const DRAWER_KEYBOARD_STEP_PX = 24;

/** The pointer-facing edges of the pane the drawer is docked inside. */
export interface DrawerContainerEdges {
	readonly right: number;
	readonly bottom: number;
}

export interface DrawerPointerPosition {
	readonly clientX: number;
	readonly clientY: number;
}

export class DrawerResizeMath {
	/**
	 * Drawer size implied by a drag pointer: the drawer is docked to the
	 * container's bottom (height axis) or right (width axis) edge, so the size
	 * is the distance from the pointer to that fixed edge.
	 */
	static sizeFromPointer(
		axis: DrawerResizeAxis,
		pointer: DrawerPointerPosition,
		container: DrawerContainerEdges,
	): number {
		return axis === "height" ? container.bottom - pointer.clientY : container.right - pointer.clientX;
	}

	/** Clamp a requested size into [axis minimum, fraction of the container]. */
	static clampSize(axis: DrawerResizeAxis, rawPx: number, containerPx: number): number {
		const min = DRAWER_MIN_SIZE_PX[axis];
		const max = Math.max(containerPx * DRAWER_MAX_CONTAINER_FRACTION, min);
		return Math.min(Math.max(rawPx, min), max);
	}
}

export interface DrawerSizeSnapshot {
	readonly height?: number;
	readonly width?: number;
}

/**
 * Remembers dragged sizes for the lifetime of the plugin (module singleton
 * below) — deliberately NOT persisted to `data.json`: a drawer size is throw
 * away layout state, not a setting.
 */
export class DrawerSizeMemory {
	private readonly sizes = new Map<DrawerResizeAxis, number>();

	set(axis: DrawerResizeAxis, px: number): void {
		this.sizes.set(axis, px);
	}

	get(axis: DrawerResizeAxis): number | undefined {
		return this.sizes.get(axis);
	}

	snapshot(): DrawerSizeSnapshot {
		return { height: this.sizes.get("height"), width: this.sizes.get("width") };
	}

	clear(): void {
		this.sizes.clear();
	}
}

/** The one per-session memory every drawer mount shares. */
export const sessionDrawerSizes = new DrawerSizeMemory();
