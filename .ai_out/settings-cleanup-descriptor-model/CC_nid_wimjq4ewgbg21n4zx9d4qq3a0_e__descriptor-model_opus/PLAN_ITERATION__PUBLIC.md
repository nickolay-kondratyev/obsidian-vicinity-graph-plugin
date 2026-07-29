# PLAN ITERATION 1 — response to `DETAILED_PLAN_REVIEW__PUBLIC.md`

Role: PLANNER (fresh instance). Ticket 2, `nid_wimjq4ewgbg21n4zx9d4qq3a0_e`.
Target: `DETAILED_PLANNING__PUBLIC.md`, updated in place.

Standing rule: feedback is not accepted blindly. Each finding below is
INCORPORATED or REJECTED with reasoning. Where I changed a claim about compiler
behaviour I reproduced it first, with this repo's real toolchain — the same
standard the reviewer held me to.

**Headline:** the reviewer was right that F2 was wrong. He was also wrong about
*why*. His replacement argument does not survive contact with this repo's
TypeScript either, so I did not adopt it as-written — I found the arguments that
actually hold. The **decision is unchanged**; its justification is entirely new.

---

## Verification performed this round

| Probe | What it establishes | Result |
|---|---|---|
| `.tmp/f2probe/optA.ts` | Flat unified list + `Extract<…,{family:"view"}>["key"]` guard **and** `.filter().map()` → `readonly (keyof ViewSettings)[]` | **compiles, exit 0** — both reachable from Option A |
| `.tmp/f2probe/optA_neg.ts` | Negative control: a *wrong* filter predicate | **TS2322**: `Type '"outgoingDepth"' is not assignable to type 'keyof ViewSettings'` — narrowing is real, and mis-narrowing is loud |
| `npx tsc --version` | Inferred type predicates (TS ≥ 5.5) are available | **5.9.3** (`package.json`: `^5.8.3`) |
| `.tmp/f2probe/scan.mjs` | The generalised F4 tripwire against today's tree | 65 non-test view modules; offenders = **exactly** `["src/view/ForceLayoutSection.tsx"]`; all 3 allowlist entries live |
| `grep EngineDefaults.*Settings src/view` | F4 allowlist completeness + the test-exclusion hazard | 3 production callers; **14 test files** also call these — exclusion is load-bearing |
| `SettingsSpec.ts`, `architecture-map.md:7-27`, `ViewSettingsResolver.ts`, `TraversalSettingsResolver.ts` | Premises of the *new* D3 argument | all confirmed (see F2 below) |

All flags matched `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`,
`isolatedModules`, `noImplicitReturns`, `target ES2021`).

---

## F1 — `SettingsResetScope` circular reference — ALREADY FIXED INLINE, LEFT ALONE

**Status: INCORPORATED (by the reviewer, preserved by me).**

The reviewer's inline fix (`SettingsResetScope = SettingsSection | "all"`, with
the reproduced TS2456/TS7022 codes as a WHY-NOT comment) is correct and I did not
touch it. I extended the surrounding block only to add the m2 annotation.

---

## F2 — the D3 justification rests on a false premise — INCORPORATED, but **not** with the reviewer's replacement argument

**Status: INCORPORATED (finding), REJECTED (proposed remedy), replaced with a verified one.**

### The reviewer is right that my original objection was false

My "fatal objection" claimed a flat list cannot yield a `keyof ViewSettings`-keyed
compile guard. It can, via `Extract<(typeof LIST)[number], {family:"view"}>["key"]`.
I reproduced his counterexample. **Retracted, and recorded as retracted in §2.2
rather than quietly deleted** — the owner asked for a justification, so the
record of a wrong one matters.

### But his replacement argument is also false on this repo

He proposed resting the decision on the consumer side:

> Getting [a `readonly (keyof ViewSettings)[]`] out of a flat array requires
> either a hand-written type predicate … — which TypeScript does **not** verify
> and which therefore *can* lie — or an outright cast.

**Reproduced, and it does not hold.** TypeScript 5.5 shipped *inferred* type
predicates, and this repo is on **5.9.3**:

```ts
const viewKeys: readonly (keyof ViewSettings)[] = SETTINGS_FIELDS
	.filter((d) => d.family === "view")   // predicate INFERRED — no annotation, no cast
	.map((d) => d.key);                   // ⇒ keyof ViewSettings
```

Exit 0. And the lie he was worried about cannot happen silently — swapping in
`d.family !== "exclusion"` fails loudly with
`TS2322 … Type '"outgoingDepth"' is not assignable to type 'keyof ViewSettings'`.

Adopting his wording would have replaced one false premise with another. Per the
instruction — *"if the corrected argument does NOT sustain the decision, say so
and switch"* — I re-examined the decision from scratch rather than reaching for a
third rescue.

### Re-examination: does Option B still win? Yes — on two arguments that hold

**Objection 1 — the layering dilemma (decisive).** The completeness knowledge has
three consumers in three layers: engine (`SettingsSpec.ts`), persistence
(`persistedShapes.ts`), view (`settingsSectionFields.ts` / `settingsResetPlan.ts`).
A unified list is one module, so:

