# EXPLORATION_PERSISTENCE — private working notes

Scope: src/persistence + src/adapters only. View-layer files (settingsWritePlan.ts,
settingsResetPlan.ts, settingsWriteScope.ts, VicinityGraphSettingTab.ts) were read
ONLY for the write/reset call-chain narrative (deliverable #3) — they belong to the
other area explorers / later tickets and are cited, not analyzed in depth here.

## File census (src/persistence, src/adapters)

persistence/: ChunkedWork(.test), DocDataMutations(.test), DocDataStore(.test),
DocPersistEligibility(.test), FakeFileStorage, FakePluginDataPort, OrphanSweeper(.test),
PathDocIdMap(.test), PersistenceServices(.test), PluginDataStore(.test),
SweepPlanner(.test), persistedShapes(.test), storagePorts.ts

adapters/: BacklinksAdapter(.test), CanvasCapability(.test), CanvasFallbackParser(.test),
CanvasParseCache(.test), CentralDepthRoundTrip.test, FakeDocIdPort, FakeObsidianPorts,
GraphRequestAssembler(.test), ObsidianLinkProvider(.test), ReferenceOrder(.test),
VicinityGraphBuilder(.test), obsidianPorts.ts, resolvePinnedDescriptors.ts,
testFixtures/*.canvas

## Key findings, in the order I found them

1. persistedShapes.ts is the ONLY place with a hand-maintained per-field branch
   table for globalView / doc view override (parseViewOverride, L135-158). It
   is genuinely hole-prone: adding a ViewSettings field and forgetting the
   `definedOnly(...)` line here means the field silently never persists (raw
   JSON has it, in-memory ViewSettingsOverride does not) — no compile error,
   because the function's return type ViewSettingsOverride = Partial<ViewSettings>
   accepts a strict subset of what it built. Confirmed by reading the whole
   file — no `satisfies Record<keyof ViewSettings, ...>` guard exists anywhere
   in this file.

2. parseDepthOverride (L124-132) is the SAME pattern but only 2 fields, low
   risk. Still hand-maintained.

3. parseSizing / parseForceLayout / parseMetricSetting are "atomic" sub-object
   parsers — sizing and forceLayout are declared (types.ts:296-297 comments) to
   be ONE field each in the ViewSettings cascade (override pins/inherits the
   WHOLE object). So their internal per-key defaulting (repair pattern) is
   NOT the same silent-hole class as the top-level parseViewOverride branch
   table — a missing metric key inside `sizing` is handled by iterating
   `Object.keys(defaults.metrics)`, which IS complete-by-construction (walks
   SizeMetricId keys of the default, not the raw input). Worth flagging in the
   report: the ticket's "one descriptor per FIELD" model must decide whether
   sizing/forceLayout become one descriptor each (matching current 1-field
   cascade semantics) or explode into per-key descriptors — the latter would
   break the "atomic pin" invariant intentionally chosen in types.ts:242-283
   comment (forceLayout) and :160-168 (sizing). This is a DESIGN QUESTION for
   whoever writes the actual descriptor type, not something I should decide,
   but I called it out explicitly in the public report as a constraint.

4. parseNodeExclusion, parsePins, parseCentralDepths are separate concerns
   (not ViewSettings fields) — NodeExclusionSettings has its own top-level
   PluginData key, not part of ViewSettings/ViewSettingsOverride. Pins are a
   list, not a settings field per se. These are NOT in scope for the
   ViewSettings-field descriptor (they're PluginData-shape siblings), but the
   ticket's scope note mentions nodeExclusion has its own spec section
   (NodeExclusionSpec) — probably wants its own descriptor pair too, separate
   from the ViewSettings descriptor list.

5. EDGE_VISIBILITY_MODES (mentioned in the ticket and docs-internal/notes/settings.md
   as "re-listed in persistence with no completeness guard", ticket
   nid_3k0a4zl6in0mj8lcjibkjq2dx_e) does NOT exist anywhere in the current
   codebase (grepped, zero hits). The `edgeVisibility` field itself is already
   gone — persistedShapes.test.ts:76-87 explicitly tests that an old
   `edgeVisibility` value in raw JSON is dropped without error (it was removed
   as an orphan field, confirmed also by architecture doc / settings.md
   "orphan fields" decision). So this sub-ticket's premise is STALE as of
   today — nothing to "fold in" because the enum it was worried about is
   already gone. I noted this as a finding rather than silently dropping it,
   in case the ticket author wants to close/adjust nid_3k0a4zl6in0mj8lcjibkjq2dx_e.

   The GENERAL pattern this ticket note anticipates (an enum's value-array vs
   its type silently drifting) DOES have one live instance:
   NODE_PREVIEW_PREFERENCES (types.ts:164-177) — and that one IS guarded
   already via `_assertEveryNodePreviewPreferenceListed` (a
   `Exclude<T, U> extends never` compile check). This is the pattern the
   descriptor model should presumably generalize/replace.

6. ViewSettingsResolver.resolve (engine/ViewSettingsResolver.ts:29-53) is
   confirmed NOT a silent hole exactly as the ticket states: its return type
   `ViewSettings` (a closed interface) means every field MUST be explicitly
   assigned in the returned object literal (L46-52) or TS errors. This isn't
   my area (engine) but I verified it since the ticket leans on it as a
   "corrects the research ticket" fact and my deliverable references it.

7. DocDataMutations.setViewField<K extends keyof ViewSettings> (generic over
   the key) has NO production call site outside PersistenceServices.setDocViewField,
   which itself has NO production call site outside its own test
   (PersistenceServices.test.ts:84-89) and DocDataMutations.test.ts. Grepped
   confirmed zero UI call sites. So today, per-doc ViewSettings overrides are
   fully wired in the PERSISTENCE layer (parse, store, resolve, assemble) but
   have NO UI writer — only global writes (VicinityGraphSettingTab) reach
   ViewSettings fields in practice, and toolbar depth steppers reach
   DepthOverride per-doc fields. This matters for scoping the descriptor's
   "write plan" derivation: the generic path already exists and is generic
   over `keyof ViewSettings`, which is GOOD NEWS for a descriptor rewrite
   (no per-field boilerplate here to collapse — it's already one generic
   function). The boilerplate is concentrated in persistedShapes.ts and (per
   ticket) settingsResetPlan.ts / settingsWriteScope.ts / the settings tab UI,
   NOT in DocDataMutations/PersistenceServices.

8. settingsWriteScope.ts (view/, not persistence, but ticket calls it a
   "genuinely silent hole") classifies by SettingsCommand.kind — command KINDS
   are coarse (5 kinds: doc-depth-field, central-depth-field, global-depths,
   global-view, node-exclusion), not per-ViewSettings-field. So this
   classifier does NOT need to enumerate ViewSettings fields at all — EVERY
   ViewSettings field currently goes through the SAME "global-view" /
   "doc-depth-field" whole-object-ish command kinds. The exhaustiveness switch
   (L29-39) is already compile-guarded (noImplicitReturns + exhaustive switch
   per its own doc comment). So is this really a per-FIELD hole? Re-reading
   the ticket: it calls settingsResetPlan.ts / settingsWriteScope together as
   "the reset-scope table" — I think the real hole is settingsResetPlan.ts's
   per-SCOPE (not per-field) plan functions: e.g. "node-contents" scope
   (settingsResetPlan.ts:94-111) hand-lists `outlineMaxDepth` and
   `nodePreviewPreference` as the two fields belonging to that scope, and nothing
   stops a future ViewSettings field from being silently omitted from EVERY
   scope's plan() (so "Restore all" is the only reset that would touch it,
   because `all` uses `EngineDefaults.viewSettings()` wholesale — L159-163).
   That's the actual drift risk: a NEW field defaults correctly under "all"
   (wholesale default object) but under NO section scope until someone
   remembers to add it to one. This is view/ scope, not mine, but I flagged
   it precisely for the public report since deliverable #3 asks for it and the
   ticket explicitly names this file.

9. Write chain confirmed end-to-end for GLOBAL writes:
   UI row onChange (VicinityGraphSettingTab.ts) → planSettingsWrite() [pure,
   view/settingsWritePlan.ts] → SettingsCommand → private persist() switch
   (VicinityGraphSettingTab.ts:887-901) → PluginDataStore.saveGlobalDepths /
   saveGlobalView / saveNodeExclusion (persistence/PluginDataStore.ts:43-53)
   → private persist(updated) (PluginDataStore.ts:66-72) → serialized
   writeChain promise → port.saveData(this.data) → Obsidian's Plugin.saveData
   (main.ts wires `new PluginDataStore(this)`, `this` = Plugin implements
   PluginDataPort structurally) → data.json on disk.
   For PER-DOC writes (depth steppers, not settings tab): toolbar control →
   PersistenceServices.setDocDepthField/setCentralDepthField (not
   setDocViewField — no live caller) → DocDataStore.update(docid, mutate)
   (persistence/DocDataStore.ts:42-54) → per-docid serialized queue
   (queueByDocid Map, enqueue L99-106) → storage.write or removeIfExists →
   Obsidian's vault.adapter (main.ts: `new DocDataStore(this.app.vault.adapter, ...)`).

10. Ordering hazards (NOT to be fixed here — ticket 3 "write/refresh pipeline"
    owns it — I only had to document, not touch):
    - PluginDataStore.persist (L66-72): writeChain is a SINGLE serialized
      promise chain covering ALL of data.json (depths+view+pins+exclusion) —
      good, no interleaving within data.json. BUT it does last-write-wins on
      `this.data` synchronously (`this.data = updated` happens BEFORE the
      await), so two near-simultaneous callers computing `updated` off a stale
      `this.data` can clobber each other's field (classic read-modify-write
      race) — this is exactly the "sibling-field clobbering from stale
      snapshots" symptom bug settings.md's problem section names. The
      mitigation today lives entirely in the VIEW layer (writeContext() reads
      "fresh" store getters, applyReset's settlePendingWrites() drain,
      SettingsWriteQueue) — persistence itself provides NO compare-and-swap or
      version check.
    - DocDataStore.update: per-docid queue via `enqueue` IS a true serialized
      RMW (test proves it: DocDataStore.test.ts:82-89, "two field updates race
      on the same doc THEN both fields survive"). This one is race-safe by
      construction at the persistence layer, unlike PluginDataStore.
    - Reset (applyReset, VicinityGraphSettingTab.ts:861-871) drains the debounce
      queue FIRST via settlePendingWrites(), then persists each reset command
      IN SEQUENCE via `await this.persist(command)` (not batched) — each command
      calls a whole-object save (saveGlobalDepths/saveGlobalView/saveNodeExclusion),
      so a multi-command reset (`all` scope emits 3 commands) does 3 separate
      writeChain round-trips to disk, sequentially awaited. No atomicity across
      the 3 files/keys — a crash between them could leave data.json partially
      reset. This is inherent to data.json being one JSON blob with 3
      independently-saved top-level keys sharing ONE persist() function that
      always writes the WHOLE PluginData object anyway (persist() takes
      `updated: PluginData` and writes all of it every time) — so actually
      each of the 3 sequential commands DOES rewrite the whole file (redundant
      but not unsafe for atomicity beyond normal single-write risk). Worth
      stating precisely in the public report since I initially mis-read it as
      3 partial writes; on closer read of PluginDataStore.persist it is 3 FULL
      rewrites of data.json in a row.

11. Version handling: PERSISTED_SHAPE_VERSION = 2 (persistedShapes.ts:38), one
    shared constant for BOTH PluginData and DocData. A version mismatch on
    PluginData → wholesale defaults (parsePluginData L92-94). A version
    mismatch on DocData → null (parseDocData L106-108), which
    VicinityGraphBuilder/DocDataStore treat as "no per-doc data" (full
    inherit). Comment block L27-37 explains the deliberate no-forward-compat,
    no-migration policy already in place — this matches the ticket's "clean
    break allowed" note; nothing to change here for the descriptor ticket
    itself, but the descriptor rewrite must decide whether per-field parsing
    (current behavior — a field-level miss degrades gracefully without a full
    version bump, see forceLayout's edgeRoutingClearancePx comment L208-212)
    remains possible, since that's a stated design property ("forward
    compatible" within a version) the hole-closing completeness guard must not
    break.

12. Adapters layer (GraphRequestAssembler, resolvePinnedDescriptors,
    VicinityGraphBuilder) do NOT enumerate ViewSettings fields anywhere — they
    pass whole DepthOverride/ViewSettingsOverride/DocData objects through.
    Confirmed via grep for field names (nodeCap, outlineMaxDepth, etc.) in
    src/adapters/*.ts excluding tests — zero hits. So "every place a field
    name is enumerated by hand inside src/adapters" — ANSWER: nowhere. The
    adapters layer is already generic/pass-through. This is a notable NEGATIVE
    finding worth stating plainly in the public report (saves the implementer
    from looking there).

13. Tests pinning settings in my area, catalogued with what they assert — see
    public report section 4 for the full table. Fake providers: FakePluginDataPort
    (persistence/FakePluginDataPort.ts, deep-copies via JSON round-trip on save —
    so "saved" mirrors exactly what a real Obsidian saveData would receive, good
    fixture for descriptor round-trip tests), FakeFileStorage (persistence/,
    in-memory Map, throws on missing path like real DataAdapter), FakeDocIdPort
    (adapters/, deterministic docid minting docid_minted<n>_e, tracks ensureCalls),
    FakeObsidianPorts (adapters/, vault+metadataCache fixture builder, not
    settings-specific but used by VicinityGraphBuilder.test.ts which DOES
    exercise settings resolution end-to-end).

## Things I decided NOT to do (per scope)

- Did not read src/view/settingsWritePlan.test.ts, settingsResetPlan.test.ts,
  settingsWriteScope.test.ts, VicinityGraphSettingTab.test.ts in depth — those
  are area-3 (UI+tests) or possibly area-1 (engine) territory per the
  TOP_LEVEL_AGENT.md index. I only read the non-test source files enough to
  narrate the write/reset call chain factually for deliverable #3, which
  explicitly asked for "call chain from a UI change to bytes on disk."
- Did not open other agents' PRIVATE.md files (none existed at the time I
  started; only EXPLORATION_PUBLIC.md index + TOP_LEVEL_AGENT.md were present).
- Did not propose or sketch the descriptor type itself — out of scope for
  EXPLORATION phase (that's DETAILED_PLANNING).
