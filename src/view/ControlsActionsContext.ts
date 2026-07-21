import { createContext, useContext } from "react";
import type { ControlsActionsPort } from "./viewPorts";

/**
 * Delivers the {@link ControlsActionsPort} to the toolbar and node components —
 * the sibling of {@link GraphUiContext} for the controls surface (step-06 Phase
 * C). React Flow instantiates `nodeTypes` components itself, so context is the
 * only clean channel to reach the pin/unpin executor from a node; the toolbar
 * shares the same provider so both surfaces write through ONE executor.
 * Provided by `VicinityGraphFlow`.
 */
export const ControlsActionsContext = createContext<ControlsActionsPort | null>(null);

/** The controls executor; throws when rendered outside `VicinityGraphFlow` (programmer error). */
export function useControlsActions(): ControlsActionsPort {
	const actions = useContext(ControlsActionsContext);
	if (actions === null) {
		throw new Error("ControlsActionsContext is missing — controls must render inside VicinityGraphFlow");
	}
	return actions;
}
