import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import type { VaultScanGate } from "./IncrementalVaultIndex";
import { IncrementalVaultIndex, linksOrEmbedsScanGate } from "./IncrementalVaultIndex";
import type { CachedMetadataPort, MetadataCachePort, ReferencePort, VaultFilePort, VaultPort } from "./obsidianPorts";

/**
 * BDD coverage of the REUSABLE incremental vault-index infrastructure
 * (ticket `nid_82g9goy92k9ciyy64m1r6jofe_e`). The machinery is generic; here a
 * trivial parser (`content → entry when it contains "::"`) stands in for a real
 * consumer so the tests prove the LIFECYCLE — scan gating, bounded concurrency,
 * event-driven replace-whole-entry, rekey/drop, readiness sequencing, and the
 * event-beats-scan race — independently of any one consumer's parse rules.
 */

/** The trivial stand-in parser: content is the entry, unless it names no field. */
const parseField = (_path: unknown, content: string): string | null => (content.includes("::") ? content : null);

/** A parser with a poison pill, for the throw-absorption policy tests. */
const parseOrThrow = (path: unknown, content: string): string | null => {
	if (content.includes("boom")) {
		throw new Error(`parser choked on ${String(path)}`);
	}
	return parseField(path, content);
};

interface TestFile {
	readonly path: string;
	readonly content: string;
	/** metadataCache link count for the read gate. Default 0. */
	readonly links?: number;
	/** metadataCache embed count for the read gate. Default 0. */
	readonly embeds?: number;
}

function refs(count: number): readonly ReferencePort[] {
	return Array.from({ length: count }, () => ({ link: "x", position: { start: { offset: 0 } } }));
}

/** metadataCache whose only job here is answering the links/embeds read gate. */
function metadataFor(files: readonly TestFile[]): MetadataCachePort {
	const fileCaches: Record<string, CachedMetadataPort> = {};
	for (const file of files) {
		fileCaches[file.path] = { links: refs(file.links ?? 0), embeds: refs(file.embeds ?? 0) };
	}
	return new FakeObsidianPorts({ files: [], fileCaches }).metadataCache;
}

/** The default gate most tests use: {@link linksOrEmbedsScanGate} over the fake cache. */
function gateFor(files: readonly TestFile[]): VaultScanGate {
	return linksOrEmbedsScanGate(metadataFor(files));
}

class Deferred<T> {
	resolve!: (value: T) => void;
	reject!: (reason: unknown) => void;
	readonly promise = new Promise<T>((resolve, reject) => {
		this.resolve = resolve;
		this.reject = reject;
	});
}

/** Test port with a MUTABLE path — Obsidian mutates `TFile.path` in place on rename. */
type MutableFilePort = Omit<VaultFilePort, "path"> & { path: string };

/**
 * A {@link VaultPort} that records reads, tracks peak concurrent reads, and can
 * GATE each `cachedRead` on a per-path barrier so a test controls when a read
 * resolves (for the concurrency bound and the event-beats-scan races). Content
 * is keyed by port IDENTITY, not path, mirroring the real vault: a rename moves
 * the path, a delete leaves a parked read able to resolve its stale snapshot.
 */
class TestVault implements VaultPort {
	readonly reads: string[] = [];
	getFilesCalls = 0;
	peakInFlight = 0;
	private inFlight = 0;
	private readonly gates = new Map<string, Deferred<void>>();
	private readonly ports: MutableFilePort[] = [];
	private readonly contentByFile = new Map<VaultFilePort, string>();

	constructor(
		files: readonly TestFile[],
		private readonly opts: {
			readonly gate?: boolean;
			readonly failPaths?: ReadonlySet<string>;
			/** First `getFiles` throws — proves a failed scan retries instead of memoising the rejection. */
			readonly failFirstGetFiles?: boolean;
		} = {},
	) {
		for (const file of files) {
			const port: MutableFilePort = {
				path: file.path,
				extension: "md",
				stat: { mtime: 0, size: 0 },
				parent: { path: "/" },
			};
			this.ports.push(port);
			this.contentByFile.set(port, file.content);
		}
	}

