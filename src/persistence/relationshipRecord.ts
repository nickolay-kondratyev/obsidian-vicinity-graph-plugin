import type { AiNamedRelationship, RelationshipName, RelationshipTokenUsage, StoredRelationshipOrigin } from "../engine";

/**
 * The payload of ONE `from_id/<from_docid>/<to_docid>.json` file (ticket
 * `nid_a5m4kforr9scit68rhqmqh78o_e`): the stored name of the DIRECTED pair
 * `from → to`. The `{ "v1": … }` envelope around it is `VaultFileStore`'s.
 *
 * `name: null` is a DISMISSED AI name — the user cleared it, and auto mode must
 * not regenerate it. A manual name is never dismissed: clearing it deletes the
 * file ({@link clearedRelationshipRecord}).
 */
export interface RelationshipRecord {
	readonly name: string | null;
	readonly origin: StoredRelationshipOrigin;
	/** The model that generated an `ai` name (task 3/4). */
	readonly model?: string;
	readonly reasoningEffort?: string;
	readonly usage?: RelationshipTokenUsage;
	readonly createdIso: string;
	readonly updatedIso: string;
}

/** What clearing a pair's name does to its file. */
export type RelationshipClear =
	| { readonly kind: "unchanged" }
	| { readonly kind: "delete" }
	| { readonly kind: "write"; readonly record: RelationshipRecord };

const STORED_ORIGINS: readonly StoredRelationshipOrigin[] = ["manual", "ai"];

function isStoredOrigin(value: unknown): value is StoredRelationshipOrigin {
	return STORED_ORIGINS.some((origin) => origin === value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function parseUsage(raw: unknown): RelationshipTokenUsage | undefined {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return undefined;
	}
	const { inputTokens, outputTokens } = raw as Record<string, unknown>;
	if (typeof inputTokens !== "number" || typeof outputTokens !== "number") {
		return undefined;
	}
	return { inputTokens, outputTokens };
}

/** A stored name, the dismissed marker (`null`, AI only), or `undefined` when neither. */
function parseStoredName(name: unknown, origin: StoredRelationshipOrigin): string | null | undefined {
	if (name === null && origin === "ai") {
		return null;
	}
	return isNonEmptyString(name) ? name : undefined;
}

/**
 * Defensive parser (same discipline as `parsePerDocRecord`): the envelope was
 * already unwrapped by `VaultFileStore`, so this only judges the SHAPE. A record
 * missing what naming needs (a name or the dismissed marker, a stored origin,
 * both timestamps) reads as ABSENT (`null`) rather than throwing; a malformed
 * OPTIONAL field is dropped on its own. A `null` name only means something on an
 * AI record, so a manual one with no name is absent too.
 */
export function parseRelationshipRecord(raw: unknown): RelationshipRecord | null {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const { name, origin, createdIso, updatedIso, model, reasoningEffort } = record;
	if (!isStoredOrigin(origin) || !isNonEmptyString(createdIso) || !isNonEmptyString(updatedIso)) {
		return null;
	}
	const parsedName = parseStoredName(name, origin);
	if (parsedName === undefined) {
		return null;
	}
	const usage = parseUsage(record["usage"]);
	return {
		name: parsedName,
		origin,
		...(isNonEmptyString(model) ? { model } : {}),
		...(isNonEmptyString(reasoningEffort) ? { reasoningEffort } : {}),
		...(usage !== undefined ? { usage } : {}),
		createdIso,
		updatedIso,
	};
}

/**
 * The record after the user names (or renames) the pair: always MANUAL — renaming
 * an AI name makes it the user's, so the AI's model / effort / usage go with the
 * name they described. The creation time of an existing record is kept.
 */
export function manualRelationshipRecord(
	current: RelationshipRecord | undefined,
	name: RelationshipName,
	nowIso: string,
): RelationshipRecord {
	return { name, origin: "manual", createdIso: current?.createdIso ?? nowIso, updatedIso: nowIso };
}

/**
 * The record of a FRESH AI name (task 3/4): origin `ai`, with the model, effort
 * and token usage that produced it. Only ever written to a pair with NO record —
 * see `RelationshipStore.saveAiName`.
 */
export function aiRelationshipRecord(named: AiNamedRelationship, nowIso: string): RelationshipRecord {
	return {
		name: named.name,
		origin: "ai",
		model: named.model,
		reasoningEffort: named.effort,
		...(named.usage !== null ? { usage: named.usage } : {}),
		createdIso: nowIso,
		updatedIso: nowIso,
	};
}

/**
 * What "Clear" does: a manual name is DELETED (no file), an AI name becomes the
 * DISMISSED marker (`name: null`, kept so auto mode does not name the pair
 * again), and a pair with nothing to clear is left as it is.
 */
export function clearedRelationshipRecord(current: RelationshipRecord | undefined, nowIso: string): RelationshipClear {
	if (current === undefined || current.name === null) {
		return { kind: "unchanged" };
	}
	if (current.origin === "manual") {
		return { kind: "delete" };
	}
	return { kind: "write", record: { ...current, name: null, updatedIso: nowIso } };
}
