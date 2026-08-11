import type { Locator } from "@playwright/test";

/**
 * Computed background/box-shadow of a button, paired with what the given CSS
 * values RESOLVE to at that same element — so assertions stay variable-based
 * instead of hardcoding theme-dependent rgb() strings. Only a real Obsidian can
 * observe this: its app-wide `button:not(.clickable-icon)` rule (specificity
 * 0,1,1) silently beats any single-class (0,1,0) reset (same trap the outline
 * entries once shipped with — see e2e/nodeOutline.e2e.ts).
 */
export async function buttonChromeVsDeclared(
	button: Locator,
	declared: { readonly background: string; readonly boxShadow: string },
): Promise<{ actual: unknown; declared: unknown }> {
	return button.evaluate((el, want) => {
		// Probe: a child div resolves the SAME CSS variables in the SAME theme scope.
		const probe = document.createElement("div");
		probe.style.backgroundColor = want.background;
		probe.style.boxShadow = want.boxShadow;
		el.appendChild(probe);
		const probeStyle = getComputedStyle(probe);
		const resolved = { backgroundColor: probeStyle.backgroundColor, boxShadow: probeStyle.boxShadow };
		probe.remove();
		const style = getComputedStyle(el);
		return {
			actual: { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow },
			declared: resolved,
		};
	}, declared);
}