	getFileByPath(path: string): VaultFilePort | null {
		return this.ports.find((file) => file.path === path) ?? null;
	}

	getFiles(): VaultFilePort[] {
		this.getFilesCalls += 1;
		if (this.opts.failFirstGetFiles && this.getFilesCalls === 1) {
			throw new Error("getFiles failed");
		}
		return [...this.ports];
	}

	async cachedRead(file: VaultFilePort): Promise<string> {
		this.reads.push(file.path);
		this.inFlight += 1;
		this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
		try {
			if (this.opts.gate) {
				const gate = new Deferred<void>();
				this.gates.set(file.path, gate);
				await gate.promise;
			}
			if (this.opts.failPaths?.has(file.path)) {
				throw new Error(`read failed: ${file.path}`);
			}
			return this.contentByFile.get(file) ?? "";
		} finally {
			this.inFlight -= 1;
		}
	}

	/** Remove the file from the vault; a parked read of it still resolves its old content. */
	deleteFile(path: string): void {
		const index = this.ports.findIndex((file) => file.path === path);
		if (index >= 0) {
			this.ports.splice(index, 1);
		}
	}

	/** Mutate the port's path in place, as Obsidian does BEFORE firing 'rename'. */
	renameFile(oldPath: string, newPath: string): void {
		const port = this.ports.find((file) => file.path === oldPath);
		if (port !== undefined) {
			port.path = newPath;
		}
	}

	/** Resolve the ONE parked read that started under `pathAtReadTime`. */
	release(pathAtReadTime: string): void {
		this.gates.get(pathAtReadTime)?.resolve();
	}

	releaseAll(): void {
		for (const gate of this.gates.values()) {
			gate.resolve();
		}
	}
}

/** Flush the microtask queue enough times to let a gated worker pool make progress. */
async function settle(): Promise<void> {
	for (let i = 0; i < 20; i += 1) {
		await Promise.resolve();
	}
}

describe("IncrementalVaultIndex — initial scan gating", () => {
	it("WHEN a file has links THEN it is read and parsed", async () => {
		const vault = new TestVault([{ path: "a.md", content: "a::x", links: 1 }]);
		const index = new IncrementalVaultIndex(vault, gateFor([{ path: "a.md", content: "a::x", links: 1 }]), parseField);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("a.md"))).toBe("a::x");
	});

	it("WHEN a file has ONLY embeds THEN it is still read (rel::![[x]] lands in embeds)", async () => {
		const files = [{ path: "e.md", content: "e::x", embeds: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();

		expect(vault.reads).toContain("e.md");
	});

	it("WHEN a file has neither links nor embeds THEN it is never read", async () => {
		const files = [{ path: "plain.md", content: "plain::x" }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();

		expect(vault.reads).not.toContain("plain.md");
	});

	it("WHEN a gated file is parsed to null THEN no entry is held for it", async () => {
		const files = [{ path: "nofield.md", content: "no field here", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("nofield.md"))).toBeUndefined();
	});

	it("WHEN a consumer supplies its own scan gate THEN gating follows it, not metadataCache", async () => {
		const files = [{ path: "plain.md", content: "plain::x" }]; // no links, no embeds
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, () => true, parseField);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("plain.md"))).toBe("plain::x");
	});
});

describe("IncrementalVaultIndex — readiness sequencing", () => {
	it("WHEN ensureReady is called twice THEN the vault is swept exactly once", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();
		await index.ensureReady();

		expect(vault.getFilesCalls).toBe(1);
	});

	it("WHEN reads are bounded THEN in-flight never exceeds the concurrency limit", async () => {
		const files = Array.from({ length: 10 }, (_unused, i) => ({ path: `f${i}.md`, content: `f::${i}`, links: 1 }));
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField, () => {}, 3);

		const ready = index.ensureReady();
		expect(vault.peakInFlight).toBe(3);
		for (let i = 0; i < files.length + 2; i += 1) {
			vault.releaseAll();
			await settle();
		}
		await ready;

		expect(vault.peakInFlight).toBe(3);
	});
});

