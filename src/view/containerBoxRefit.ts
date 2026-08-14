import type { ElkNode } from "elkjs";
import { GROUP_BOX_PADDING_PX } from "./constants";

/**
 * Refits a folder-group container's box around its (d3-refined) interior.
 *
 * elk sizes every container for its own seed arrangement; the d3 interior
 * refinement then moves the container's children (recentring them around the
 * origin), so the stored box no longer wraps them — members would render
 * OUTSIDE the group border. This translates the children back into
 * padding-origin coordinates and recomputes the box, restoring the invariant
 * the rest of the pipeline assumes: every direct child lies inside its parent's
 * box, inset by exactly {@link GROUP_BOX_PADDING_PX} at the bounding-box
 * extremes. That side inset is also the ceiling of the user-facing "Edge
 * clearance" range (`CLEARANCE_RANGE.max < GROUP_SIDE_PADDING_PX`, guarded in
 * `edgeRouting.test.ts`): members stay routing obstacles INSIDE the border,
 * never poking clearance regions out of it.
 *
 * Called bottom-up by `GraphLayoutRunner` (children refit before their parent
 * refines), so a parent's own refinement always arranges FINAL child boxes.
 * The ROOT is never refit — it has no rendered border and the refinement's
 * origin-centred coordinates are what the viewport fit consumes.
 */
export function refitContainerBox(container: ElkNode): ElkNode {
	const children = container.children;
	if (children === undefined || children.length === 0) {
		return container;
	}
	const minX = Math.min(...children.map((child) => child.x ?? 0));
	const minY = Math.min(...children.map((child) => child.y ?? 0));
	const maxX = Math.max(...children.map((child) => (child.x ?? 0) + (child.width ?? 0)));
	const maxY = Math.max(...children.map((child) => (child.y ?? 0) + (child.height ?? 0)));
	const pad = GROUP_BOX_PADDING_PX;
	const shiftX = pad.left - minX;
	const shiftY = pad.top - minY;
	return {
		...container,
		width: maxX - minX + pad.left + pad.right,
		height: maxY - minY + pad.top + pad.bottom,
		children: children.map((child) => ({
			...child,
			x: (child.x ?? 0) + shiftX,
			y: (child.y ?? 0) + shiftY,
		})),
	};
}
