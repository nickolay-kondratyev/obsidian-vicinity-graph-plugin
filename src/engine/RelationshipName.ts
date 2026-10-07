/**
 * A relationship name the USER typed (ticket `nid_a5m4kforr9scit68rhqmqh78o_e`),
 * already validated by {@link parseRelationshipName}. Branded so a raw input
 * string cannot reach the store unvalidated — the type checker refuses it.
 */
export type RelationshipName = string & { readonly __brand: "RelationshipName" };

/**
 * Longest name a user may store. A name is drawn ON the edge, so anything past a
 * short phrase only gets ellipsised there; the limit keeps names label-shaped.
 */
export const MAX_RELATIONSHIP_NAME_LENGTH = 60;

/** Why a typed name was refused — the view turns each into plain copy. */
export type RelationshipNameRejection = "empty" | "too-long";

export type RelationshipNameParse =
	| { readonly kind: "valid"; readonly name: RelationshipName }
	| { readonly kind: "refused"; readonly reason: RelationshipNameRejection };

/** Trims the typed text, then refuses an empty or over-long name. Pure. */
export function parseRelationshipName(raw: string): RelationshipNameParse {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return { kind: "refused", reason: "empty" };
	}
	if (trimmed.length > MAX_RELATIONSHIP_NAME_LENGTH) {
		return { kind: "refused", reason: "too-long" };
	}
	return { kind: "valid", name: trimmed as RelationshipName };
}
