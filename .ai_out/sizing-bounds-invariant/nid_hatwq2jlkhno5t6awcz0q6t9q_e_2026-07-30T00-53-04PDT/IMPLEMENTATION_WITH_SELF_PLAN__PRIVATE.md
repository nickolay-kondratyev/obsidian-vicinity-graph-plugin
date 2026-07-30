# PRIVATE memory — nid_hatwq2jlkhno5t6awcz0q6t9q_e (sizing bounds invariant)

STATUS: **DONE, iteration 2 (review response) complete**. 5 commits on
`nid_hatwq2jlkhno5t6awcz0q6t9q_e_2026-07-30T00-53-04PDT`, tree clean,
`npm run check` exit 0 / `npm test` 95 files 1271 tests green. Ticket NOT closed and NO
change_log entry — both are the top-level agent's job.

Commits: `f3b008e` engine, `5f20f9f` view, `8d0bd6c` docs (iter 1);
`7192074` review fixes, `2141741` doc limits (iter 2).

## Iteration 2: all three SHOULD-FIX items accepted, none rejected
1. Dead seeded refusal → `useState<string|undefined>(undefined)`; comment now says WHY
   there can be no refusal at mount (`clampSizingSettings` raises at every door).
2. Null commit left the field blank → `NumberRowCommit` is now a CLASS with factories
   (`writing`/`refusing`/`nothing`) and a derived `reseedsFromStore` getter; `NumberField`
   keeps a `reseeds` counter on the `<input>`'s `key`. Verified RED (stub the getter to
   `false` → 3 tests fail).
3. Snapshot judge → `ControlsActionsPort.storedGlobalView()` → `ControlsActions` →
   `SettingsWritePipeline.storedGlobalView()` (it already owns the store). `SizingNumberRow`
   uses it. CLAUDE.md's "read FRESH, never a rendered snapshot" decided this one.
   NIT rejected: CSS block-naming rename (cosmetic; e2e selects through those classes).

## Design decisions a clone must not re-derive
- `SizingRowVerdict` is a UNION now: `rejected: true` ⇒ `message: string`. That is what
  lets `NumberRowCommit.refusing(verdict.message)` exist with no runtime fallback.
- Reseed is NOT done by mutating `event.target.value`; it is a remount via `key`, matching
  the `key={shown}` idiom one level up. A REFUSED commit must NOT reseed.
- The panel judges cross-field against the STORE (fresh), not the optimistic layer and not
  the snapshot. Optimistic-sibling reading was considered and dropped: it would mean
  lifting both bounds' optimistic state into a shared parent.
- Panel shows ONLY refusals, never the tab's "Stored as N" clamp notice: the field always
  ends up showing the STORED number (store echo after a write, reseed after a non-write).
- `settlesAt` stays per-field; cross-field lives in `SizingRowWrite` (UI) +
  `clampSizingSettings` (backstop).
- `interactionIfAccepted` is for the tab's DEBOUNCED path only; the panel commits
  synchronously through `request(value)`.

## Traps hit (would bite again)
- **NEVER run prettier here.** No config, no dep, repo uses TABS; it reflows code and
  breaks the `settingsRowParity` source scan.
- Two spec-walking tripwires fire on ANY cross-field rule:
  `settingsSpecPersistence.test.ts` ("garbage in X keeps siblings") — handled by the
  declared `CROSS_FIELD_REPAIRS` list; `settingsRowAccessors.test.ts` `distinctInBounds`
  now probes at the range CEILING (`minPx`/`maxPx` share `NODE_SIZE_PX_BOUNDS`).
- `toEqual({value, refusal})` against a class instance passes (prototype getters are not
  own props) — that stale test was rewritten into focused asserts rather than relied on.

## Repo landmarks
- `ACCESSOR_OWNED_SYMBOLS` scan (`settingsRowParity.test.ts`) forbids row-rendering
  modules naming `SIZING_RANGES` / `clampSizingNumber` / `parseSizingInput`, and any row
  LABEL literal.
- Nothing under `npm test` renders React — extract logic to a pure module instead.
- `ControlsActionsPort` has exactly one implementer (`ControlsActions`); no fakes to
  update when the port grows.