describe("IncrementalVaultIndex — event-driven freshness", () => {
	it("WHEN a file changes THEN its whole entry is replaced from the new content", async () => {
		const files = [{ path: "a.md", content: "a::old", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);
		await index.ensureReady();

		index.handleFileChanged("a.md", "a::new");

		expect(index.entryFor(asVaultPath("a.md"))).toBe("a::new");
	});

	it("WHEN a changed file no longer parses THEN its entry is dropped", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);
		await index.ensureReady();

		index.handleFileChanged("a.md", "no field now");

		expect(index.entryFor(asVaultPath("a.md"))).toBeUndefined();
	});

	it("WHEN a file is deleted THEN its entry is dropped", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);
		await index.ensureReady();

		index.handleFileDeleted("a.md");

		expect(index.entryFor(asVaultPath("a.md"))).toBeUndefined();
	});

	it("WHEN a file is renamed THEN its entry is rekeyed to the new path", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);
		await index.ensureReady();

		index.handleFileRenamed("a.md", "b.md");

		expect(index.entryFor(asVaultPath("b.md"))).toBe("a::x");
	});

	it("WHEN a file is renamed THEN the old path holds no entry", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);
		await index.ensureReady();

		index.handleFileRenamed("a.md", "b.md");

		expect(index.entryFor(asVaultPath("a.md"))).toBeUndefined();
	});
});

