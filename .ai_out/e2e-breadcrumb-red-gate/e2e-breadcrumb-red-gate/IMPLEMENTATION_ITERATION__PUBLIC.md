# IMPLEMENTATION_ITERATION — PUBLIC (iteration 1)

Feature `e2e-breadcrumb-red-gate`. Branch `e2e-breadcrumb-red-gate`, commit `1635709`
on top of `b9fb631`. **All four gates green; the working tree is clean.**

## Disposition table

| Item | Disposition | Rationale |
|---|---|---|
| **B1** — guard still vacuous + untrue JSDoc | **ACCEPTED — fixed** | The reviewer is right on both counts, and I verified the vacuity *empirically*, not just by reading (see proof below). Guard moved into the note1 section; JSDoc rewritten to state exactly what it covers. |
| **S1** — stale coverage claim `step-05-rich-rendering.md:45` | **ACCEPTED — fixed** | Same class of defect as the two bullets already marked SUPERSEDED in that file; leaving the third half-corrects a doc that had already misled two exploration passes. |
| **S2** — open ticket `ticket-folder-color-ux-design-pass.md:8` rests on a false premise | **ACCEPTED — fixed** | It is an *open design* ticket, not historical record. Added a dated UPDATE block instead of rewriting the original text, matching the strikethrough/SUPERSEDED convention already used in this repo. |
| **S3** — UX gap flagged only in `.ai_out/` | **ACCEPTED — ticket filed** | `.ai_out/` evaporates on merge; CLAUDE.md requires an in-repo ticket with `[decide]`. Filed with the four options and the acceptance criteria a human needs. |
| **S4** — `npm test` cannot go red on a feature removal | **ACCEPTED — ticket filed, not fixed here** | Genuine systemic finding and the actual root cause of the 3-day-red gate, but out of scope for a test-correction branch — implementing and mutation-verifying a tripwire is its own unit of work. Ticket carries the reviewer's 80/20 design *and* its known limits, so whoever picks it up cannot overclaim. |
| **N1** — `.ai_out` PUBLIC overclaims the plan-doc evidence | **ACCEPTED — corrected in place** | One-line correction in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`; the accurate claim ("`998fdac` *deleted* the sentence") is strictly stronger. |
| **N2** — once moved, `:177` duplicates `:188` (delete one) | **REJECTED — kept both, with reasons** | They fail for *independent* reasons and neither subsumes the other. `:188` (`toHaveText(GAMMA_TRIMMED_TITLE)`) only catches a returning breadcrumb because the pre-`998fdac` span was nested **inside** `.vicinity-graph-node__title` (verified: `git show 998fdac^:src/view/NoteNode.tsx` lines 87-92). A revival that renders the prefix as a sibling of the title — a perfectly plausible shape — would leave `:188` green and only `:177` red. The class guard is the one that names the property being protected; deleting it would make the surviving coverage accidental. Cost of keeping it: ~1 ms. |

**Deliberate non-change: `src/` is untouched.** Nothing in this iteration re-adds behaviour.

## What changed

| File | Change |
|---|---|
| `e2e/vicinityGraph.e2e.ts` | Guard `no node renders a folder-prefix breadcrumb` moved from the alpha section (was `:96`) into the note1 section (now `:177`, immediately before the gamma title test). JSDoc rewritten: drops the false "vault-wide" claim, names `solo/gamma.md` as the node that carries the property, explains why the alpha vicinity cannot serve, and records the mutation verification. |
| `docs-internal/plan/steps/step-05-rich-rendering.md` | S1 — `title/breadcrumb derivation` → `title derivation (~~breadcrumb derivation~~ — SUPERSEDED 2026-07-23 by 998fdac, which deleted breadcrumbFolderOf together with its tests)`. |
| `docs-internal/tickets/ticket-folder-color-ux-design-pass.md` | S2 — dated UPDATE noting the premise is dead, pointing at the new `[decide]` ticket. |
| `_tickets/…` | Two new tickets (below) + symmetric links onto the closed gate ticket `nid_yccejkvl0ccqc77olsgg5deka_e`. |
| `.ai_out/…/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` | N1 correction + rehydration notes in the PRIVATE file. |

## Proof that B1's guard is now non-vacuous

**Reasoning.** The deleted derivation (`998fdac^:src/view/graphIdentity.ts:49-54`) returned
`undefined` iff the node was grouped or at the vault root. The note1 vicinity (11 nodes)
contains `solo/gamma.md`: `solo/` contributes exactly one node, so it renders **ungrouped**
(asserted independently at `:191` — only `projects` and `crowd` render as groups), and its
folder is non-root. That is precisely the surviving `!isGrouped && folder !== root` case, so
gamma is a node that *would* carry a `solo/` prefix if the removed code returned.

**Empirical mutation (the part I did not want to take on trust).** I temporarily re-introduced
the breadcrumb faithfully — `breadcrumbFolder` threaded through `flowMapping.ts` under exactly
the deleted condition (`groupFolder === undefined && node.folder !== ""`) and rendered as
`<span className="vicinity-graph-node__breadcrumb">` in `NoteNode.tsx` — and ran the suite.
Verbatim, `.tmp/mutation-e2e2.log`:

```
  ✘  13 e2e/vicinityGraph.e2e.ts:172:1 › no node renders a folder-prefix breadcrumb (15.0s)
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('.vicinity-graph-node__breadcrumb')
    Expected: 0
    Received: 1
  1 failed
  12 passed (17.3s)
