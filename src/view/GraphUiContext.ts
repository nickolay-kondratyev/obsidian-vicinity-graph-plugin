import { createContext, useContext } from "react";
import type { GraphUiPort } from "./viewPorts";

/**
 * Delivers the {@link GraphUiPort} to node components. React Flow instantiates
 * `nodeTypes` components itself, so context is the only clean channel — prop
 * drilling through RF is impossible. Provided by `VicinityGraphFlow`.
 */
export const GraphUiContext = createContext<GraphUiPort | null>(null);

/** The graph's UI services; throws when rendered outside `VicinityGraphFlow` (programmer error). */
export function useGraphUi(): GraphUiPort {
	const ui = useContext(GraphUiContext);
	if (ui === null) {
		throw new Error("GraphUiContext is missing — node components must render inside VicinityGraphFlow");
	}
	return ui;
}