- **In `src/view/`** (forced, if it carries the `section` axis — a settings card
  is view knowledge): `src/persistence/` would import `src/view/`.
  `architecture-map.md:7-13` is `view → adapters → engine` with
  `persistence → engine`. `persistence → view` is an outward edge — **illegal**.
- **In `src/engine/`, dropping `section`**: the view still needs a separate
  section table (so nothing is unified), and the flat `{family,key}` list lands
  next to `SETTINGS_SPEC` — which I verified is **already** family-partitioned
  (`globalDepths: DepthSpec` / `globalView: ViewSpec` / `nodeExclusion:
  NodeExclusionSpec`) and already the single source of every default and bound.
  The list would replace nothing and need hand-syncing: **a new parallel list, in
  the ticket that exists to delete parallel lists.**

**Objection 2 — `cascade` would be data nothing reads and nothing checks.** D3's
Option A is specifically "unified list *with a declared cascade strategy*". I
read both resolvers: the cascades are **code** — `ViewSettingsResolver.resolve()`
(ranked-pinned chain, explicit 5-field literal return typed `ViewSettings`),
`TraversalSettingsResolver.resolveForRoot()` (2-field `??`), and
`NodeExclusionSettings` has **no resolver at all** (so "cascade: none" is the
absence of a class, not a third strategy instance). CLARIFICATION constraint 5
forbids replacing `resolve()`'s return-type guarantee with a runtime loop — so
nothing may consume `cascade`, and nothing would check that `cascade:
"own-global"` still matches `TraversalSettingsResolver`. An unread, unverified
string describing behaviour is exactly the silent-drift defect this ticket
removes.

**Objection 3 (supporting) — the payload differs per family.** `ViewSpec` fields
carry `MinBoundedNumberSpec` / `BoundedNumberSpec` / `DefaultSpec<T>` / nested
`SizingSpec` / `ForceLayoutSpec`. A unified row is a union narrowed at every
consumer, or a `{family,key}` husk. Option A's "ONE declaration" would be one
declaration of the *key*, not the field.

Both load-bearing objections are **compiler-version-independent** — which is the
point, given how this finding arose. Recorded as R15 in §8, including the
explicit note that pinning TS below 5.5 would not change the decision.

**Also fixed:** §4.3's proposed *code comment* repeated the false "runtime
predicate" claim. Left unchanged it would have shipped the error into the
codebase. Rewritten to the columns-vs-row-union rationale.

---

## F3 — "three per-family tables" describes something the plan does not build — INCORPORATED

**Status: INCORPORATED in full.** The reviewer is right, and his framing is
better than my original. §4 ships **one** family-keyed table
(`SECTION_SETTINGS_FIELDS`, columns `{view; depth; exclusion}`) plus two 3-arm
`Exclude<>` aliases. There is no third table anywhere.

Changes:
- **§0** — decision retitled: *"every key space stays keyed by its own `keyof` —
  never flattened into one heterogeneous `{family,key}` row union; tables are
  organised by CONSUMER (and therefore by layer); a table serving several
  families carries per-family key **columns**."*
- **§2.3** — retitled and rewritten to match, with the columns-vs-rows rationale
  (columns are directly consumable by `restoreFields<T>`; a row union is
  re-grouped at every consumer).
- **§2.5 — NEW: a full artifact inventory table** (artifact → layer → shape → §),
  explicitly stating that "per-family" describes *key spaces, not file count*,
  and that there is no third parse guard because `NodeExclusionSettings` has no
  override. This is the section chain tickets 4/5 should read for the shape they
  must extend — which was the reviewer's stated concern.

I also adopted his observation that the delivered design is the better one: §2.5
says outright that on the section axis the plan already *is* the unified
structure Option A reached for, with columns instead of a row union.

---

## F4 — the Step 1 tripwire's coverage is arbitrary — INCORPORATED, with one correction to the reviewer's spec

**Status: INCORPORATED, and extended.** Guarding one of five factories reads as
"the other four are fine". Generalised to `EngineDefaults.*Settings()` —
`depthSettings`, `sizingSettings`, `nodeExclusionSettings`, `viewSettings`,
`forceLayoutSettings` — with the reviewer's three-module allowlist, each entry
carrying a WHY. Verified: all three are the only legitimate production callers.

**Correction the reviewer did not flag, and it would have broken the guard:**
the scan must **exclude `*.test.ts` / `*.test.tsx`**. 14 view test files
legitimately call these factories to build fixtures —
`settingsResetPlan.test.ts` alone has 22 calls. Without the exclusion the guard
is red for entirely correct reasons and an implementer would have to neuter it.
(The *narrow* version would have hit 6 test files, so this hazard pre-existed the
generalisation; it is simply now unmissable.) §5 Step 1 states the exclusion and
marks it load-bearing.

Also added **test 3** — every allowlist entry must still read a defaults factory.
An exemption that outlives its call site is how source-scan guards rot, and the
allowlist just tripled in reach.

Simulation against today's tree is quoted in the plan: 65 modules scanned, one
offender (`ForceLayoutSection.tsx` — the RED), three live allowlist entries.

