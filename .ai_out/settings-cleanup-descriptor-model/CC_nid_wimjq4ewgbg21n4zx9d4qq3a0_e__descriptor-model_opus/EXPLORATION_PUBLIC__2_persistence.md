# EXPLORATION — Area 2: Persistence + adapters

Scope: `src/persistence/*`, `src/adapters/*`. Read-only exploration for ticket
`nid_wimjq4ewgbg21n4zx9d4qq3a0_e` (settings-cleanup descriptor model). See
`docs-internal/notes/settings.md` for chain context and
`docs-internal/architecture-map.md` for layering.

---

## 1. Parse table anatomy

All parsing lives in one file: `src/persistence/persistedShapes.ts`.

### `parseViewOverride` — THE known silent hole (L135-158)

```
function parseViewOverride(raw: unknown): ViewSettingsOverride {
    if (!isRecord(raw)) return {};
    const nodePreviewPreference = raw["nodePreviewPreference"];
    const outlineMaxDepth = numberOrUndefined(raw["outlineMaxDepth"]);
    return {
        ...definedOnly("nodeCap", numberOrUndefined(raw["nodeCap"])),
        ...definedOnly("outlineMaxDepth", outlineMaxDepth === undefined ? undefined : clampOutlineMaxDepth(outlineMaxDepth)),
        ...definedOnly("nodePreviewPreference", NODE_PREVIEW_PREFERENCES.find(p => p === nodePreviewPreference)),
        ...definedOnly("sizing", parseSizing(raw["sizing"])),
        ...definedOnly("forceLayout", parseForceLayout(raw["forceLayout"])),
    };
}
```

Per-branch behavior by type kind, and how "absent" is distinguished from
"present but invalid":

| Field | Kind | Absent-key behavior | Invalid-value behavior | Helper |
|---|---|---|---|---|
| `nodeCap` | plain number | key omitted from output (`definedOnly` short-circuits) | same as absent — `numberOrUndefined` returns `undefined` for non-finite/non-number, `definedOnly` then omits the key | `numberOrUndefined` (L269-271) |
| `outlineMaxDepth` | bounded number | omitted | a present-but-non-number value → `numberOrUndefined` → `undefined` → omitted; a present-and-numeric-but-out-of-range value is **not** dropped, it is **clamped** via `clampOutlineMaxDepth` (engine `constants.ts:43`) so `0` cannot reach the engine as a silent off-switch | `numberOrUndefined` + `clampOutlineMaxDepth` |
| `nodePreviewPreference` | closed enum (union of 3 string literals) | omitted | non-member string, wrong type, or a value from a REMOVED preference all fall through `Array.prototype.find` returning `undefined` → omitted (test: persistedShapes.test.ts:53-58, 60-65) | `NODE_PREVIEW_PREFERENCES.find(...)`, the array declared once in `engine/types.ts:164-168` with a compile-time completeness guard (`_assertEveryNodePreviewPreferenceListed`, types.ts:176-177) |
| `sizing` | atomic composite (whole object pins/inherits together, per `types.ts:242` doc on the analogous `forceLayout`) | non-object raw → `undefined` → omitted (inherit) | a partially-mangled object is **repaired field-by-field from `EngineDefaults.viewSettings().sizing`**, then the WHOLE repaired object is clamped and returned — never partially omitted | `parseSizing` (L170-186), `parseMetricSetting` (L216-222), `clampSizingSettings` (engine `constants.ts:192`) |
| `forceLayout` | atomic composite | non-object raw → `undefined` → omitted | same repair-then-clamp pattern as `sizing`, per-field `?? defaults.field` then one `clampForceLayoutSettings` call | `parseForceLayout` (L196-214), `clampForceLayoutSettings` (engine `constants.ts:156`) |

