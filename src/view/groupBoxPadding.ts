import type { ElkNode } from "elkjs";
import { ELK_GROUP_PADDING, GROUP_BOX_PADDING_PX, GROUP_SIDE_PADDING_PX, elkPaddingOf } from "./constants";
import type { GroupBoxPadding } from "./constants";
import type { GroupSubject } from "./grouping";

/**
 * How far a note's tag-chip row hangs BELOW the note box (graph-view.css, "tag
 * chips": a `--size-2-1` gap plus one chip line at `--font-smallest` × 1.5 and its
 * border). The chips cost no layout space by design (`NoteTagChips`), so a box
 * must reserve this itself or the lowest note's chips cross its bottom border.
 * Measured at the default theme; a theme with a larger chip font overruns it by
 * a few px, which the side inset absorbs.
 */
export const TAG_CHIP_ROW_HANG_PX = 22;

/**
 * Tag boxes: the folder inset, plus the chip row under the bottom border — the
 * chip's bottom then sits the same side inset above the border as a chip-less
 * note's bottom does. Only TAG boxes carry chips (decision 3), so folder layout
 * is untouched.
 */
const TAG_GROUP_BOX_PADDING_PX: GroupBoxPadding = {
	...GROUP_BOX_PADDING_PX,
	bottom: GROUP_SIDE_PADDING_PX + TAG_CHIP_ROW_HANG_PX,
};

/** The tag inset in elk's `ElkPadding` syntax. */
export const ELK_TAG_GROUP_PADDING = elkPaddingOf(TAG_GROUP_BOX_PADDING_PX);

/** THE inset rule: which inset a box of this kind reserves around its members. */
export function groupBoxPaddingOf(kind: GroupSubject["kind"]): GroupBoxPadding {
	switch (kind) {
		case "folder":
			return GROUP_BOX_PADDING_PX;
		case "tag":
			return TAG_GROUP_BOX_PADDING_PX;
	}
}

/** {@link groupBoxPaddingOf} in elk syntax — what `elkMapping` stamps on a container. */
export function elkGroupPaddingOf(kind: GroupSubject["kind"]): string {
	return kind === "tag" ? ELK_TAG_GROUP_PADDING : ELK_GROUP_PADDING;
}

/**
 * The inset a laid-out container was given, read back from the `elk.padding` it
 * carries — how the box refit (which sees elk nodes, not groups) re-imposes the
 * SAME inset elk honoured. An exact match against the two strings this module
 * writes, never a parse; anything else is a folder box.
 */
export function groupBoxPaddingOfElkContainer(container: ElkNode): GroupBoxPadding {
	return container.layoutOptions?.["elk.padding"] === ELK_TAG_GROUP_PADDING
		? TAG_GROUP_BOX_PADDING_PX
		: GROUP_BOX_PADDING_PX;
}
