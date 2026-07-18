import { FileKinds } from "../shared/FileKinds";

/**
 * Decides whether an active-file change should trigger a graph rebuild. Pure
 * and node-testable. MAIN tracking rule (matches Obsidian's local graph): only
 * node-bearing files (md/canvas) are eligible centrals; activating an image or
 * a PDF must NOT rebuild, and re-activating the file that is already MAIN is a
 * no-op.
 */
export type ActiveFileOutcome =
	| { readonly kind: "rebuild"; readonly mainPath: string }
	| { readonly kind: "ignore" };

const IGNORE: ActiveFileOutcome = { kind: "ignore" };

export function decideActiveFileRebuild(activePath: string | null, currentMainPath: string | null): ActiveFileOutcome {
	if (activePath === null) {
		return IGNORE;
	}
	if (!FileKinds.isNodeBearingPath(activePath)) {
		return IGNORE;
	}
	if (activePath === currentMainPath) {
		return IGNORE;
	}
	return { kind: "rebuild", mainPath: activePath };
}