**The hole, precisely:** the return object literal's properties (L142-156) are
manually enumerated. `ViewSettingsOverride` is `Partial<ViewSettings>`
(`engine/types.ts:305`), so TypeScript happily accepts an object that is
missing a `ViewSettings` key — there is **no** `satisfies Record<keyof
ViewSettings, ...>` or equivalent completeness check anywhere in this file. A
new `ViewSettings` field added in the engine compiles fine here with zero
changes; its persisted value is silently swallowed by `isRecord(raw)` passing
but the field's `definedOnly(...)` line never being written. Confirmed no
guard exists by reading the full file end-to-end (281 lines).

`parseDepthOverride` (L124-132) is the same shape of function, same risk
class, but only 2 fields (`outgoingDepth`, `incomingDepth`) so it is
low-probability in practice — still hand-maintained with the identical
`definedOnly(...)` spread pattern.

### Sibling parsers (not `ViewSettings` fields — different `PluginData` keys)

- `parseNodeExclusion` (L231-240): non-object → whole fallback; `enabled`
  degrades per-field to the fallback's `enabled` if not boolean; `patterns`
  degrades to the fallback's `patterns` if not an array, and *within* a valid
  array only string entries survive (`.filter(entry => typeof entry === "string")`).
  This one is field-count-stable (2 fields) — same pattern, same risk class,
  much lower probability of ever growing.
- `parsePins` (L242-253): array of `{docid: string, pinTimestamp: number}`;
  a malformed entry is dropped individually, not the whole array (test:
  persistedShapes.test.ts:32-38).
- `parseCentralDepths` (L255-267): `Record<string, DepthOverride>` keyed by
  central docid, each value run through `parseDepthOverride` + `nonEmpty`;
  empty result collapses to `undefined` (not `{}`).

### Absent vs. present-but-invalid — the general rule

Every branch in this file follows ONE rule: **absent-key and
present-but-invalid both degrade to "the key is missing from the parsed
output"**, which for a `ViewSettingsOverride`/`DepthOverride` field means
*inherit* (never a zero/false/empty stand-in). The only field-level exception
to "invalid → drop" is `outlineMaxDepth`, which clamps instead of dropping —
deliberately, per the inline comment (L143-144): "hand-edited JSON cannot
reach 0 (a silent off-switch the feature does not have)". `sizing` and
`forceLayout` also deviate at the *composite* level: a partially-invalid
object is repaired-and-kept (never dropped), because they are atomic
fields — dropping the whole object on one bad sub-key would be a much bigger
loss than the drop-vs-clamp choice made for a single scalar.

A **completely** absent top-level key (`raw["globalView"]` is `undefined`
itself, not present-with-a-bad-shape) is handled one level up, in
`PersistedShapes.parsePluginData`/`parseDocData`, via `isRecord(raw)` guards
and `{...defaults, ...parseViewOverride(raw["globalView"])}` merges (L98) —
`parseViewOverride` never even sees "the whole globalView object is missing"
as a distinct case from "globalView is `{}`" or "globalView is not an
object"; all three take the `!isRecord(raw) → {}` branch and defaults win via
the outer merge.

---

## 2. Persisted shapes (exact JSON, both files)

### `data.json` (global) — `PluginData` (persistedShapes.ts:47-54)

```jsonc
{
  "version": 2,                       // PERSISTED_SHAPE_VERSION; mismatch → WHOLE object replaced by defaults
  "globalDepths": { "outgoingDepth": 1, "incomingDepth": 1 },      // DepthSettings, always both fields present (fully resolved)
  "globalView": {                                                    // ViewSettings, always fully resolved
    "nodeCap": 100,
    "outlineMaxDepth": 2,
    "nodePreviewPreference": "auto",
    "sizing": {
      "metrics": {
        "own-file-size": { "enabled": true,  "weight": 1 },
        "total-linker-size": { "enabled": false, "weight": 1 },
        "backlink-count":  { "enabled": false, "weight": 1 },
        "outlink-count":   { "enabled": false, "weight": 1 },
        "depth-decay":     { "enabled": false, "weight": 1 }
      },
      "depthDecayK": 1, "minPx": 40, "maxPx": 160
    },
    "forceLayout": {
      "centerPullStrength": 0.05, "repelStrength": 300, "linkStrengthFactor": 1,
      "linkGapPx": 40, "collidePaddingPx": 50, "elkNodeSpacingPx": 20,
      "edgeRoutingClearancePx": 11
    }
  },
  "pins": [ { "docid": "docid_a_e", "pinTimestamp": 1234567890 } ],  // PinnedDocEntry[]
  "nodeExclusion": { "enabled": false, "patterns": [] }              // NodeExclusionSettings
}
```

