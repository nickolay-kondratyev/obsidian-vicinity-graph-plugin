# EXPLORATION_PUBLIC — step-07-hardening (index)

Three focused exploration reports (read the one relevant to your phase):

| File | Covers |
|------|--------|
| `EXPLORATION_engine.md` | Engine pipeline, GraphTruncator, NodePriorityChain tiebreakers, NodeSizer, FakeLinkProvider, cap config, folder-grouping. Where dense-fixture + cap-edge tests should live. |
| `EXPLORATION_perf.md` | Image loading (no viewport culling; refetch-avoidance is emergent, untested), rebuild debounce (untested — needs window), structural-diff elk skip (well tested), orphan sweep chunking (built + wired, tested only at 25 files). No perf budgets exist yet. |
| `EXPLORATION_readme.md` | README gaps, product framing (2 weaknesses + V1 scope + V2 deferred verbatim), settings/pinning semantics, release-artifact issues (license, id prefix), full ticket triage. |

## Key facts for planning
- **Caps:** centrals are cap-exempt (added unconditionally); only non-centrals compete for `nodeCap` slots. Tiebreaker chain: minDepth↑, sizeScore↓, distanceToMain↑(present-first), pinTimestamp↓(present-first), docid(present-first), path. Determinism already asserted.
- **FakeLinkProvider** throws on undeclared link targets → dense generator must declare every path. Has `outgoingQueryCount(path)` test instrumentation.
- **Perf gaps:** no viewport culling (`onlyRenderVisibleElements` absent); rebuild debounce (500ms) untested; orphan sweep chunk-yield built (batch 20, setTimeout(0)) but tested only at 25 files vs "hundreds" target; no timing/budget assertions anywhere; no `test:heavy` script.
- **Fix-now candidate:** `_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md` (small CSS, primary click UX).
- **Release flags needing human sign-off:** KSAL-2.3 (source-available, non-OSS) license; `obsidian-` prefix in plugin id (changing later breaks users).