describe("IncrementalVaultIndex — events racing the initial scan", () => {
	it("WHEN a change lands mid-scan THEN the event wins over the scan's stale read", async () => {
		const files = [{ path: "a.md", content: "a::stale", links: 1 }];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		const ready = index.ensureReady(); // worker parks on the gated read of a.md
		index.handleFileChanged("a.md", "a::fresh"); // arrives before the read resolves
		vault.releaseAll(); // scan's read now resolves with the stale content
		await ready;

		expect(index.entryFor(asVaultPath("a.md"))).toBe("a::fresh");
	});

	it("WHEN a rename lands mid-scan THEN the file is still indexed under its new path", async () => {
		// Obsidian mutates TFile.path to the new path BEFORE firing 'rename', so the
		// scan's gated read resolves under the new path. The rename must not cause the
		// scan to skip that path, or the (unchanged-content) file is lost for the session.
		const files = [{ path: "b.md", content: "b::x", links: 1 }];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		const ready = index.ensureReady(); // worker parks on the gated read of the file (now at b.md)
		index.handleFileRenamed("a.md", "b.md"); // rename event: no entry yet to rekey
		vault.releaseAll();
		await ready;

		expect(index.entryFor(asVaultPath("b.md"))).toBe("b::x");
	});

	it("WHEN a change then a rename land mid-scan THEN the scan's stale read does not clobber the rekeyed fresh entry", async () => {
		// The changed event settles the OLD path and stores fresh content; the rename
		// rekeys that fresh entry to the new path. The scan's still-parked read resolves
		// under the NEW path (Obsidian mutated TFile.path before firing 'rename'), so the
		// settled mark must follow the rekey or the stale read overwrites the event truth.
		const files = [{ path: "b.md", content: "b::stale", links: 1 }];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		const ready = index.ensureReady(); // worker parks on the gated read (file now at b.md)
		index.handleFileChanged("a.md", "a::fresh"); // event truth under the old path
		index.handleFileRenamed("a.md", "b.md"); // rekeys the fresh entry to b.md
		vault.releaseAll(); // scan's read resolves with the stale content under b.md
		await ready;

		expect(index.entryFor(asVaultPath("b.md"))).toBe("a::fresh");
	});

	it("WHEN a delete lands mid-scan THEN the scan does not resurrect the entry", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		const ready = index.ensureReady();
		index.handleFileDeleted("a.md");
		vault.releaseAll();
		await ready;

		expect(index.entryFor(asVaultPath("a.md"))).toBeUndefined();
	});

	it("WHEN a file is renamed onto a path settled by a deleted file mid-scan THEN the renamed file is still indexed", async () => {
		// File X at p.md is deleted (settling p.md), then file Y is renamed r.md → p.md.
		// The settled mark belonged to X, not to the path NAME: Y's parked read (landing
		// under p.md — Obsidian mutated TFile.path before firing 'rename') is fresh, and
		// skipping it would lose Y for the session, since no later event re-indexes it.
		const files = [{ path: "p.md", content: "y::fresh", links: 1 }];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		const ready = index.ensureReady(); // worker parks on the gated read of Y (now at p.md)
		index.handleFileDeleted("p.md"); // X, the previous occupant of p.md, is deleted
		index.handleFileRenamed("r.md", "p.md"); // Y arrives at p.md
		vault.releaseAll();
		await ready;

		expect(index.entryFor(asVaultPath("p.md"))).toBe("y::fresh");
	});

	it("WHEN a file is renamed onto a path vacated by a changed-then-renamed file mid-scan THEN the newcomer is still indexed", async () => {
		// X (at p.md) is changed (settling p.md) then renamed p.md → q.md; Y is then
		// renamed r.md → p.md. X's settled mark must FOLLOW X to q.md and leave with
		// it — a mark lingering on p.md would make the scan skip Y's fresh read.
		const files = [
			{ path: "q.md", content: "x::stale", links: 1 },
			{ path: "p.md", content: "y::fresh", links: 1 },
		];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		const ready = index.ensureReady(); // both reads park (X now at q.md, Y now at p.md)
		index.handleFileChanged("p.md", "x::event"); // X changes while still at p.md
		index.handleFileRenamed("p.md", "q.md"); // X moves away, carrying its settledness
		index.handleFileRenamed("r.md", "p.md"); // Y arrives at p.md
		vault.releaseAll();
		await ready;

		expect(index.entryFor(asVaultPath("p.md"))).toBe("y::fresh");
	});

	it("WHEN a deleted file's parked read resolves after another file takes its path THEN the stale read does not clobber the newcomer", async () => {
		// X at p.md and Y at r.md both park mid-scan. X is deleted (settling p.md), Y is
		// renamed r.md → p.md (unsettling p.md so Y's own read is not skipped). X's parked
		// read is STILL keyed p.md — a deleted TFile keeps its path — and resolves LAST,
		// after Y's read stored fresh content. Settledness can't catch it (the rename had
		// to clear the mark), so the file-identity check must: X no longer answers to p.md.
		const files = [
			{ path: "p.md", content: "x::stale", links: 1 },
			{ path: "r.md", content: "y::fresh", links: 1 },
		];
		const vault = new TestVault(files, { gate: true });
		const index = new IncrementalVaultIndex(vault, () => true, parseField);

		const ready = index.ensureReady(); // both reads park (X at p.md, Y at r.md)
		vault.deleteFile("p.md");
		index.handleFileDeleted("p.md"); // X, the occupant of p.md, is deleted
		vault.renameFile("r.md", "p.md");
		index.handleFileRenamed("r.md", "p.md"); // Y takes p.md
		vault.release("r.md"); // Y's read resolves first, under its NEW path p.md
		await settle();
		vault.release("p.md"); // X's stale read resolves last, still keyed p.md
		await settle();
		await ready;

		expect(index.entryFor(asVaultPath("p.md"))).toBe("y::fresh");
	});
});

