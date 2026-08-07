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

I am thinking is that they do count towards the node count as technically they are going to eat the space. BUT I agree lets count them with lowest priority. 

**D2 — Same URL linked by two centrals with DIFFERENT aliases: which alias?**
Default: one node, first-seen alias wins (deterministic order), one edge per
source. → OK?
Yep that is fine first one wins. However, we WOULD like to have the X-<Count> of how many links link to the link from the central node. That is helpful. So if there are multiple links to the same URL from the central node we would like to know about it, and the link fly out should support rendering the preview of where are we linking to it.

**D3 — Clicking a URL node.**
Default: opens the URL in the OS browser (`window.open`). No modifier alternate, no
in-Obsidian preview, no confirm dialog (it's an explicit click). → OK?
Yep. Sounds good - KISS.

**D4 — Which links count as "external + aliased"?**
Default: body plain links + frontmatter property links. Embedded external URLs
(`![x](http…)`) out of scope. → OK?
Please give me more detail I was thinking  that `![x](http…)` is the main use case. Lets dive a bit deeper on this to align.

--- D4 DEEP DIVE (2026-08-06, awaiting your pick) ---

The external reference forms in a note, and what we can show WITHOUT any network call:

| Form | Obsidian bucket | text we have | notes |
|---|---|---|---|
| `[label](https://…)` | links | `label` | plain hyperlink |
| `![alt](https://…)` | embeds | `alt` (OFTEN EMPTY) | external embed — YOUR main case |
| bare `https://…` | links | none | no human label |
| frontmatter `key: https://…` / `[l](url)` | frontmatterLinks | maybe | property links |

Agreed: we include BOTH links and embeds (not links-only). Two things to settle:

1. THE ALIAS GATE collides with embeds. External image embeds are usually
   `![](https://…/pic.png)` with EMPTY alt — a strict alias gate would HIDE your
   main use case. We never fetch/render the remote resource (only a node), so we
   can always derive a label from the URL STRING with no network:
   alias/alt → URL last path segment ("filename") → host.
   Gate options:
   - G1 strict (your original): only refs with an explicit alias/alt. Hides no-alt
     embeds (most image embeds).
   - G2 label-precedence: render EVERY external ref, label falls back as above.
   - G3 hybrid (MY RECOMMENDATION): plain links require an alias (a bare labelless
     hyperlink is noise); embeds ALWAYS shown (alias→filename→host), because
     embedding IS the intent to surface it.
   >>> Q-D4a: G1, G2, or G3? (I recommend G3.)

2. Link vs embed visual distinction: tag each URL node with its kind and let the
   showcase differentiate (hyperlink glyph vs embedded-resource glyph).
   >>> Q-D4b: OK to tag kind + differentiate in the design? (I recommend yes.)

3. Reassurance: none of this fetches. Labels come from the URL string only.
   Obsidian ITSELF already fetches external image embeds when it renders the note;
   our graph node adds no fetch and never shows the remote image.

4. Source of truth: I recommend we PARSE the note body ourselves (repo already has
   `MarkdownInlineLinks.EXTERNAL_DESTINATION` and already owns canvas parsing)
   rather than trust Obsidian's cache to index external links (version-dependent,
   unverified). Frontmatter property URLs still come from `cache.frontmatterLinks`.
   >>> Q-D4c: include frontmatter property URLs too, or body-only for v1?

--- SETTLED (your replies) ---
D1: count toward cap, LOWEST truncation priority. ✓
D2: one node, first alias wins; PLUS ×N occurrence count on the edge + fly-out
    preview of where the central links it. ✓ (folded into engine + view tickets)
D3: window.open, KISS. ✓
D5: showcase ticket. ✓

**D5 — Node visual design.**
Handled by the showcase ticket `nid_hyzwoqadcfyvisveczuet3e8c_e`: ~10 variants,
you pick one. Nothing to decide yet — flagging where the look is chosen.
Yep showcase ticket.

## Ticket map

- `nid_hyzwoqadcfyvisveczuet3e8c_e` — Design showcase (10 variants, you pick) [blocks view]
- `nid_prsk9olcj9u2fpzqgv5gb6zhe_e` — Engine + adapter (alias-only data, headless, tested)
- `nid_ccsw8o1rjcs2l7o1elgmlqx5i_e` — View rendering (new node kind) [needs design + engine]
- `nid_uqgew1fuqgrdyvas6eum6vaf2_e` — Follow-up: Depth pill to toggle URL rendering
