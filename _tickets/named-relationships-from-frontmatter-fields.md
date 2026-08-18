---
closed_iso: 2026-08-18T01:48:00Z
session_ids: [{"a": "claude", "type": "execution", "id": "cf851652-75e3-434d-806f-a7f08a8831bc"}, {"a": "claude", "type": "review", "id": "41fc8bcc-c003-433b-a1be-71322bcc1aba"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ibx7hmt6cvmjh5rydi2aiyab9_e
title: "Named relationships from frontmatter fields"
status: closed
deps: [nid_wldz7yfjecf9fuwtlezlbde9s_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T01:48:00Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Frontmatter link-valued fields are named relationships: `up: "[[parent]]"` → THIS_NOTE --up--> parent (Breadcrumbs-style vaults keep hierarchy here). Obsidian metadataCache exposes `frontmatterLinks` with field KEY + link target — ZERO file reading and no `::` parsing.

Merge frontmatter-sourced statements as another source feeding the same engine port / LinkProvider merge as inline statements (own focused ticket per sign-off). Scalar-valued frontmatter fields are attributes — ignored. Key naming: field key is the relation name verbatim; list-valued fields (`up: [ "[[a]]", "[[b]]" ]`) yield one relation per target (frontmatterLinks already flattens with `key.N` — strip the index suffix).

Tests: fake provider fixtures + parity with inline statements in edge assembly.

--------------------------------------------------------------------------------

## Resolution (2026-08-17)

Frontmatter link-valued fields now flow into the graph as named relationships,
merged into the SAME `ObsidianLinkProvider.getOutgoingReferences` stream as inline
`::` statements — the either-budget union, so a named link stays a plain link too.

### What was built

- **`src/adapters/FrontmatterRelationships.ts`** (new) — a pure adapter helper (NOT
  an index: metadataCache already exposes the data, so no scan/parse/freshness).
  `FrontmatterRelationships.namedReferences(frontmatterLinks, resolve)` turns each
  `FrontmatterLinkPort` into a label-bearing `OutgoingReference`
  (`{ target, kind: "link", relations: [{ name }] }`). The relation NAME is the field
  key verbatim via the exported `relationNameOf(key)`, which strips a trailing
  numeric list-index suffix (`up.0` → `up`; a non-numeric dotted nested key is kept).
  Frontmatter links are never embeds (`ReferenceOrder` pins this), so kind is always
  `"link"`. Dangling targets (resolver returns `undefined`) are dropped — graceful
  degradation, no plain cache edge either.
- **`src/adapters/obsidianPorts.ts`** — `FrontmatterLinkPort` gained the required
  `key: string` (structural mirror of Obsidian's `FrontmatterLinkCache.key`).
- **`src/adapters/ObsidianLinkProvider.ts`** — `getOutgoingReferences` now captures
  the file cache once, builds `frontmatterNamed` from `cache?.frontmatterLinks` via
  the new helper (resolving through the new private `resolveVaultPath`), and folds it
  into the existing `OutgoingReferences.deduped([...base, ...idRefs, ...named, ...])`
  merge. The plain frontmatter link is already in `base` (via `ReferenceOrder`), so
  `deduped` attaches the field-key label onto it — ONE occurrence, ONE edge.

### Why no index / no main.ts wiring

Unlike inline statements (which need the `IncrementalVaultIndex` scan because
metadataCache carries no `::` prefixes), frontmatter link fields are read LIVE from
`metadataCache.getFileCache(...).frontmatterLinks` at query time. A `metadataCache`
'changed' event already triggers a rebuild through existing wiring, so there is no
freshness handler, no plugin-lived state, and no `main.ts` change.

### Tests

- `src/adapters/FrontmatterRelationships.test.ts` (new) — scalar field, list-field
  index-suffix sharing, dangling drop, never-embed, empty input; plus `relationNameOf`
  cases.
- `src/adapters/ObsidianLinkProvider.test.ts` — new `frontmatter named relationships`
  describe: field-key label, list `up.0`/`up.1` sharing one name, and the ACCEPTANCE
  PARITY test (a frontmatter relation and the equivalent inline `up::[[t]]` reach edge
  assembly as the SAME labeled reference). Pre-existing frontmatter-property-link kind
  tests were updated to reflect the intended behavior change: a frontmatter property
  link now carries its field-key relation (it is a NAMED link now, still a plain link).
- Existing fakes that supply `frontmatterLinks` gained a `key` (required-field
  update): `ReferenceOrder.test.ts`, `ObsidianLinkOccurrenceProvider.test.ts`.

### Gate

`npm run check` (0 errors) + `npm test` (2349 passing) green. This is an
adapter/data-merge change with NO rendered surface of its own — edge-label rendering
is the separate view ticket `nid_wnagjm2j144u0jsgixpcmmpar_e` — so `npm test` is the
correct gate (no e2e needed). Docs beyond the architecture-map pointer are the
docs ticket `nid_onhd5y7uqnbz8fl1hweryjuk4_e`.

### Assumption stated

"Strip the index suffix" was read as: remove a single trailing `.<digits>` segment
only. `up.0`/`up.1` collapse to `up`; a genuinely nested object key like
`related.parent` is left intact. This matches Obsidian's list-flattening format and
avoids guessing at nested-object semantics.