```

Two things this establishes at once: **(a)** the guard goes red on a faithful regression
(`Received: 1` — gamma), and **(b)** all 12 preceding tests, i.e. the entire alpha section
where the guard previously lived, stayed **green** under that same mutation — so the old
placement demonstrably could not have caught it. The reviewer's B1 diagnosis is confirmed by
experiment, not just by reading the deleted code. The mutation was then reverted
(`git checkout -- src/view/NoteNode.tsx src/view/flowMapping.ts`); `src/` is byte-identical
to `b9fb631`.

*(An earlier, cruder mutation that prefixed every non-root node — including grouped ones —
was discarded: it broke the alpha title assertion first and, being serial, aborted the file
before reaching the guard. It also did not match the removed semantics. Only the faithful
mutation above is cited.)*

## Tickets filed

| ID | Title | Where |
|---|---|---|
| `nid_rdx8ea6w1km9eywyvhpx1v7rt_e` | `[decide] ungrouped non-root notes show no folder identity since the breadcrumb removal` | `_tickets/decide-ungrouped-non-root-notes-show-no-folder-identity-since-the-breadcrumb-removal.md` |
| `nid_c5acy7gm7lj3afz0vtq79k8bx_e` | `feature removals cannot go red on the fast gate: e2e-asserted selectors are unverified by npm test` | `_tickets/feature-removals-cannot-go-red-on-the-fast-gate-e2e-asserted-selectors-are-unverified-by-npm-test.md` |

Both linked to the closed root ticket `nid_yccejkvl0ccqc77olsgg5deka_e`.

**Callout — two ticket systems coexist in this repo.** The `ticket` CLI writes to `_tickets/`
(where this feature's own ticket lives), while CLAUDE.md points at `docs-internal/tickets/` for
"active follow-ups". The instruction asked for the CLI *and* for `docs-internal/tickets/`. I
filed via the CLI (single home, tracked in git, visible to `ticket ls`/`ready`) and
cross-referenced from `docs-internal/tickets/ticket-folder-color-ux-design-pass.md` rather than
duplicating the content into a second file — duplicated tickets rot apart. **Which of the two
directories is authoritative is a human call worth making**; I did not file a third ticket about
the tickets.

## Gate results — verbatim final lines + exit codes

`npm test` → **exit 0** (`.tmp/iter-test.log`)
```
 Test Files  74 passed (74)
      Tests  990 passed (990)
```

`npm run check` → **exit 0** (`.tmp/iter-check.log`; tsc strict for `src/` then `e2e/`, no output)

`npm run build` → **exit 0** (`.tmp/iter-build.log`)
```
copied plugin artifacts to .dev-vault/.obsidian/plugins/vicinity-graph
```

`npm run test:e2e` → **exit 0** (`.tmp/iter-e2e.log`)
```
  ✓  72 e2e/vicinityGraph.e2e.ts:177:1 › no node renders a folder-prefix breadcrumb (1ms)
  ✓  73 e2e/vicinityGraph.e2e.ts:188:1 › singleton-folder note shows its trimmed frontmatter title (2ms)

  1 skipped
  78 passed (54.0s)
```

**"Did not run" audit: 0** (`grep -c "did not run"` → `0`). No `✘` lines. The single skip is
the env-gated `e2e/externalVault.e2e.ts:53` (`VICINITY_E2E_VAULT` unset by design), verbatim:
```
  -   9 e2e/externalVault.e2e.ts:53:1 › WHEN VICINITY_E2E_VAULT points at a vault THEN its graph renders and is screenshotted
```
`git status` after `build` shows no `main.js`/`styles.css` drift.

## Readiness

**Ready to ship.** B1 is fixed and its fix is proven by mutation rather than asserted; S1–S4
are addressed (two fixes, two tickets); N1 corrected; N2 rejected with a concrete failure mode
the reviewer's suggestion would have opened. No `src/` behaviour changed on this branch.