Test file renamed `forceLayoutDefaultsSingleSource.test.ts` →
`engineDefaultsSingleSource.test.ts` (§6 new-files list and A9 updated).

---

## Rulings folded in

### Q-A — DECLINE SUSTAINED — INCORPORATED

Recorded in §0 item 2, §7.2 (heading now says "reviewer ruling: DECLINE
SUSTAINED") and §10. **Follow-up captured**: `NODE_PREVIEW_ROW_LABEL` /
`NODE_PREVIEW_ROW_DESCRIPTION` (`nodePreviewPreferenceMeta.ts:16,23`) *are* row
copy for a `keyof ViewSettings` field — I read both and confirmed they are not
keyed by the enum — so they belong in ticket 4's row table, unlike
`NODE_PREVIEW_OPTION_META`. Pointer added to §7.2 and to Step 8's handoff.

### Q-B — KEEP the tripwire — INCORPORATED

Recorded in §5 Step 1 as a reviewer ruling with his evidence (no `*.test.tsx`, no
`@testing-library` / `jsdom` / `happy-dom`). The "optional — reviewer may strike
it" hedge is **removed**; it is now a committed part of the plan.

### Noted bonus — a new *section* now compile-forces a reset spec — INCORPORATED

Stated as a delivered guarantee, **A11**. Deriving `SettingsResetScope` from
`SETTINGS_SECTIONS` means the pre-existing
`Readonly<Record<SettingsResetScope, …>>` annotation on `SETTINGS_RESET_SCOPES`
now fails on a section with no reset entry. Previously a new *scope* was guarded;
a new *section* was not.

---

## Minor suggestions (m1–m6)

| # | Ruling | Note |
|---|---|---|
| m1 | **INCORPORATED** (reviewer, inline) | `import type { SizingSpec }` spelled out for `isolatedModules`. Left as applied. |
| m2 | **INCORPORATED** | `_assertEveryResetScopePlaced` is kept **but annotated** as tautological-by-construction, naming A11's `Record<SettingsResetScope, …>` annotation as what carries the guarantee now, and stating it goes live again if the two definitions decouple. The reviewer is right that a guard which silently cannot fail while reading as protection is a POLS violation — my predecessor's "removing a guard needs a better reason" instinct is satisfied by annotating rather than deleting. Added as **A12**. |
| m3 | **INCORPORATED** | Step 2's new test 3 dropped. Verified his citation: `settingsResetPlan.test.ts:241-246` already asserts no-confirmation for *every* non-exclusion section scope, `force-layout` included. A weaker restatement is test duplication. The existing test is quoted in Step 2 so nobody re-adds it. (Test numbering is unaffected — Step 1's new test 3 takes the vacated slot.) |
| m4 | **INCORPORATED** | WHY comment on the `SECTION_RESET_SCOPES` re-export, naming the debt explicitly and why it is taken (collapsing the duplicate names would mean editing the e2e harness and a behaviour-capturing test inside the refactor those very tests are proving). Follow-up ticket added to Step 8. |
| m5 | **INCORPORATED** | R1 now states both codes: **TS2741** for a new `ViewSettings` field (named `ParsedViewFields` annotation) vs **TS2345** for a new `DepthSettings` field (inline argument type at `parseDepthOverride`), with "do not read TS2345 as a misfire". |
| m6 | **INCORPORATED** (reviewer, inline) | `architecture-map.md` needs no edit. Left as applied. |

Nothing in m1–m6 was rejected.

---

## What I did NOT change, and why

- **The design.** Not one structural element moved. The reviewer verified it
  end-to-end against the real compiler and real suite (1129 assertions, zero test
  edits) and I was instructed not to redesign. Everything above is the *record*,
  one test's scope, and one test's file name.
- **`SETTINGS_RESET_SCOPES` stays un-narrowed** (no `as const`) — R2 stands;
  narrowing breaks `settingsResetPlan.test.ts:269`.
- **The `all` scope stays bespoke** — R10 stands.
- **`ViewSettingsResolver.ts` untouched** — CLARIFICATION constraint 5, and now
  also load-bearing for the new D3 Objection 2.
- **No production code touched this round.** `src/` and `e2e/` are unmodified;
  all probes live in `.tmp/` and are throwaway.

---

## Readiness

**READY FOR IMPLEMENTATION.**

The design was verified by PLAN_REVIEWER against the real toolchain and is
unchanged. The three findings were about the written record and one test's
scope; all three are closed, one of them by rejecting the reviewer's proposed
remedy in favour of a verified argument. Both rulings and the noted bonus are
folded in. All six minors are applied. No open questions, no
`#QUESTION_FOR_HUMAN:`.

IMPLEMENTATION should read `DETAILED_PLANNING__PUBLIC.md` + `CLARIFICATION__PUBLIC.md`
only; this file is the audit trail and is not needed to build.

The one instruction worth repeating to IMPLEMENTATION, because it is the plan's
own correctness proof: **§6's escalation rule — if you find yourself editing an
assertion in any pre-existing test file, stop.**
