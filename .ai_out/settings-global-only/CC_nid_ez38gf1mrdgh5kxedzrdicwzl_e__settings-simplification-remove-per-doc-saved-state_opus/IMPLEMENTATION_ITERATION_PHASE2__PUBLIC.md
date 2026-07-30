# ITERATION_PHASE_2 — owner copy decision + PHASE 2 review findings — RESULT

Ticket `nid_ez38gf1mrdgh5kxedzrdicwzl_e`. Three focused commits on the same branch:

| commit | scope |
|---|---|
| `4780cc4` | `feat(ux)`: both depth surfaces headed **"Depth (all notes)"** (owner answer + S2), e2e baseline/locators follow |
| `1e970d8` | `docs`: README / RELEASE_CHECKLIST / smoke-run gate follow the copy; S1 pointer fix; N1 rewrap |
| `05b2912` | `docs(tickets)`: smoke-run item 5 also eyeballs the longer summary at ~300px |

## Gates (observed, not assumed)

| gate | result | log |
|---|---|---|
| `npm test` | **exit 0** — 82 files / **1083** tests passed (unchanged count) | `.tmp/iter2-test.log` |
| `npm run check` | **exit 0** — both `src/` and `e2e/` projects | `.tmp/iter2-check.log` |
| `npm run test:e2e` | **NOT RUN — impossible here** (needs a real Obsidian; release gate). Every locator/expectation below was updated by reading the source it targets, but it is **unverified at runtime**. | — |

## 1. OWNER ANSWER — implemented (option A, "Depth (all notes)", no hint line)

Exactly what copy changed, and where:

| surface / site | before | after |
|---|---|---|
| `src/view/GraphToolbar.tsx:37` panel disclosure summary | `Depth` | `Depth (all notes)` (+ WHY comment: the words are load-bearing, not decoration) |
| `src/view/VicinityGraphSettingTab.ts:461` card heading (**S2**) | `Depth defaults` | `Depth (all notes)` (+ WHY comment) |
| same file, outgoing slider description | "…from a central note **by default**." | "…from **every central note**." |
| same file, incoming slider description | "…(backlinks) to expand **by default**." | "…(backlinks) to expand **from every central note**." |
| `e2e/settingsBaseline.ts` `SECTION_CARD_HEADINGS["depth-defaults"]` | `Depth defaults` | `Depth (all notes)` (+ note: the scope KEY stays `depth-defaults`) |
| `e2e/settingsBaseline.ts` `CONTROLS_PANEL_DISCLOSURES[0].summaryText` | `Depth` | `Depth (all notes)` — the anchored count+identity+order pin is **updated, not loosened**; `settingsUxVisual.e2e.ts` still builds `^<text>\d*$` regexes from it (the parens are escaped by the existing `replace`) |
| `e2e/settingsBaseline.ts` list doc comment | "the panel has no 'Performance' and no 'Depth defaults' card" | "no 'Performance' card … the depth section is deliberately named identically on both surfaces" (the old sentence became false once the two names converged) |
| `e2e/settingsResetReview.e2e.ts:56,58` | `resetButton("Depth defaults")` (card locator is heading-based) | `resetButton("Depth (all notes)")` |
| `e2e/settingsUxVisual.e2e.ts:117` comment example | `"Depth" → "Depth & scope"` | `"Depth (all notes)" → "Depth & scope"` |
| `README.md` §Settings model Depth bullet | `**Depth** —` | `**Depth (all notes)** —` + "under the same heading … which is what the heading says out loud on both surfaces" |
| `docs-internal/RELEASE_CHECKLIST.md` §7 UX-shift line | — | appended: both surfaces are headed "Depth (all notes)"; the card used to read "Depth defaults", which implied a per-note override |
| `docs-internal/tickets/ticket-step-06-controls-human-smoke-run.md` items 4, 5, 7 | — | item 4 states the owner-chosen heading and narrows the human question to "is the heading enough, or is a hint line still wanted"; item 5 adds "check 'Depth (all notes)' does not wrap awkwardly beside its chevron"; item 7 "global depth defaults" → "the global depth pair" |

