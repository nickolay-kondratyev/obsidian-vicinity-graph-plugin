---
id: nid_fc47gtxej6z7fqc53bflme8p5_e
title: "Named relationships between graph nodes (manual + AI-generated)"
status: open
deps: [nid_gk9h4jpa7di1al7och0rehd3h_e, nid_a5m4kforr9scit68rhqmqh78o_e, nid_cbnhpdfn4myqfzqr8weyg7kq5_e, nid_80xc6z8umlpo1x6u4p1v7eb22_e]
links: [nid_h8noa3wy468bay7j3t374ux9s_e]
created_iso: 2026-10-06T23:04:39Z
status_updated_iso: 2026-10-06T23:04:39Z
type: epic
priority: 2
assignee: nickolaykondratyev
tags: [relationships]
---

# Named relationships between graph nodes (manual + AI-generated)

Give edges in the vicinity graph a NAME ("improves", "part-of", "parent", ...) shown on the edge
and in the edge drawer. Names come from (highest precedence first):

1. **Note syntax**: an inline field `some-rel:: [[target-note]]` in the SOURCE note names the
   source→target edge `some-rel`. Read as-is, NEVER stored by us, NEVER sent to the AI.
2. **Manual**: the user names the edge from the edge drawer. Stored by us. The UI NEVER writes
   `::` syntax into notes.
3. **AI (auto mode)**: with the auto toggle ON (new top-right "Relationships" menu), an OpenAI model
   names edges that have no name yet. Stored by us, marked AI-generated.
4. **Code default**: a folder-hierarchy edge (folder note → child) is named `parent`. Computed, never
   stored. Any of 1-3 on that edge replaces it, and a `rel::` between the two notes in EITHER
   direction hides it.

Frontmatter keys (`related: "[[X]]"`) do NOT name relationships: such keys are usually weak/generic,
so the edge stays unnamed and can get a proper name (manual or AI). (Human decision 2026-10-06.)

## Data model — relationships are DIRECTED

- A relationship is a directed fact `from —name→ to` (`B —improves→ A`). It labels ONLY the edge with
  the SAME direction. It is never flipped: a stored `B —improves→ A` says nothing about `A → B`
  (that could be false), so an `A → B` edge stays unnamed and may be AI-named on its own.
- The active (MAIN) note does not change how a relationship reads: from A's graph,
  `B —improves→ A` still reads `B —improves→ A`.
- Only EXISTING edges are labeled (links + folder-hierarchy). Relationships never create edges.
- Stored relationships (manual + AI), one file per directed pair, keyed by docids (renames are
  non-events): `$VAULT/.plugin_data/vicinity_graph/from_id/<from_docid>/<to_docid>.json` via the existing
  `VaultFileStore` (`src/persistence/VaultFileStore.ts`):
  `{ "v1": { name: string | null, origin: "manual" | "ai", model?, reasoningEffort?,
  usage?: { inputTokens, outputTokens }, createdIso, updatedIso } }`.
  `name: null` = a DISMISSED AI name (the user cleared it; auto mode must not regenerate it).
  Clearing a manual name deletes the file.
- Docids come from `stable-ids-for-obsidian` (`DocIdPort.ensureDocId`, `src/adapters/obsidianPorts.ts`),
  which adds the `id` to a note's frontmatter when missing. Saving a relationship (manual OR AI) is a
  write intent, so ids are minted for both notes, like pinning does. `.md` and `.canvas` both carry ids.

## AI mode (human decisions 2026-10-06)

- Provider: OpenAI Responses API, model `gpt-6-luna` (default; user-editable slug), reasoning effort
  `medium` (default; user-editable). ~$0.10 / $0.50 per 1M input/output tokens.
- API key: a user-entered key in Obsidian's built-in SecretStorage (`app.secretStorage` +
  `SecretComponent`, since 1.11.4 — below our 1.12.4 floor). Obsidian keeps it OUTSIDE the vault,
  per vault, per device, OS-encrypted (Linux needs gnome-libsecret/kwallet). `data.json` stores only the
  secret's NAME. Fallback when no secret is chosen: the `OPENAI_API_KEY` env var. The plugin never
  writes the key anywhere itself.
- A directed LINK edge `A → B` is AI-eligible iff ALL hold:
  - no name of any origin for `A → B` (syntax, manual, AI, dismissed);
  - both notes have ≥ 200 chars of text after removing frontmatter, link syntax and whitespace
    (so a note that is just a link doesn't qualify);
  - neither note is inside a folder group in the current graph;
  - it is not a pure folder-hierarchy edge (that one already has `parent`).
- Prompt (KISS): BOTH full notes (the source includes its `[[target]]` link) + a fixed list of anchor
  relationship names (`increases`, `decreases`, ...) the model uses ONLY when one fits well, for
  consistency. Any other specific kebab-case name is equally fine; anchors are never forced. Vague
  names (`related`, `related-to`) are discouraged.
- Budget: at most 20 new requests per graph redraw, all 20 may run at once. Stored results make a
  later redraw free for already-named pairs. Token usage is saved in each file.
- The toggle is a persisted global setting, default OFF.

## Architecture fit

- Labels are an ASYNC ENRICHMENT after the engine build, not engine data: inline fields need file
  text (`vault.cachedRead`) and AI names arrive later. `GraphViewController` (the only view class
  touching Obsidian + async) resolves names for VISIBLE edges into a label overlay store (like
  `LinkPreviewOverlayStore`) that `src/view/VicinityEdge.tsx` reads. Labels never trigger relayout.
- Pure logic is in `src/engine/` or `src/shared/` and fixture-tested: the inline-field matcher, precedence,
  AI eligibility, prompt building and response validation.
- The removal choke point (`PluginDataStore.forgetDocs` + `PerDocStore.forgetDocs`, called from
  `vault.on('delete')` and `OrphanSweeper`) gains a THIRD side-by-side call, `RelationshipStore.forgetDocs`.
- Network: Obsidian `requestUrl` (no CORS, no `fetch(` token — see `src/view/libavoidTokenGuard.test.ts`).
  README must disclose the network use (Obsidian developer policy). `isDesktopOnly` is already `true`.

## Tasks

1/4 syntax names + `parent` default rendered → 2/4 storage + manual naming → 3/4 AI core behind fakes →
4/4 top-right menu + key + auto mode end to end. Each is shippable on its own.

## Decisions

All open questions were answered by the human on 2026-10-06 and are folded in above.
