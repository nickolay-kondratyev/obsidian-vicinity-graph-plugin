# CLARIFICATION — Step 03: Obsidian Adapters + Persistence (PUBLIC)

Resolved with HUMAN on 2026-07-17. Binding on all step-03 sub-agents.

## Q1 — Incoming links API: HUMAN-approved (a)

Use `metadataCache.getBacklinksForFile` via **one narrow typed wrapper** (single cast, isolated in one adapter file) with a **runtime presence check**. If absent at runtime → **fall back to inverting the public `resolvedLinks`** (inverted index built once during provider indexing; sync lookups after).

- HUMAN context: Obsidian team member references this API publicly (forum thread "How to get backlinks for a file", post 9) — unlikely to disappear, but the fallback stays as robustness.

## Q2 — Devtools canvas-indexing verification: RESULT RECORDED

HUMAN ran on the target install:
```js
Object.keys(app.metadataCache.resolvedLinks).filter(k => k.endsWith('.canvas')).length
// → 0
```
**Finding: no `.canvas` keys in `resolvedLinks` on the target install → the fallback canvas parser is expected to be the ACTIVE path there.** The fallback parser gets first-class treatment (not dormant-only): dedicated fixtures + mtime-cached parsing per step-02 Q2.

Caveat (non-blocking): a `0` result is also what a vault with zero canvas files would report. The build-time capability detection is adaptive and handles every combination correctly, so no further verification is needed. IMPLEMENTATION must record this finding in the step doc's planning notes (step doc explicitly asks for it).

## Q3 — Unsafe docid filename policy: HUMAN-approved (a) with UX constraint

**Refuse per-doc persistence** for docs whose docid is not filename-safe. Doc still fully works in graphs; it just cannot be pinned or carry per-doc settings.

- **UX constraint (HUMAN):** the "graceful notice" must NOT be a repeated popup. It is an **emblem on the node**; clicking the emblem explains why the doc is not persistable.
- Step-03 scope: persistence layer exposes a **typed non-persistable result with reason** (e.g. unsafe-docid, no-docid) so the UI steps (04/06) can render the emblem. No UI in this step.

## Planning defaults (proposed by TOP_LEVEL_AGENT, no HUMAN objection)

| Item | Decision |
|---|---|
| Outgoing link order | `getFileCache().links/embeds` for true reference order (first-image/attachment correctness); `resolvedLinks` for resolution |
| Path→docid map lifecycle | Warmed by the delayed chunked sweep + lazily filled on visit |
| `centralDepths` cleanup on unpin | Leave to sweep (step doc's lean) |
| Code location | `src/adapters/` + `src/persistence/` (`src/engine/` is import-guarded) |
| Root vitest obsidian mock | Add minimal root-level `obsidian` alias mock only if needed; prefer extracting branching logic to pure functions |
