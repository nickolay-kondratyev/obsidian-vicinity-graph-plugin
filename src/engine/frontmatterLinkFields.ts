/**
 * THE one canonical parse of {@link import("./types").FrontmatterLinkSettings.idRefFields}
 * — the comma-separated frontmatter field-name string — into the field-name LIST.
 *
 * Lives in the pure engine layer so BOTH consumers read it through this one function
 * (feature part 1, ticket `nid_dthnhlzp0wzxqhcozj3f8ih5h_e`): the settings surfaces
 * store the raw string, and the adapter (`ObsidianLinkProvider`, dependent ticket)
 * projects it to field names here — never its own `split(",")`, so "which fields are
 * id-refs" is answered identically everywhere.
 *
 * Pure engine module: imports nothing (import-guarded like the rest of the engine).
 */

/**
 * The field names in `raw`, in first-seen order: split on commas, each TRIMMED, with
 * empties dropped and duplicates removed.
 *
 * - EMPTY / whitespace-only ⇒ `[]` (feature off): the default, and what a list of
 *   only commas collapses to.
 * - Order is preserved and de-duplication keeps the FIRST occurrence, so the result
 *   is stable and reads like what the user typed.
 */
export function parseIdRefFields(raw: string): readonly string[] {
	const seen = new Set<string>();
	for (const part of raw.split(",")) {
		const name = part.trim();
		if (name.length > 0) {
			seen.add(name);
		}
	}
	return [...seen];
}
