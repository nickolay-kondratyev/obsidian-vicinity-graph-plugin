import type { NodeContentOverride, NodePreviewPreference } from "../engine";
import { NODE_CONTENT_OVERRIDES } from "../engine";
import { NODE_CONTENT_INHERIT_META, NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";

/**
 * The per-node CONTENT override layer that sits IN FRONT of the pure chooser
 * `engine/nodePreviewKind.ts` (node-sizing rethink, ticket
 * nid_9hx6okamx3yt0rg9iad2f4151_e). A doc's stored {@link NodeContentOverride}
 * REPLACES the global {@link NodePreviewPreference} the chooser reads; "Inherit"
 * — the absence of an override — falls back to the global. `NoteNode` keeps
 * rendering `FlowNodeData.preview` and deciding nothing; `flowMapping` resolves
 * the effective preference here and hands it to the chooser.
 *
 * Pure and view-local: it combines a VIEW concern (the gear menu's model) with the
 * engine's preference union, so it is node-testable with no obsidian runtime.
 *
 * WHY NOT in the engine sizer too: the sizer deliberately reads the GLOBAL
 * preference only (`NodeSizer` doc), so a per-node content flip moves NO pixels
 * (`sizePx` is preference-independent) and stays a DATA-ONLY refresh — the graph
 * does not relayout when the user flips one node's content. That is the whole
 * reason the override is applied HERE (the view mapping) and not in the shared
 * sizing input.
 */

/**
 * The preference the chooser should render this node by: the per-node override
 * when set, else the global preference. This is the ONE place "Inherit = fall
 * back to global" is spelled — every other module asks this, never re-derives it.
 */
export function resolveNodePreviewPreference(
	global: NodePreviewPreference,
	override: NodeContentOverride | undefined,
): NodePreviewPreference {
	return override ?? global;
}

/**
 * What the gear menu offers for one node's Content row: "Inherit" (clear the
 * override) plus every {@link NodeContentOverride}. A distinct type from
 * {@link NodeContentOverride} because Inherit is NOT a stored value — it is the
 * command to REMOVE the stored entry.
 */
export type NodeContentChoice = "inherit" | NodeContentOverride;

/** The choice a doc's current override maps to — absence reads as "Inherit". */
export function currentNodeContentChoice(override: NodeContentOverride | undefined): NodeContentChoice {
	return override ?? "inherit";
}

/**
 * The gear menu's Content choices, in render order: Inherit first, then the
 * override values in {@link NODE_CONTENT_OVERRIDES} order (Title only / Outline /
 * Image). Single-sourced from the engine list, so a new override value appears
 * in the menu automatically.
 */
export const NODE_CONTENT_CHOICES = ["inherit", ...NODE_CONTENT_OVERRIDES] as const satisfies readonly NodeContentChoice[];

/** One rendered Content menu item: the choice it commits, its label, and whether it is the current one. */
export interface NodeContentMenuItem {
	readonly choice: NodeContentChoice;
	readonly label: string;
	/** True for the doc's CURRENT choice — the native menu shows it checked. */
	readonly checked: boolean;
}

/** The label for one Content choice — Inherit's own copy, else the shared per-option copy. */
function nodeContentChoiceLabel(choice: NodeContentChoice): string {
	return choice === "inherit" ? NODE_CONTENT_INHERIT_META.label : NODE_PREVIEW_OPTION_META[choice].label;
}

/**
 * The Content section of a node's gear menu: one item per {@link NODE_CONTENT_CHOICES},
 * the one matching `current` marked checked. Pure — `NoteNode` maps each item to a
 * native menu entry and wires the click (set the override, or clear it for Inherit).
 */
export function planNodeContentMenu(current: NodeContentChoice): readonly NodeContentMenuItem[] {
	return NODE_CONTENT_CHOICES.map((choice) => ({
		choice,
		label: nodeContentChoiceLabel(choice),
		checked: choice === current,
	}));
}
