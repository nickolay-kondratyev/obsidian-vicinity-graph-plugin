# Decision needed: node sizing rethink (`nid_kyowb4v8v51nslbicl4szgcd5_e`)

Background: today `sizePx` comes from metric dials (default: own-file-size),
and centrals/pinned bypass metrics entirely → always maxPx, even when empty.
Full discussion: `docs-internal/plan/node-sizing-rethink.md`.

Per-node overrides (size + content) would be stored globally by docid in
`data.json`, exactly like pins (lazy `ensureDocId`, same refusal rules).

## Q1 — What should the DEFAULT size be driven by?

Your ticket says "combine node content and the node sizing dials". Two readings:

- **(a) Keep metric dials, add/retune content metrics** — smallest change;
  size still relevance-shaped, dials keep meaning.
- **(b) Size-to-fit the rendered content** (outline line count / thumbnail),
  clamped by the min/max dials — "the node is as big as what it shows";
  naturally fixes empty-central-huge; dials become clamps, not drivers.

**Recommendation: (b)** — it matches the "avoid" bullets most directly and is
the more intuitive UX ("Do Not Make Me Think": node size explains itself).

## Q2 — Central/pinned sizing

Proposal: centrals/pinned stop bypassing metrics; they get the normal computed
size FLOORED at a modest prominence constant (~0.35 score), with centrality
signaled by styling (border) rather than forced maximum size. OK?

## Q3 — May a manual per-node resize exceed global maxPx / undercut minPx?

**Recommendation: yes** — a hand-set size is the most explicit intent
(bounded only by hard sanity bounds). Alternative: clamp to the dials.

## Q4 — Truncation

Manual resize changes pixels only, NEVER the relevance score that ranks
truncation (same rule the thumbnail floor already follows). Confirm.

## Q5 — Frontmatter id assignment

Saving an override for an id-less note silently writes a frontmatter id —
identical to pinning today. OK, or do you want a confirmation prompt on the
first override save?

---
Reply with e.g. "Q1: b, Q2: yes, Q3: yes, Q4: yes, Q5: silent" (or push back).
Answers go into the `decide` ticket `decide-node-sizing-rethink-q1-q5`, which
blocks the four implementation tickets.
