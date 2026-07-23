# DOC_FIXER__PUBLIC — Global Node Exclusion

Resolves the IMPLEMENTATION_REVIEW SHOULD-FIX: "README.md / docs-internal/CHANGELOG.md
not updated for this user-facing feature." Docs-only; no `src/`, tests, or build
artifacts touched. Semantics stated match CLARIFICATION__PUBLIC.md exactly.

## Docs changed

### `README.md`
Added a **`### Node exclusion`** subsection under the existing "Settings model"
section (after "### Pinning"), matching the section's heading style/tone. Covers:
- global exclusion **pattern list** in the settings tab (no per-note override, like
  sizing/cap);
- the **toolbar pill** to enable/disable + the per-graph **excluded count** (shown
  only when enabled AND count > 0);
- **regex-lite** semantics — each line a JS regex, tested **unanchored** &
  **case-sensitively** against the full vault-relative path **incl. extension**
  (`rel/` matches anywhere; `^rel/` anchors to root); invalid patterns silently
  ignored;
- **roots exempt** (active + pinned centrals kept even if they match), excluded
  notes **pruned at the data layer** before rendering, and the documented
  reachable-only-through-excluded consequence.

No unrelated sections restructured.

### `docs-internal/CHANGELOG.md`
Prepended a dated `## 2026-07-23 — global-node-exclusion …` entry in the existing
format (date header + bullets): regex-lite matching + `PathExclusionMatcher`,
roots-exempt, count, the two settings-tab controls + toolbar pill, persistence
(`PluginData.nodeExclusion`, v1 additive), out-of-scope items, and the green gates.

### `docs-internal/plan/high-level-plan.md`
Added ONE succinct bullet under "Graph model and traversal" (stable knowledge):
global regex-lite exclusion prunes matching neighbors **at BFS discovery**, roots
exempt, reachable-only-through-excluded not discovered, count surfaced. Kept
non-volatile — no file lists or implementation detail.

## Not changed (with reason)
- **`docs-internal/architecture-map.md`** — maps directory→responsibility and
  layering rules. Node exclusion adds one pure engine module (`PathExclusionMatcher`)
  and thin pass-throughs; it introduces no new directory, seam, or layering rule, so
  a mention would be noise. Left untouched deliberately.
- **No `docs-internal/tickets/` entry** — feature is complete and shipped; the
  review's only follow-up candidates (per-doc override, regex-validation UI) are
  explicitly out of scope per CLARIFICATION, not tracked bugs. TOP_LEVEL_AGENT can
  file one if a follow-up is desired.

## Standards
Wiki links and `ap_XXX_E` identifiers preserved (none in the edited regions).
Language succinct; behavior described is within CLARIFICATION spec (no
overstatement — e.g. count described as "distinct vault paths", pill count gated on
enabled AND > 0). Not committed (TOP_LEVEL_AGENT owns git).
