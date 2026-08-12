---
closed_iso: 2026-08-12T19:07:50Z
session_ids: [{"a": "claude", "type": "execution", "id": "37a92392-758c-4a75-bad6-ec5e8dbc3425"}, {"a": "claude", "type": "decision", "id": "30a84a04-6274-4b60-911d-c7b5d17f0192"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_uykmq7xpow597qs6bpgrhanlt_e
title: "Distinct styling for frontmatter id-ref edges (backlog)"
status: closed
deps: [nid_phu0llxhfptse000j66ezrhh3_e]
links: []
created_iso: 2026-08-12T17:19:58Z
status_updated_iso: 2026-08-12T19:07:50Z
type: feature
priority: 4
assignee: nickolaykondratyev
tags: []
---

Backlog follow-up to the frontmatter-id links feature (plan: ticket nid_sjojyvd55emyry45qynphei7o_e). v1 deliberately renders id-ref edges as ordinary `kind: "link"` edges (KISS, human-approved 2026-08-12).

If/when distinct styling is wanted: introduce an id-ref provenance in the edge model (src/engine/types.ts EdgeKind = "link" | "embed" | "both", derived in src/engine/EdgeAssembly.ts from the provider's per-reference LinkKind in src/shared/LinkKind.ts) and give those edges a distinct visual (e.g. dashed) in the view layer, styled via Obsidian theme CSS variables. Requires deciding how a pair with BOTH a wikilink and an id-ref renders. Do not start without confirming the feature earned it.

---

## DECISION (2026-08-12, decision session): CLOSE — wontfix, feature not earned yet

**Decision 1 answer: No — distinct styling has not earned its keep. Close wontfix.**

Rationale:
- The plugin is **not published yet** (CLAUDE.md). There are zero real users, so
  there is zero evidence that id-ref edges rendering as ordinary link edges is
  confusing anyone. The ticket's own guard — "Do not start without confirming
  the feature earned it" — cannot be satisfied today, and nothing can change
  that until the feature sees real use.
- v1's KISS rendering (id-refs indistinguishable from wikilinks) was
  **human-approved 2026-08-12** — the same day. Implementing distinct styling
  now would reverse that approval on no new information.
- The combined link count is already truthful (`getLinkCount` adds id-ref
  occurrences), so no information is silently lost by the plain rendering.

Rejected options:
- **Implement now (Option A/B/C below):** speculative — adds an orthogonal
  provenance axis to the edge model, view CSS, and e2e coverage for a visual no
  user has asked for. Violates 80/20 and the ticket's own guard.
- **Leave open as backlog:** with the `decide` tag removed and the dependency
  (nid_phu0llxhfptse000j66ezrhh3_e) closed, an open ticket gets picked up and
  implemented by the unattended loop — same as "implement now". Keeping the tag
  just re-queues this decision forever. Closing is the only state that matches
  "not now".
- **Escalate to human:** the default here is clear (no users → no evidence →
  no feature), and the human already chose KISS for v1 today. Nothing to ask.

**Decision 2 pre-answered for any future revival: Option A — wikilink wins.**
Only *id-ref-ONLY* pairs get the distinct (dashed) style; any pair carrying a
syntactic wikilink renders normally. The distinct style then answers exactly one
question: "does this connection exist only because of a frontmatter id?"
Option B over-signals (a visibly wikilinked pair would look special); Option C
(third combined visual) is the most noise and hardest to theme legibly.

**If real use shows id-ref edges confuse people:** re-open (or re-file) with
Option A decided, and follow the implementation sketch below — it is current as
of 2026-08-12.

---

## Original escalation analysis (kept for the revival case)

### Background (current state, confirmed in code)

- **v1 is intentional.** `src/adapters/ObsidianLinkProvider.ts` maps every
  frontmatter id-ref to `{ target, kind: "link" }` (see `getOutgoingReferences`,
  ~line 143) — id-refs are visually indistinguishable from wikilinks by design,
  approved 2026-08-12. The incoming half rides the same channel
  (`getIncomingLinks`), and `getLinkCount` *adds* id-ref occurrences on top of
  the wikilink/canvas count, so a pair that is both wikilinked and id-referenced
  already badges a truthful combined total today.
- **The edge model has no id-ref axis.** `EdgeKind` in `src/engine/types.ts` is
  `"link" | "embed" | "both"` — the embed-vs-plain axis only. Id-ref provenance
  is not carried anywhere past the provider; `LinkKind` in `src/shared/LinkKind.ts`
  is `"link" | "embed"`, harvested by the two *syntax* matchers, and an id-ref is
  not a syntactic reference at all — it is resolved from frontmatter in the
  adapter. So provenance is orthogonal to the existing embed/plain axis, not a
  new value in it.

### Decision 1 — does the feature earn distinct styling at all?

The ticket says "Do not start without confirming the feature earned it." This is
a product judgment I cannot make: v1 deliberately chose KISS, and unless id-ref
edges have proven confusing in real use, the simplest correct answer is to leave
them looking like links and **close this ticket wontfix**. Please confirm you
actually want distinct styling before the work begins.

### Decision 2 — how does a pair with BOTH a wikilink and an id-ref render?

Only relevant if Decision 1 is "yes". Because provenance is a third, orthogonal
axis (a pair can be plain/embed AND wikilink/id-ref/both), the view needs a rule.
Options:

- **A. Wikilink wins.** A pair carrying any syntactic wikilink renders as a
  normal edge; only *id-ref-ONLY* pairs get the distinct (e.g. dashed) style.
  Cleanest signal — the distinct style means "this connection exists ONLY because
  of a frontmatter id, you won't see it in the note body." My recommendation.
- **B. Id-ref wins.** Any id-ref presence flips the style. Over-signals: a pair
  you can plainly see as a wikilink would still look "special".
- **C. A third combined visual** for mixed pairs. Most information, most visual
  noise, hardest to theme legibly. Not recommended.

Recommendation: **A** — model provenance as an id-ref-only marker (dashed edge
via an Obsidian theme CSS variable) so the distinct style answers exactly one
question ("body link or frontmatter-only?"). But this is a UX call; confirm
before implementation.

### Implementation sketch (once decided, for the next agent)

1. Carry provenance from `FrontmatterIdIndex` through the provider — likely a new
   flag on `OutgoingReference` / a new provider signal rather than overloading
   `LinkKind` (keep the embed/plain axis clean). Do NOT reuse the shared
   `LinkKind` union — id-refs are not syntactic.
2. Derive an id-ref marker onto `GraphEdge` in `EdgeAssembly.ts` per the rule
   chosen above (respect `showCrossLinks`, same as `kind`).
3. Style in the view layer via `src/view/*.css` + an Obsidian theme CSS variable;
   prefer CSS over JS. Add e2e coverage (rendered-edge styling is view-layer, so
   `npm run test:e2e` is required, not just `npm test`).

