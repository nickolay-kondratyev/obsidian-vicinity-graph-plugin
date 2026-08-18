/**
 * Per-relation-name edge colouring (ticket nid_adesjb4clls56623vdu773ubg_e —
 * deferred idea from the named-relationships set). A relation NAME (`supports`,
 * `contradicts`, …) maps deterministically to one of {@link RELATION_COLOR_SLOT_COUNT}
 * hue slots, so the same name always draws the same colour WITHOUT any settings
 * surface to configure — the 80/20 slice the idea ticket signed off (user-configurable
 * name→style mappings stay deferred; deterministic hashing "just works").
 *
 * WHY hashing, not config: an argument map with a handful of relation names becomes
 * glanceable for free, and there is nothing to persist, migrate, or teach a settings
 * row. WHY colour, not dash/weight: kind-based dashing was already dropped as reading
 * WEAKER than a solid stroke (graph-view.css kind-seam note, nid_zxnhehkpoj3q2peirauby6w4q_e),
 * so colour is the one distinguisher worth spending.
 *
 * The slot is the only thing computed here — the actual hues live in graph-view.css
 * as theme variables (`--color-red` … `--color-pink`), one CSS rule per slot, so
 * light/dark themes both read correctly and this module stays free of colour VALUES.
 */

/**
 * How many distinct hues the palette cycles through. graph-view.css MUST define a
 * chip rule AND an edge-line rule for every slot `0 … RELATION_COLOR_SLOT_COUNT - 1`;
 * `relationColorPalette.test.ts` fails if a slot has no CSS. Eight matches Obsidian's
 * stable named-colour set (`--color-red/orange/yellow/green/cyan/blue/purple/pink`).
 */
export const RELATION_COLOR_SLOT_COUNT = 8;

/**
 * The hue slot for a relation NAME (never the display label — a qualifier must not
 * change the colour, so `supports` and `supports [X] but weakly` share a hue).
 * Case- and surrounding-whitespace-insensitive so `Supports` and `supports` group.
 */
export function relationColorSlot(name: string): number {
	return hashName(name) % RELATION_COLOR_SLOT_COUNT;
}

/** The class a relation-name CHIP carries (rendered in a portal, so it needs its own hook). */
export function relationChipColorClassName(name: string): string {
	return `vicinity-graph-edge__relation--color-${relationColorSlot(name)}`;
}

/**
 * The class the edge WRAPPER carries to colour the LINE + arrowhead — but ONLY when
 * every name on the edge shares one hue. A collapsed edge mixing several relation
 * hues has no single honest colour, so it stays the neutral theme stroke and lets its
 * per-name chips carry the colour instead. Empty ⇒ `undefined` (an unnamed edge).
 */
export function relationEdgeColorClassName(names: readonly string[]): string | undefined {
	const slots = new Set(names.map(relationColorSlot));
	if (slots.size !== 1) {
		return undefined;
	}
	const [slot] = slots;
	return `vicinity-graph-edge--relation-color-${slot}`;
}

/** djb2 string hash, folded to an unsigned 32-bit int. Stable across sessions/machines. */
function hashName(name: string): number {
	const normalized = name.trim().toLowerCase();
	let hash = 5381;
	for (let index = 0; index < normalized.length; index += 1) {
		hash = (Math.imul(hash, 33) + normalized.charCodeAt(index)) | 0;
	}
	return hash >>> 0;
}