describe("IncrementalVaultIndex — robustness and observation", () => {
	it("WHEN the scan gate throws on a file THEN the file is admitted and indexed (the safe direction)", async () => {
		// A refused file is lost for the whole session, an admitted one costs a read —
		// so a gate throw is absorbed as ADMIT, never as a scan-sinking rejection.
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const throwingGate: VaultScanGate = () => {
			throw new Error("gate exploded");
		};
		const index = new IncrementalVaultIndex(vault, throwingGate, parseField);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("a.md"))).toBe("a::x");
	});

	it("WHEN one file cannot be read THEN the rest of the scan still completes", async () => {
		const files = [
			{ path: "ok1.md", content: "ok1::x", links: 1 },
			{ path: "bad.md", content: "bad::x", links: 1 },
			{ path: "ok2.md", content: "ok2::x", links: 1 },
		];
		const vault = new TestVault(files, { failPaths: new Set(["bad.md"]) });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("ok2.md"))).toBe("ok2::x");
	});

	it("WHEN an unreadable file is scanned THEN it holds no entry", async () => {
		const files = [{ path: "bad.md", content: "bad::x", links: 1 }];
		const vault = new TestVault(files, { failPaths: new Set(["bad.md"]) });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("bad.md"))).toBeUndefined();
	});

	it("WHEN the parser throws on one file THEN the rest of the scan still completes", async () => {
		const files = [
			{ path: "ok.md", content: "ok::x", links: 1 },
			{ path: "bad.md", content: "boom", links: 1 },
		];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseOrThrow);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("ok.md"))).toBe("ok::x");
	});

	it("WHEN the parser throws on a scanned file THEN that file holds no entry", async () => {
		const files = [{ path: "bad.md", content: "boom", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseOrThrow);

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("bad.md"))).toBeUndefined();
	});

	it("WHEN the parser throws on a changed file THEN the stale entry drops instead of the throw escaping", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseOrThrow);
		await index.ensureReady();

		index.handleFileChanged("a.md", "boom");

		expect(index.entryFor(asVaultPath("a.md"))).toBeUndefined();
	});

	it("WHEN the initial scan fails THEN the next ensureReady retries instead of memoising the rejection", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files, { failFirstGetFiles: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);
		await expect(index.ensureReady()).rejects.toThrow("getFiles failed");

		await index.ensureReady();

		expect(index.entryFor(asVaultPath("a.md"))).toBe("a::x");
	});

	it("WHEN startEagerly's scan fails THEN the failure is absorbed and the next ensureReady retries", async () => {
		// The eager fire-and-forget start must not surface an unhandled rejection: the
		// retry design drops the memo on failure, so NOBODY else observes that promise.
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files, { failFirstGetFiles: true });
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		index.startEagerly();
		await settle(); // let the absorbed rejection drop the memo
		await index.ensureReady();

		expect(index.entryFor(asVaultPath("a.md"))).toBe("a::x");
	});

	it("WHEN startEagerly succeeds THEN a later ensureReady joins the same scan (swept once)", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		index.startEagerly();
		await index.ensureReady();

		expect(vault.getFilesCalls).toBe(1);
	});

	it("WHEN the scan completes THEN the onChanged observer has fired", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		let notifications = 0;
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField, () => {
			notifications += 1;
		});

		await index.ensureReady();

		expect(notifications).toBe(1);
	});

	it("WHEN a freshness event mutates the index THEN the onChanged observer fires again", async () => {
		const files = [{ path: "a.md", content: "a::x", links: 1 }];
		const vault = new TestVault(files);
		let notifications = 0;
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField, () => {
			notifications += 1;
		});
		await index.ensureReady();

		index.handleFileChanged("a.md", "a::y");

		expect(notifications).toBe(2);
	});

	it("WHEN entries are built THEN allEntries exposes them for a derived index", async () => {
		const files = [
			{ path: "a.md", content: "a::x", links: 1 },
			{ path: "b.md", content: "b::x", embeds: 1 },
		];
		const vault = new TestVault(files);
		const index = new IncrementalVaultIndex(vault, gateFor(files), parseField);

		await index.ensureReady();

		expect([...index.allEntries().keys()].sort()).toEqual([asVaultPath("a.md"), asVaultPath("b.md")]);
	});
});
