import type { NodeOverride } from "../engine";
import { parseNodeOverride, parsePins } from "./persistedShapes";
import type { PinnedDocEntry } from "./persistedShapes";

/**
 * The payload of ONE `per_file/<docid>.json` file — the per-doc / per-main facts
 * that moved OUT of `data.json` onto the {@link ./VaultFileStore VaultFileStore}
 * (ticket `nid_8f8ey41extajt08zphwwxhnwq_e`) so they sync as vault content. Every
 * section is INDEPENDENTLY optional and a record with none is never written (it
 * is deleted instead — {@link isEmptyPerDocRecord}), mirroring the node-override
 * "no empty entry on disk" rule.
 *
 * The docid the file is named by is the doc this record is ABOUT:
 * - `override` — the doc's own SUBJECT fact (its `sizePx` / `content` override);
 * - `localPins` — the doc's MAIN-context fact: the targets locally pinned while
 *   this doc is the active main (was `data.json`'s `localPins[thisDocid]`);
 * - `localControls` — reserved, empty by default, for the forward-looking
 *   per-main local control overrides (ticket
 *   `nid_rnghlzs0uejjlbd5a4bjkq7eg_e`, which depends on this one). Preserved
 *   verbatim across writes so that ticket is purely additive — no version bump.
 */
export interface PerDocRecord {
	readonly override?: NodeOverride;
	readonly localPins?: readonly PinnedDocEntry[];
	/** Reserved for a dependent ticket; opaque here — parsed as "some object", carried through untouched. */
	readonly localControls?: Readonly<Record<string, unknown>>;
}

/**
 * Defensive record parser (same discipline as `parsePluginData`): a payload that
 * parses as JSON but has the wrong internal shape degrades SECTION-by-section to
 * absence rather than throwing. This is SEPARATE from the primitive's whole-file
 * quarantine (bad JSON / unknown version key); by the time this runs the envelope
 * was already unwrapped. A section that survives with nothing usable is omitted,
 * so the result honours {@link isEmptyPerDocRecord}.
 */
export function parsePerDocRecord(raw: unknown): PerDocRecord {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}
	const record = raw as Record<string, unknown>;
	const override = parseNodeOverride(record["override"]);
	// A main with no usable target is dropped whole (empty list is not a stored shape).
	const localPins = parsePins(record["localPins"]);
	const localControls = record["localControls"];
	return {
		...(override !== undefined ? { override } : {}),
		...(localPins.length > 0 ? { localPins } : {}),
		...(localControls !== null && typeof localControls === "object" && !Array.isArray(localControls)
			? { localControls: localControls as Readonly<Record<string, unknown>> }
			: {}),
	};
}

/**
 * True when the record carries nothing worth a file — every section absent (a
 * `localControls` present but EMPTY counts as nothing). The store deletes such a
 * record's file instead of writing an orphan, mirroring the node-override rule.
 */
export function isEmptyPerDocRecord(record: PerDocRecord): boolean {
	return (
		record.override === undefined &&
		(record.localPins === undefined || record.localPins.length === 0) &&
		(record.localControls === undefined || Object.keys(record.localControls).length === 0)
	);
}