### `doc-data/<docid>.json` (per-doc) — `DocData` (persistedShapes.ts:61-69)

All 3 fields optional; an all-absent doc is never written (file deleted
instead — see §3). Every present field is a **partial** override; presence
of a key = pinned (even if numerically equal to the global default),
absence = inherit.

```jsonc
{
  "version": 2,
  "depths": { "outgoingDepth": 2 },                 // DepthOverride — either/both/no keys
  "view": { "nodeCap": 10, "nodePreviewPreference": "outline" },  // ViewSettingsOverride — any subset of ViewSettings keys
  "centralDepths": { "docid_c_e": { "incomingDepth": 0 } }        // per pinned-central-while-MAIN depth adjustment
}
```

`emptyDocData()` (persistedShapes.ts:82-84) is `{ version: PERSISTED_SHAPE_VERSION }`
— the canonical "nothing pinned" shape; `DocDataMutations.isEmpty` (below) and
`DocDataStore.update` cooperate to never actually write this to disk.

### Version field

One constant, `PERSISTED_SHAPE_VERSION = 2` (persistedShapes.ts:38), shared by
BOTH shapes. Bumped historically when `edgeRouting` (a whole field) was
removed — comment block L27-37 documents the policy explicitly: a
version mismatch on EITHER shape means **wholesale** replacement (defaults for
`PluginData`, `null` for `DocData`) — there is no partial-version-upgrade
path and none is planned ("no forward-compat... a future parser that must
survive a downgrade-then-upgrade round trip has to handle that path
explicitly before shipping"). Per-field ADDITIONS (e.g.
`edgeRoutingClearancePx`) are deliberately NOT accompanied by a version bump —
a missing key inside an otherwise-valid-version file just defaults per-field,
which is forward/backward compatible without a bump (comment at
persistedShapes.ts:208-212, and pinned by test at
persistedShapes.test.ts:225-237).

---

## 3. Write / reset flow

### Global settings write (settings tab → disk)

```
VicinityGraphSettingTab (src/view/, row onChange)
  → planSettingsWrite(interaction, ctx)         [pure, src/view/settingsWritePlan.ts:76-113]
      returns a SettingsCommand: {kind:"global-depths"|"global-view"|"node-exclusion", ...}
  → private persist(command)                    [VicinityGraphSettingTab.ts:887-901, exhaustive switch]
  → PluginDataStore.saveGlobalDepths/saveGlobalView/saveNodeExclusion
                                                  [src/persistence/PluginDataStore.ts:43-53]
  → private persist(updated: PluginData)         [PluginDataStore.ts:66-72]
      this.data = updated                        (sync, BEFORE await — see hazard below)
      writeChain = writeChain.catch(()=>undefined).then(() => port.saveData(this.data))
  → PluginDataPort.saveData(data)                [structural port, storagePorts.ts:8-11]
  → Obsidian's Plugin.saveData (main.ts: `new PluginDataStore(this)`, Plugin satisfies PluginDataPort)
  → data.json on disk
```

Every global command (`global-depths`/`global-view`/`node-exclusion`) writes
the **whole** `PluginData` object every time — `PluginDataStore.persist`
always spreads `{...this.data, <changedKey>: updated}` and hands the FULL
result to `port.saveData`. There is no per-key disk write; `data.json` is
rewritten wholesale on any change.

### Per-doc write (toolbar depth stepper → disk)

