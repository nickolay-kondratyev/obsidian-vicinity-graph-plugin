# Decisions — External URLs in the graph (planning ticket nid_mw1az1i1aznfoxqsgcwnfus07_e)

Planning is done and split into 4 tickets (see map at bottom). I made reasonable
defaults so the independent parts can start; these are the points where your call
overrides my default. Each is tagged `decide` on its ticket. Reply inline.

## Background (facts found)

- **No non-network way to enrich a URL.** Obsidian's only fetch API (`requestUrl`)
  IS a flagged network call. There is no way to get a URL's title/favicon without
  phoning out — so your alias-only instinct is the right constraint: we render ONLY
  external URLs that already carry an author-written alias.
- External URLs are dropped in 3 places today; adding them is genuinely new
  plumbing (a new node kind end-to-end). Node identity is vault-path-keyed
  everywhere, so URL nodes get their own id space (`url:<normalized-url>`).

## Questions

**D1 — Do URL nodes count toward the node cap?**
Default: NO — exempt from the cap and truncation (they come only from centrals, so
already bounded). Alt: count them with lowest priority. → keep default?

**D2 — Same URL linked by two centrals with DIFFERENT aliases: which alias?**
Default: one node, first-seen alias wins (deterministic order), one edge per
source. → OK?

**D3 — Clicking a URL node.**
Default: opens the URL in the OS browser (`window.open`). No modifier alternate, no
in-Obsidian preview, no confirm dialog (it's an explicit click). → OK?

**D4 — Which links count as "external + aliased"?**
Default: body plain links + frontmatter property links. Embedded external URLs
(`![x](http…)`) out of scope. → OK?

**D5 — Node visual design.**
Handled by the showcase ticket `nid_hyzwoqadcfyvisveczuet3e8c_e`: ~10 variants,
you pick one. Nothing to decide yet — flagging where the look is chosen.

## Ticket map

- `nid_hyzwoqadcfyvisveczuet3e8c_e` — Design showcase (10 variants, you pick) [blocks view]
- `nid_prsk9olcj9u2fpzqgv5gb6zhe_e` — Engine + adapter (alias-only data, headless, tested)
- `nid_ccsw8o1rjcs2l7o1elgmlqx5i_e` — View rendering (new node kind) [needs design + engine]
- `nid_uqgew1fuqgrdyvas6eum6vaf2_e` — Follow-up: Depth pill to toggle URL rendering
