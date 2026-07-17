import { DocDataMutations } from "./DocDataMutations";
import { DocPersistEligibility } from "./DocPersistEligibility";
import type { DocData } from "./persistedShapes";
import { PersistedShapes } from "./persistedShapes";
import type { FileStoragePort } from "./storagePorts";

const DOC_DATA_FILE_EXTENSION = ".json";
/** Obsidian's JSON files use tab indentation; doc-data files follow suit. */
const JSON_INDENT = "\t";

/**
 * One file per doc at `<dirPath>/<docid>.json` (`vault.adapter` writes):
 * sync-friendly granularity — doc A's change never rewrites doc B's file.
 * Read-modify-writes are serialized per docid, so two rapid toggles on the
 * same doc cannot lose each other's field.
 *
 * Callers gate docids through {@link DocPersistEligibility} FIRST (Q3); this
 * store re-asserts and throws on unsafe docids — reaching it unclassified is
 * a programmer error, not a user condition.
 */
export class DocDataStore {
	private readonly queueByDocid = new Map<string, Promise<unknown>>();
	private dirEnsured = false;

	constructor(
		private readonly storage: FileStoragePort,
		private readonly dirPath: string,
	) {}

	async load(docid: string): Promise<DocData | null> {
		const filePath = this.filePathOf(docid);
		if (!(await this.storage.exists(filePath))) {
			return null;
		}
		return PersistedShapes.parseDocData(parseJsonOrNull(await this.storage.read(filePath)));
	}

	/**
	 * Serialized read-modify-write. When the mutation empties the doc data,
	 * the file is deleted instead of persisting `{}` (absence = inherit).
	 */
	update(docid: string, mutate: (current: DocData) => DocData): Promise<DocData> {
		return this.enqueue(docid, async () => {
			const updated = mutate((await this.load(docid)) ?? PersistedShapes.emptyDocData());
			const filePath = this.filePathOf(docid);
			if (DocDataMutations.isEmpty(updated)) {
				await this.removeIfExists(filePath);
			} else {
				await this.ensureDir();
				await this.storage.write(filePath, JSON.stringify(updated, null, JSON_INDENT));
			}
			return updated;
		});
	}

	remove(docid: string): Promise<void> {
		return this.enqueue(docid, () => this.removeIfExists(this.filePathOf(docid)));
	}

	/**
	 * Docids that currently have a doc-data file (sweep input). Only
	 * filename-safe stems qualify: this store never writes any other name, so
	 * a foreign json (sync-conflict artifact, hand-made file) is not ours to
	 * manage — listing it would make the sweep try to delete via a docid that
	 * {@link filePathOf} rightly refuses.
	 */
	async listDocIds(): Promise<readonly string[]> {
		if (!(await this.storage.exists(this.dirPath))) {
			return [];
		}
		return (await this.storage.list(this.dirPath)).files
			.filter((filePath) => filePath.endsWith(DOC_DATA_FILE_EXTENSION))
			.map((filePath) => basenameOf(filePath).slice(0, -DOC_DATA_FILE_EXTENSION.length))
			.filter((stem) => DocPersistEligibility.isFilenameSafeDocId(stem));
	}

	private filePathOf(docid: string): string {
		if (!DocPersistEligibility.isFilenameSafeDocId(docid)) {
			throw new Error(`DocDataStore misuse: docid [${docid}] must be refused by DocPersistEligibility first`);
		}
		return `${this.dirPath}/${docid}${DOC_DATA_FILE_EXTENSION}`;
	}

	private async removeIfExists(filePath: string): Promise<void> {
		if (await this.storage.exists(filePath)) {
			await this.storage.remove(filePath);
		}
	}

	private async ensureDir(): Promise<void> {
		if (!this.dirEnsured) {
			if (!(await this.storage.exists(this.dirPath))) {
				await this.storage.mkdir(this.dirPath);
			}
			this.dirEnsured = true;
		}
	}

	private enqueue<T>(docid: string, task: () => Promise<T>): Promise<T> {
		const tail = this.queueByDocid.get(docid) ?? Promise.resolve();
		// `.catch` keeps one failed write from wedging the doc's queue; the
		// failure still reaches ITS caller through the returned promise.
		const next = tail.catch(() => undefined).then(task);
		this.queueByDocid.set(docid, next);
		return next;
	}
}

function parseJsonOrNull(rawJson: string): unknown {
	try {
		return JSON.parse(rawJson);
	} catch {
		return null;
	}
}

function basenameOf(filePath: string): string {
	return filePath.slice(filePath.lastIndexOf("/") + 1);
}
