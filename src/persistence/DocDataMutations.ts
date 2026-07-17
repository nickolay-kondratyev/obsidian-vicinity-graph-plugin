import type { DepthOverride, ViewSettings } from "../engine";
import type { DocData } from "./persistedShapes";
import { PERSISTED_SHAPE_VERSION } from "./persistedShapes";

/**
 * Pure per-field mutations of a {@link DocData} — the pin-on-toggle rule made
 * code: setting a field WRITES it (even when equal to the global default),
 * `undefined` REMOVES it (back to inherit). Never a whole-document snapshot.
 */
export class DocDataMutations {
	static setDepthField(doc: DocData, field: keyof DepthOverride, value: number | undefined): DocData {
		return normalized({ ...doc, depths: setOrRemove(doc.depths ?? {}, field, value) });
	}

	static setViewField<K extends keyof ViewSettings>(
		doc: DocData,
		field: K,
		value: ViewSettings[K] | undefined,
	): DocData {
		return normalized({ ...doc, view: setOrRemove(doc.view ?? {}, field, value) });
	}

	static setCentralDepthField(
		doc: DocData,
		centralDocid: string,
		field: keyof DepthOverride,
		value: number | undefined,
	): DocData {
		const centralDepths = { ...doc.centralDepths };
		const updatedOverride = setOrRemove(centralDepths[centralDocid] ?? {}, field, value);
		if (Object.keys(updatedOverride).length === 0) {
			delete centralDepths[centralDocid];
		} else {
			centralDepths[centralDocid] = updatedOverride;
		}
		return normalized({ ...doc, centralDepths });
	}

	/** Drops stale centralDepths entries (sweep cleanup path). */
	static withoutCentralDepths(doc: DocData, staleCentralDocids: readonly string[]): DocData {
		const centralDepths = { ...doc.centralDepths };
		for (const docid of staleCentralDocids) {
			delete centralDepths[docid];
		}
		return normalized({ ...doc, centralDepths });
	}

	/** True when nothing is pinned anymore — the store deletes the file instead of writing `{}`. */
	static isEmpty(doc: DocData): boolean {
		return doc.depths === undefined && doc.view === undefined && doc.centralDepths === undefined;
	}
}

function setOrRemove<T extends object, K extends keyof T>(obj: T, field: K, value: T[K] | undefined): T {
	const updated = { ...obj };
	if (value === undefined) {
		delete updated[field];
	} else {
		updated[field] = value;
	}
	return updated;
}

/** Canonical form: empty sub-objects are absent, version is always stamped. */
function normalized(doc: DocData): DocData {
	return {
		version: PERSISTED_SHAPE_VERSION,
		...(doc.depths !== undefined && Object.keys(doc.depths).length > 0 ? { depths: doc.depths } : {}),
		...(doc.view !== undefined && Object.keys(doc.view).length > 0 ? { view: doc.view } : {}),
		...(doc.centralDepths !== undefined && Object.keys(doc.centralDepths).length > 0
			? { centralDepths: doc.centralDepths }
			: {}),
	};
}
