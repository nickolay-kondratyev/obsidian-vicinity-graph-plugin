import type { DepthOverride, DepthSettings } from "./types";

/**
 * Depth cascade — deliberately simple and per-root (NO multi-layer cascade for
 * depth): the root doc's own override → the global default. Per-field
 * semantics: absence = inherit, presence = pinned.
 *
 * Persisted overrides are docid-keyed; the step-03 adapter translates them to
 * paths and hands this resolver plain per-root overrides.
 */
export class TraversalSettingsResolver {
	static resolveForRoot(global: DepthSettings, override?: DepthOverride): DepthSettings {
		return {
			outgoingDepth: override?.outgoingDepth ?? global.outgoingDepth,
			incomingDepth: override?.incomingDepth ?? global.incomingDepth,
		};
	}
}