**S2 accepted, not rejected** — the tab card is now consistent with the owner's wording, which is what the owner asked for. No third phrasing was invented; no hint line was added.

### What was deliberately NOT renamed (and why)

- **Reset copy stays `"Restore depth defaults"`** (`settingsResetPlan.ts:130`) and the tab-wide
  description keeps its "depth defaults, node sizing, …" enumeration (`:73`). In a *restore*
  affordance "defaults" means **shipped defaults**, which still exist, and all five siblings use the
  identical `Restore <thing> defaults` shape — renaming only this one would break the pattern to fix
  a non-problem. It also keeps `e2e/settingsBaseline.test.ts`'s literal second opinion and
  `settingsResetPlan.test.ts:292`'s enumeration assertion untouched. The section reset description
  already said the honest thing ("used for every central note").
- **`CONTROLS_PANEL_DISCLOSURES[0].summaryAlsoMatchesAnAncestor` left `true`.** The longer text is
  strictly more specific, so `.first()` is probably now unnecessary — but that flag only *relaxes*
  strict mode, flipping it can only turn a passing spec red, and I cannot run the e2e here. Out of
  scope; noted for whoever next runs `test:e2e`.
- Internal identifiers (`SettingsSection` key `depth-defaults`, `SETTINGS_RESET_SCOPES` key,
  `SettingsSpec` comment "Depth defaults mirror Obsidian's…") — not user-facing, no drift created.

## 2. Review findings — disposition

| # | finding | disposition |
|---|---|---|
| **S1** | `ticket-controls-optimistic-input-latency.md:10` named the deleted `CentralDepthControls.tsx` | **FIXED.** Now `(`src/view/DepthStepper.tsx`, rendered by `src/view/GlobalDepthControls.tsx`)`, plus one sentence: since this ticket it is the ONE global pair, the deleted per-central file is called out as deleted, substance unchanged (still bounded by `MAX_STEPPER_DEPTH = 5`). |
| **S2** | tab card "Depth defaults" misleading | **FIXED** — see the table above. |
| **N1** | `README.md:80-82` sizing bullet lost its wrapping | **FIXED** — rewrapped to the file's ~80 col; text unchanged. |
| **N2** | sequencing: the owner shouldn't be asked the same thing twice | **ADDRESSED, differently than proposed.** The `#QUESTION_FOR_HUMAN` is answered, so there is nothing left to re-sequence. Instead the *gate* now carries the residue: smoke-run item 4 records the chosen heading and asks only the remaining question (heading sufficient vs. hint line). No new escalation. |

## 3. Ticket bookkeeping for TOP_LEVEL_AGENT — **unchanged from `IMPLEMENTATION_PHASE2__PUBLIC.md` §"Ticket bookkeeping"**

Carry that list forward verbatim (3 verdicts + 1 annotation; the reviewer independently sanity-checked
all four and agreed). **One change to flag:** its item 4 concerns
`ticket-step-06-controls-human-smoke-run.md`, which I edited again in this iteration (items 4/5/7 —
still OPEN as a release gate, still not to be closed). And a **new** in-place edit lands on
`ticket-controls-optimistic-input-latency.md` (S1) — that ticket also **stays OPEN**; it is queued
behind pipeline step 3 and is not part of this ticket's scope.

Nothing was closed here and **no `change_log` entry was written** — both remain TOP_LEVEL_AGENT's.

## 4. Callouts

- **`npm run test:e2e` remains the outstanding risk**, now slightly larger than at PHASE 2 review:
  four e2e sites move with this copy change (`settingsBaseline.ts` ×2 + comment,
  `settingsResetReview.e2e.ts`, `settingsUxVisual.e2e.ts` comment). All are string/locator edits
  verified against the exact `src/` lines they target; none is behavioural.
- `styles.css` / `main.js` untouched (no CSS change this iteration).
- The three-places-in-sync callout is now four: `README.md` §Settings model, `RELEASE_CHECKLIST` §7,
  smoke-run item 4, and the two source labels themselves. All four say "Depth (all notes)" today.
