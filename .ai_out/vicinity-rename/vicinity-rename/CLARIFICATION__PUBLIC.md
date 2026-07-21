# CLARIFICATION — resolved with human

## Q1 — Word-family scope → **Option A (confirmed)**
- Rename `neighborhood` / `Neighborhood` / `NEIGHBORHOOD` (534 hits) → `vicinity` (matching case).
- **DO NOT** rename the graph-adjacency term `neighbor` / `neighbors` / `neighboring` / `neighbour(s)`.
  It stays as standard graph-theory vocabulary.
- Exception: the two user-facing **description strings** get reworded (see Description below).

## Q2 — Version → **Option A (confirmed)**
- Leave `version` at `0.1.0` everywhere (package.json, manifest.json, versions.json). No change.

## Naming (confirmed)
| Field | From → To |
|---|---|
| manifest `id` | `obsidian-neighborhood-graph` → `vicinity-graph` |
| manifest `name` | `Neighborhood Graph` → `Vicinity Graph` |
| package.json `name` | `obsidian-neighborhood-graph` → `vicinity-graph` |
| view-type string | `neighborhood-graph-view` → `vicinity-graph-view` |

## Description (NEW human requirement — for discoverability)
The `description` in `manifest.json` AND `package.json` must include the phrases
**"local graph"** and **"nearby notes"** so users searching can find it.
- Rewrite (proposed): `"Vicinity graph: a richer local graph showing nearby notes (an improved alternative to the built-in local graph)."`
  — PLANNER may refine wording but MUST keep both key phrases and drop "neighboring".

## Exclusions (do NOT modify)
- `submodules/**` (separate repo `obsidian-id-lib`).
- `.ai_out/**` (agent scratch / historical).
- `.git/**`, `node_modules/**`, `package-lock.json` (regenerated).
- `ask.dnc.md` (the task prompt itself).

## Casing forms to handle
`neighborhood`→`vicinity`, `Neighborhood`→`Vicinity`, `NEIGHBORHOOD`→`VICINITY`,
kebab `neighborhood-graph`→`vicinity-graph`, plus file basenames.
