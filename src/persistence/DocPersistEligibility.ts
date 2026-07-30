/**
 * Q3 policy (HUMAN-approved): docs whose docid is not a conservatively safe
 * opaque key are REFUSED persistence — they still work fully in graphs, they
 * just cannot be pinned. The typed reason feeds the step-04/06 node emblem (no
 * popups).
 *
 * WHY the rule is still a FILENAME rule now that the per-doc `doc-data/<docid>.json`
 * files are gone (global-only settings, 2026-07-29): the pin refusal is
 * deliberately UNCHANGED by that removal — a foreign id we would not have
 * written to disk is also one we do not want to accept as a persisted pin key.
 * Loosening it is a separate product decision, not a side effect.
 */
export type PersistableIdentity =
	| { readonly kind: "persistable"; readonly docid: string }
	| { readonly kind: "not-persistable"; readonly reason: NotPersistableReason };

export type NotPersistableReason =
	/** obsidian-id-lib could not read or create an id (unsupported format, occupied-unusable slot, ...). */
	| "no-docid"
	/** The doc HAS an id, but a foreign-format one that is not filename-safe (README: ids pass through as-is). */
	| "unsafe-docid";

/**
 * Conservative cross-platform filename rule: letters, digits, `_`, `-` only
 * (no dots ⇒ no `..`, no path separators, no Windows-reserved characters) and
 * bounded length. Generated `docid_{24 base36}_e` ids always pass; foreign ids
 * must earn it.
 */
const FILENAME_SAFE_DOCID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
/**
 * Windows additionally reserves these as whole BASENAMES regardless of
 * extension (`CON.json` is unwritable/hangs) — names, not characters, and
 * matched case-insensitively because the filesystem is.
 */
const WINDOWS_RESERVED_BASENAME_PATTERN = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export class DocPersistEligibility {
	static classify(docid: string | null): PersistableIdentity {
		if (docid === null) {
			return { kind: "not-persistable", reason: "no-docid" };
		}
		if (!DocPersistEligibility.isFilenameSafeDocId(docid)) {
			return { kind: "not-persistable", reason: "unsafe-docid" };
		}
		return { kind: "persistable", docid };
	}

	static isFilenameSafeDocId(docid: string): boolean {
		return FILENAME_SAFE_DOCID_PATTERN.test(docid) && !WINDOWS_RESERVED_BASENAME_PATTERN.test(docid);
	}
}
