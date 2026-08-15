import { parseIdRefFields } from "../engine";

/**
 * The CHIP projection of the stored id-ref-fields STRING — shared by both presenters
 * (ticket `nid_gpgudw7pfdy02wcqbs73si21x_e`): field names are entered one at a time
 * and each rendered chip carries its own remove button, but the STORED value stays
 * the one comma-separated string `FrontmatterLinkSettings.idRefFields` has always
 * been, so the engine parse (`parseIdRefFields`), the write plan and persistence are
 * untouched.
 *
 * Every edit goes list-wise through the canonical parse and back through ONE join,
 * so what the chips show and what `parseIdRefFields` yields downstream can never
 * disagree.
 */
export class IdRefFieldChips {
	/** The chips to render for a stored value — the canonical parse, verbatim. */
	static list(stored: string): readonly string[] {
		return parseIdRefFields(stored);
	}

	/**
	 * The stored value after adding what the user typed, or `undefined` when the
	 * entry changes nothing (empty, whitespace, or only already-present names — a
	 * no-op must not cost a persist + rebuild). A pasted comma-separated entry adds
	 * every new name it carries, courtesy of the shared parse.
	 */
	static add(stored: string, entry: string): string | undefined {
		const next = parseIdRefFields(`${stored},${entry}`);
		if (next.length === IdRefFieldChips.list(stored).length) {
			return undefined;
		}
		return IdRefFieldChips.join(next);
	}

	/** The stored value after removing one chip's field (a no-op for an unknown name). */
	static remove(stored: string, field: string): string {
		return IdRefFieldChips.join(IdRefFieldChips.list(stored).filter((name) => name !== field));
	}

	/**
	 * The accessible name of one chip's remove button — named after the FIELD, not the
	 * row, because a row can carry many chips. Here rather than in `SettingsRowNames`
	 * so both presenters (and the tests) share the one copy of the copy.
	 */
	static removeName(field: string): string {
		return `Remove ${field}`;
	}

	/** The ONE serialisation of a field list back into the stored string. */
	private static join(fields: readonly string[]): string {
		return fields.join(", ");
	}
}
