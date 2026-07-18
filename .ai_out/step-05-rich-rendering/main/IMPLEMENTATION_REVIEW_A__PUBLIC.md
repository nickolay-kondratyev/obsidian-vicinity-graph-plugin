# IMPLEMENTATION_REVIEW_A__PUBLIC — step-05 Phase A (data model & pure logic)

Reviewer: IMPLEMENTATION_REVIEWER_A, 2026-07-18. Reviewed diff `684a90c..HEAD` (src/ only), commits `a4ab397..3c3bdac`, against CLARIFICATION__PUBLIC.md (binding), the updated step-05 spec, and the exploration maps. Gates re-run independently.

## Verdict: **READY** — 0 BLOCKER, 0 MAJOR, 3 MINOR, 2 NIT

## Gates (independently verified, logs in `.tmp/review-npm-*.log`)
- `npm test`: 422 passed / 39 files (main) + 69 passed / 6 files (sublib) — exit 0. Matches implementer's claim.
- `npm run check` (tsc): exit 0.
- `npm run build`: exit 0.

## Checklist verification (against code, not claims)

| # | Item | Result |
|---|------|--------|
| 1 | Edge counts REAL in both modes | **PASS.** `EdgeVisibility.edgesFor` attaches `count` from `LinkProvider.getLinkCount` for BOTH `walked-from-center` and `all-edges` (src/engine/EdgeVisibility.ts:38-46). Real adapter reads Obsidian's own `resolvedLinks[source][target]` count; canvas-fallback counts raw parsed occurrences (src/adapters/ObsidianLinkProvider.ts:95-109) from the same raw list the outgoing-link branch uses — no per-file source mixing. The `Math.max(1, …)` floor fires only for a walked pair the cache momentarily answers 0 for; documented and unit-tested — not fabrication. Multiplicity is verified end-to-end via `NeighborhoodEngine.build` in both modes (NeighborhoodEngine.test.ts). `FakeLinkProvider` dedups link lists to real-adapter parity and answers counts from raw fixture lists, with parity tests. Nowhere is multiplicity silently lost. |
| 2 | Frontmatter title | **PASS.** `title` > `name`, markdown-only, non-string and blank values skipped with fall-through (ObsidianLinkProvider.ts:131-146); 8 adapter tests incl. number/blank/canvas cases. Engine stays pure: consumes `metadata.frontmatterTitle ?? basename` (NeighborhoodTraversal.ts:135); import-guard test still covers engine+shared and passes. `FakeFileSpec.frontmatterTitle` fixture added. See MINOR-1. |
| 3 | View plumbing | **PASS.** `FlowSnapshot` widened with `groupByFolder` + `orphanTruncation`; tier discriminant exact (`main`, `pinned-central` = isCentral && !isMain, `regular` — all three tested); per-group `hiddenCount` + orphan aggregate with sorted per-folder breakdown and an exactly-once conservation test (truncationBadges.test.ts). groupByFolder=false → flat graph, no group nodes, all hidden counts to the corner overlay. |
| 4 | Pure transforms | **PASS.** 2+ rule + vault-root-never-groups tested; elk compound verified against REAL elk (container wraps members, absolute positions incl. container, members don't overlap — ElkLayout.test.ts) plus JSON-shape tests proving intra-group edges sit on the container and cross-boundary edges on the root (elk closest-common-ancestor rule); `INCLUDE_CHILDREN` was pre-wired in constants. `withPositions` converts group children to parent-relative, groups stay absolute — both tested. `hasOpposite` pair data tested both ways. Icon strip: per-extension counts, first-seen order, case-folding tested. Breadcrumb only on ungrouped non-root nodes, folder NAME only — tested incl. nested folder. |
| 5 | No scope creep | **PASS.** Grepped: zero color/palette/hash code. No CSS/component styling work, no Obsidian Menu/port/interaction work, no Playwright. CHANGELOG.md untouched. Non-src changes are .ai_out + the spec doc only. |
| 6 | Step-04 behavior preserved | **PASS.** `RebuildDecision`, `viewPorts`, `NeighborhoodGraphView`, `main.ts` untouched. Only 2 pre-existing assertions changed, both shape-widening (EdgeVisibility dedup test now also asserts `count: 2`; flowMapping data-shape gains the tier payload) — no behavior test removed/weakened. groupByFolder flip now forces relayout (new test) — correct, since preserved positions would lack group entries. Reuse-layout path is sound by construction: reuse requires an identical node-id set and no flip, and grouping is a pure deterministic function of exactly those inputs, so stored positions/group dimensions always cover the group ids; fresh `flow` is still mapped every publish, so node/edge DATA (incl. edge counts) refreshes without relayout. Live view path: RF `type:"group"` nodes emitted parent-first, `openNode` ignores `folder-group:` ids (tested) — no crash vector found. |
| 7 | Quality | **PASS.** Hexagonal boundaries intact (new view modules import engine types + shared only; elkjs is `import type`; RF confined to NeighborhoodGraphFlow.tsx). Branded types used (`FolderPath`, `VaultPath`). Constants named (`MIN_GROUP_MEMBER_COUNT`, `UNSIZED_GROUP_PX`, `MIN_EMITTED_EDGE_LINK_COUNT`, `DEFAULT_EDGE_LINK_COUNT`). BDD GIVEN/WHEN/THEN throughout, ~1 assert/test, no silent fallbacks or fake passes found. `DirectedLink` vs `GraphEdge` split is a clean compile-time enforcement of "only output edges carry counts" — good DIP/SRP call. |
| 8 | Gates | **PASS** (see above). |

## Findings

### MINOR-1 — Frontmatter title returned untrimmed
`src/adapters/ObsidianLinkProvider.ts:141-143`: the blank-check uses `value.trim() !== ""` but returns the raw `value`. A quoted YAML title like `title: "  My Note  "` renders with stray whitespace (and would survive into Phase B's breadcrumb concatenation). Direction: `return value.trim();` + one test asserting the trimmed result.

### MINOR-2 — Dual `deriveFolderGroups` derivation is an implicit cross-module contract
`src/view/elkMapping.ts:493` and `src/view/flowMapping.ts:995` each independently derive grouping from the same graph. Correctness currently rests on the function being pure/deterministic — true today, but nothing states that elk layout and flow mapping MUST agree on membership (a future non-determinism, e.g. sorting groups in one call site, would silently desynchronize parentIds from layout). Direction: cheapest fix is a WHY comment on `deriveFolderGroups` naming both consumers and the agreement requirement; alternatively derive once in the controller and pass `FolderGroupingResult` into both mappings. Not worth a signature change on its own — comment suffices.

### MINOR-3 — Dev-vault has no step-05 fixtures for the eventual human smoke run
Nothing in the dev-vault exercises frontmatter titles, duplicate links (count badge), a 2+ folder group next to a singleton, or a truncated folder. Phase A doesn't need them, but the Phase B human smoke run (step-04 pattern) will. Direction: extend the dev-vault wire-up fixtures in Phase B/C alongside the components.

### NIT-1 — Extension-less attachments group under `extension: ""`
`src/view/attachmentIconStrip.ts` — documented in the interface, but Phase B must render a label for the `""` group. Flagging so it lands on Phase B's plate rather than being discovered in QA.

### NIT-2 — `AttachmentIconGroup.count` duplicates `paths.length`
Harmless denormalization in a payload; fine to keep for renderer ergonomics.

## Reviewed-and-endorsed interpretation (no human question needed)
Q4's corner overlay is implemented as a **superset**: every hidden count whose folder has no rendered group (fully-truncated folders, singleton folders with hidden members, vault root) flows into the overlay. Q4's literal buckets leave singleton-with-hidden folders unassigned, and "nothing silently disappears" forces exactly this reading; it is documented as decision #4 in IMPLEMENTATION_A__PUBLIC.md. The exactly-once conservation test locks it in.

## Signal: **READY**
No blockers, no majors. MINOR-1/MINOR-2 are small enough to fold into Phase B's first commit; MINOR-3 and NIT-1 are Phase B/C obligations.

(No `#QUESTION_FOR_HUMAN` items.)