```
toolbar control
  → PersistenceServices.setDocDepthField / setCentralDepthField
       [src/persistence/PersistenceServices.ts:38-65]
       (setDocViewField also exists, generic over `keyof ViewSettings`,
        but has NO production caller today — see §5)
  → withPersistableIdentity: docIdPort.ensureDocId → DocPersistEligibility.classify
       (only a "persistable" verdict proceeds; "not-persistable" writes nothing)
  → DocDataStore.update(docid, mutate)            [DocDataStore.ts:42-54]
       mutate = DocDataMutations.setDepthField/setCentralDepthField (pure, DocDataMutations.ts)
  → per-docid serialized queue (`enqueue`, DocDataStore.ts:99-106)
  → DocDataMutations.isEmpty(updated) ? removeIfExists(file) : storage.write(file, JSON)
  → FileStoragePort (vault.adapter)               [storagePorts.ts:14-21]
  → doc-data/<docid>.json on disk
```

### Reset scope

Decided in `src/view/settingsResetPlan.ts` (NOT in `src/persistence` — flagged
by the ticket as one of the 3 silent holes, so summarized here for the write/reset
narrative even though it is outside this area's file ownership):

- `SETTINGS_RESET_SCOPES` (settingsResetPlan.ts:80-172) is a
  `Record<SettingsResetScope, SettingsResetScopeSpec>` — 6 section scopes +
  1 tab-wide `"all"` scope, each with a hand-written `plan()` that lists
  exactly which `ViewSettings`/`DepthSettings`/`NodeExclusionSettings` fields
  it resets, by merging `{...ctx.globalView, <field>: <spec-default>}`.
  Compile-time guard EXISTS for scope PLACEMENT (`_assertEveryResetScopePlaced`,
  L195-197, ensures every `SettingsResetScope` value appears in exactly one of
  `SECTION_RESET_SCOPES` or `ALL_SETTINGS_RESET_SCOPE`) but there is **no**
  guard that every `ViewSettings` FIELD appears in at least one section scope's
  `plan()` — a newly-added field defaults correctly under `"all"` (which uses
  `EngineDefaults.viewSettings()` wholesale, L161) but could be silently absent
  from every SECTION-level reset until a human remembers to add it. This is the
  "reset-scope table" hole the ticket names.
- `settingsWriteScope.ts` (also `src/view/`) classifies a `SettingsCommand`
  (not a per-field value) into `"global" | "per-doc"` via an exhaustive switch
  over the 5 command *kinds* (settingsWriteScope.ts:29-39) — this switch is
  already compile-exhaustive over command kinds, and since every current
  `ViewSettings` field travels through the SAME `"global-view"` command kind,
  this file does not itself enumerate fields. Reading it closely, its actual
  risk is coupled to `settingsResetPlan.ts` more than being an independent
  hole (see the ticket wording: "the reset-scope table
  (src/engine/settingsResetPlan.ts / settingsWriteScope)" — note the file is
  actually at `src/view/settingsResetPlan.ts`, not `src/engine/`, in the
  current tree; the ticket's path looks stale/typo'd).
- `applyReset` (VicinityGraphSettingTab.ts:861-871) drains the debounce queue
  first (`settlePendingWrites()`), then persists each `SettingsCommand` from
  `planSettingsReset(scope, ctx)` **in sequence**, `await`ed one at a time —
  each is a full `data.json` rewrite (per §above), so a 3-command `"all"`
  reset does 3 sequential full-file rewrites, not one batched write.

### Known race/ordering hazards (documentation only — a separate later ticket,
"write/refresh pipeline" (#3 in the chain, `nid_m5hxe4eo9jgt7cfic7s2o3uvi_e`),
owns fixing these; nothing here should be touched by the descriptor-model ticket)

1. **`PluginDataStore.persist` read-modify-write race** (PluginDataStore.ts:66-72):
   `this.data = updated` is assigned synchronously, before the write actually
   lands on disk. Two near-simultaneous callers (e.g. a slider drag firing a
   debounced write while a reset is also computing its own `{...ctx.globalView, ...}`
   snapshot) can each compute `updated` off a `this.data` that predates the
   other's still-in-flight write, and the LATER assignment wins in memory —
   this is the "sibling-field clobbering from stale snapshots" symptom named
   in `docs-internal/notes/settings.md`. Persistence provides **no**
   compare-and-swap; today's mitigation is entirely in the view layer
   (`writeContext()` reads store getters fresh at write time, `SettingsWriteQueue`
   serializes UI-originated writes, `settlePendingWrites()` drains before a
   reset reads `ctx`).
2. **`DocDataStore.update` is race-safe** — per-docid `enqueue` (DocDataStore.ts:99-106)
   truly serializes read-modify-write per doc, proven by
   `DocDataStore.test.ts:82-89` ("two field updates race on the same doc THEN
   both fields survive"). No hazard here.
3. **Reset vs. queued write ordering**: `applyReset` awaits `settlePendingWrites()`
   before reading `ctx` — but this is a view-layer discipline, not something
   `PluginDataStore`/`DocDataStore` enforce; a caller that skips this step
   would race exactly as in (1).
4. **Full-file rewrite cost, not a race but a design note**: `data.json` has no
   per-key persistence — a single-field slider drag rewrites the whole
   `PluginData` object (globalDepths + globalView + pins + nodeExclusion) every
   time. Any descriptor-driven write-plan generator must preserve this (whole
   `saveGlobalView(view)` calls, not per-field disk writes) or it changes the
   write scope semantics `settingsWriteScope.ts` already depends on.

---

## 4. Existing tests in persistence/adapters pinning settings

| File | What it asserts (settings-relevant subset) | Fakes used |
|---|---|---|
| `src/persistence/persistedShapes.test.ts` | `parsePluginData`: first-run defaults, valid round-trip, foreign-version → defaults, malformed pin entries dropped individually, `nodePreviewPreference` valid/absent/unrecognized/wrong-type all resolve correctly, removed fields (`layoutMode`, `groupByFolder`, `edgeVisibility`, `edgeRouting`) silently dropped without error. `nodeExclusion` parsing: absent → default, valid round-trip, non-boolean `enabled` → default, non-array/mixed-type `patterns` degrade correctly. `sizing`/`forceLayout`: round-trip, partial-mangle repair-from-defaults, out-of-range clamp (incl. the `-1` finite-but-invalid `depthDecayK` case), metric-weight clamp, non-object → inherit (absent). `parseDocData`: round-trip, foreign version → null, non-object → null, wrong-typed depth fields dropped field-by-field, **zero depth survives parsing** (presence = pinned, not falsy-dropped). `outlineMaxDepth`: round-trip, `0`→clamped to spec min, `99`→clamped to spec max, absent/non-number → spec default. | none (pure functions under test) |
| `src/persistence/PluginDataStore.test.ts` | Fresh-install defaults match `EngineDefaults.viewSettings()`; `saveGlobalDepths`/`saveNodeExclusion` round-trip through a re-initialized store (proves the disk round-trip, not just in-memory); pin add/refresh-timestamp/remove/`hasPin` semantics. | `FakePluginDataPort` |
| `src/persistence/DocDataStore.test.ts` | No-file → `load` returns `null`; field set → round-trips from its own file; doc A update leaves doc B's file byte-identical (one-file-per-doc isolation); malformed JSON content → `null` (never throws); last-field-revert deletes the file; `listDocIds` filters to filename-safe docids only (drops sync-conflict artifacts); **two concurrent field updates on the same doc both survive** (serialized RMW proof). | `FakeFileStorage` |
| `src/persistence/DocDataMutations.test.ts` | Pin-on-toggle: a value equal to the global default is still WRITTEN (not treated as "no-op back to inherit") for both a depth field and a view field (`nodeCap`); per-field independence (setting one leaves siblings absent); `undefined` reverts to inherit and removes just that key; last-pinned-field-removed collapses the whole sub-object to absent; `setCentralDepthField`/`withoutCentralDepths` central-docid-keyed semantics; `isEmpty`. | none (pure) |
| `src/persistence/PersistenceServices.test.ts` | `pinDoc`/`unpinDoc` end-to-end incl. docid minting, unidentifiable-doc and unsafe-foreign-docid verdicts (nothing persisted on refusal); `setDocDepthField` round-trips through the doc's own file; **`setDocViewField` round-trips a view field equal to the global default (pin-on-toggle) — this is the ONLY exercise of the per-doc view-override write path anywhere in the repo, test-only** (see §5); `setCentralDepthField` lands under MAIN's `centralDepths`; a setting attempted on an unidentifiable doc creates no file. | `FakeDocIdPort`, `FakeFileStorage` (via `DocDataStore`), `FakePluginDataPort` |
| `src/adapters/CentralDepthRoundTrip.test.ts` | Central-depth round-trip through `DocDataMutations` + `GraphRequestAssembler` together (cross-layer proof, not persistence-file-only). | (not read in full depth — file exists, name/describe block confirmed) |
| `src/adapters/GraphRequestAssembler.test.ts` | 3 describe blocks: pins, depth overrides, **view overrides** — proves `mainViewOverride`/`pinnedViewOverrides` pass through untouched from `DocData.view`/`docDataByDocid` into `GraphBuildRequest`. | plain fixtures (no Fake* needed — pure function) |
| `src/adapters/VicinityGraphBuilder.test.ts` | End-to-end: builder reads `pluginDataStore.globalView()`/`globalDepths()`/`nodeExclusion()` + `docDataStore` and assembles a request; exercises the whole read-orchestration path settings flow through before reaching the engine. | `FakeObsidianPorts`, `FakeDocIdPort`, presumably `FakePluginDataPort`/`FakeFileStorage`-backed stores (not read line-by-line) |

Fake providers, all in this area: `FakePluginDataPort` (persistence/, deep-copies
via `JSON.parse(JSON.stringify(data))` on save — so the "saved" state exactly
mirrors what a real `saveData` receives, a good fixture for round-trip tests a
descriptor model would add), `FakeFileStorage` (persistence/, in-memory
`Map`-backed `FileStoragePort`, throws like the real `DataAdapter` on
missing-path read/remove/list), `FakeDocIdPort` (adapters/, deterministic
`docid_minted<n>_e` minting + `ensureCalls` counter to prove read-paths never
mint), `FakeObsidianPorts` (adapters/, vault + metadataCache fixture builder;
not settings-specific but used by settings-exercising builder tests).

---

## 5. Constraints a descriptor-driven parser must respect

1. **Absent override = inherit is the load-bearing invariant** (ticket's own
   framing). Any descriptor-driven `parseViewOverride` replacement MUST
   preserve: (a) a genuinely-missing raw key → omitted from the parsed
   `ViewSettingsOverride`, (b) a present-but-wrong-type/out-of-enum-range raw
   value ALSO → omitted (not a default substituted at this layer — the
   default substitution happens one level up, at the `{...defaults,
   ...parsed}` merge in `parsePluginData`/at `ViewSettingsResolver` for
   `DocData`), except where a field has an explicit clamp-not-drop rule
   (`outlineMaxDepth`, and by extension `sizing`/`forceLayout`'s internal
   numeric sub-fields).
2. **Atomic composites must stay atomic.** `sizing` and `forceLayout` are
   declared (by comment, `engine/types.ts:242-248`, `:160-168` in
   `persistedShapes.ts`) to be ONE pin/inherit unit each, not N independent
   sub-fields, and their parsers deliberately repair-from-default rather than
   drop-on-partial-mangle. A descriptor model that flattens every leaf into
   its own descriptor would change this semantics (partial pinning of e.g.
   just `sizing.minPx`) unless it explicitly special-cases these two fields
   as "composite" descriptors with their own repair-then-clamp parse
   function — worth surfacing to DETAILED_PLANNING as an explicit design
   choice, not something this exploration should decide.
3. **`nodeExclusion` and `pins` are `PluginData` siblings, not `ViewSettings`
   fields** — they have their own parse functions and are not part of the
   `ViewSettingsOverride`/`DepthOverride` cascade at all (no per-doc
   override exists for either). A descriptor model scoped to "one descriptor
   per ViewSettings field" would not naturally cover them; if the ticket's
   goal is genuinely EVERY settings field, `nodeExclusion`'s 2 fields need
   either their own descriptor list or an explicit scope note that they're
   out of scope (they already have a low field count and no override-cascade
   complexity, so the ROI of descriptor-izing them is lower).
4. **Version-field policy must survive**: `PERSISTED_SHAPE_VERSION` is a
   single shared constant; wholesale-replace-on-mismatch for both shapes, but
   per-field-default-on-missing-key WITHOUT a version bump for additive
   fields (documented precedent: `edgeRoutingClearancePx`). A descriptor's
   auto-derived parser must keep this exact two-tier behavior (whole-shape
   version gate, then per-field graceful degradation inside a valid-version
   shape) — collapsing to a single per-field version check (or vice versa,
   collapsing to one whole-shape strict parse) would change observable
   behavior for every existing installed vault (clean break IS allowed per
   the ticket, but silently changing this specific two-tier behavior is a
   BEHAVIOR change, not just a code-shape change, so it should be a
   deliberate call-out if it happens).
5. **`sizing`/`forceLayout` parsers reference `EngineDefaults.viewSettings()`
   defaults directly** (not `SETTINGS_SPEC` literals) for their repair
   fallback (persistedShapes.ts:174, `EngineDefaults.forceLayoutSettings()`
   at L200) — whatever single source of truth the descriptor introduces must
   remain reachable from `persistedShapes.ts` without a circular import
   (currently `persistedShapes.ts` imports FROM `../engine`, one direction
   only — `src/engine` MUST NOT import persistence per
   `architecture-map.md`'s layering rule, so the descriptor list, if it wants
   to drive the parser, is naturally an `engine/`-owned artifact that
   `persistence/` imports, mirroring how `SETTINGS_SPEC` already works
   today).
6. **Adapters layer needs no changes for field completeness** — confirmed
   `src/adapters/*.ts` (non-test) never enumerates a `ViewSettings` field
   name; `GraphRequestAssembler`/`resolvePinnedDescriptors`/`VicinityGraphBuilder`
   pass whole override/`DocData` objects through untouched. A descriptor
   rewrite of the parse layer should not need to touch this layer at all
   (positive constraint: less surface to break).
7. **`DocDataMutations.setViewField` / `PersistenceServices.setDocViewField`
   are ALREADY generic over `keyof ViewSettings`** — not part of the
   boilerplate this ticket needs to collapse. They have no production caller
   today (only exercised by tests), so the descriptor model does not need to
   touch this call path for the write side; the field-name boilerplate is
   concentrated in `persistedShapes.ts` (parse) and `src/view/` (reset-scope
   plans, per-row UI, write-plan `SettingsInteraction`/`SettingsCommand`
   unions) — outside this area.
8. **`EDGE_VISIBILITY_MODES` non-issue**: the sub-note in the ticket/notes doc
   about "`EDGE_VISIBILITY_MODES` re-listed in persistence with no
   completeness guard" (`nid_3k0a4zl6in0mj8lcjibkjq2dx_e`) refers to an enum
   that no longer exists anywhere in the codebase — `edgeVisibility` was
   already deleted as an orphan field (confirmed by
   `persistedShapes.test.ts:76-87`, which tests that an old persisted
   `edgeVisibility` value is dropped without error, and by the "orphan
   fields: delete groupByFolder + edgeVisibility" standing owner decision in
   `docs-internal/notes/settings.md`). Nothing to fold in from persistence's
   side; the live analogous pattern to generalize is `NODE_PREVIEW_PREFERENCES`
   + `_assertEveryNodePreviewPreferenceListed` (`engine/types.ts:164-177`),
   which already has a completeness guard and could be a template for however
   the descriptor model wants to declare enum-valued fields once.
9. **Clean break confirmed available**: `PERSISTED_SHAPE_VERSION` bump policy
   already treats "wholesale replace on version mismatch" as normal, unremarkable
   behavior (used at least twice historically per the comment block). A
   descriptor-driven parser is free to bump the version and let existing
   installs reset to defaults — no migration shim exists anywhere in this
   area and none should be added (matches the ticket's explicit
   "Unpublished repo => clean break... No migrations, no dual-key read
   shims").

