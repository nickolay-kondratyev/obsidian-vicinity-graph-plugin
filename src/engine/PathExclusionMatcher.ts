import type { VaultPath } from "./types";

/**
 * Pure regex-lite matcher deciding whether a vault path is globally excluded.
 *
 * Semantics (binding, step-02 CLARIFICATION): each pattern is a raw JS regex
 * compiled with `new RegExp(pattern)` — CASE-SENSITIVE, no implicit flags — and
 * tested UNANCHORED via `regex.test(path)` against the full vault-relative path
 * (including extension). So `rel/` matches `rel/x.md` AND `a/rel/x.md`; `^rel/`
 * anchors to the vault root. A pattern that fails to compile is SILENTLY SKIPPED
 * (excludes nothing, never throws) — a broken pattern can never break the graph.
 *
 * A path is excluded iff ANY compiled pattern matches. An empty pattern list (or
 * a list of only-invalid patterns) yields a matcher that excludes nothing.
 */
export class PathExclusionMatcher {
	private constructor(private readonly regexes: readonly RegExp[]) {}

	/** Compiles `patterns`, dropping any that fail to compile. Empty ⇒ no-op matcher. */
	static fromPatterns(patterns: readonly string[]): PathExclusionMatcher {
		const regexes: RegExp[] = [];
		for (const pattern of patterns) {
			const compiled = PathExclusionMatcher.compile(pattern);
			if (compiled !== undefined) {
				regexes.push(compiled);
			}
		}
		return new PathExclusionMatcher(regexes);
	}

	/** True iff any compiled pattern matches `path` (unanchored, case-sensitive). */
	excludes(path: VaultPath): boolean {
		return this.regexes.some((regex) => regex.test(path));
	}

	/** `undefined` when the pattern is not a valid regex (the silent-skip contract). */
	private static compile(pattern: string): RegExp | undefined {
		try {
			return new RegExp(pattern);
		} catch {
			return undefined; // Invalid regex → excludes nothing (never throws).
		}
	}
}
