# Exploration: separate embed depth budget (Stage 1 carry-kind, Stage 3 channel enum)

Ticket: `_tickets/separate-depth-budget-for-embedded-outgoing-links.md`
Scope confirmed here: Stage 1 (`LinkKind` carried, no behavior change) + Stage 3
(`Direction` → 3-value `CHANNEL` enum, global depth key renames + new `embedDepthOut`).
Stage 0 (compile-time completeness guards) and the per-doc/per-central removal are
**already landed** — this repo is past both prerequisites.

---

## 1. Settings descriptor model TODAY — baseline for a new global numeric field

Files: `src/engine/SettingsSpec.ts`, `src/engine/types.ts`, `src/engine/constants.ts`,
`src/persistence/persistedShapes.ts`, `src/view/settingsSectionFields.ts`,
`src/view/settingsRows.ts`, `src/view/settingsWritePlan.ts`,
`src/view/VicinityGraphSettingTab.ts`, `src/view/SettingsRowView.tsx`,
`src/engine/testFixtures/settingsSpecLeaves.ts`.

Exact steps to add ONE new global numeric field (e.g. `embedDepthOut`), and whether each is
compile-time-guarded or hand-maintained:

1. **Add the field to the domain type** — `DepthSettings` in `src/engine/types.ts:185-188`. (n/a, source of truth)
2. **Add it to `DepthSpec`** in `src/engine/SettingsSpec.ts:56-59` and give it a default/bounds
   entry under `SETTINGS_SPEC.globalDepths` (`SettingsSpec.ts:159-164`).
   — **Compile-time guarded**: `_assertEverySettingsFieldSpecced` /
   `_assertNoOrphanSpecField` (`SettingsSpec.ts:114-127`) fail to compile if a
   `DepthSettings` field has no spec entry or vice versa.
3. **`EngineDefaults.depthSettings()`** in `src/engine/constants.ts:237-243` must read the new
   spec leaf. — **Hand-maintained** (plain object literal keyed by field name; a missed field
   here is NOT a compile error today because the return type is the full `DepthSettings`
   object literal — TS *will* catch a missing key since it's a required field of the return
   type, so this one is effectively compiler-enforced too, but only because the function
   returns the exact interface).
4. **`DIRECTION_DEPTH_FIELD`** (`types.ts:209-212`) — N/A for Stage 1; for Stage 3 this map is
   replaced/extended by a `CHANNEL_DEPTH_FIELD` (see §2). — **compile-time guarded** today via
   `Readonly<Record<Direction, keyof DepthSettings>>`.
5. **`persistedShapes.ts`**: add to `PluginData.globalDepths` (already covered by `DepthSettings`)
   and to `parseDepthFields` (`persistedShapes.ts:118-126`). — **Compile-time guarded**: the
   `definedFieldsOnly<DepthSettings>({...})` call requires every `DepthSettings` key present
   in the object literal (all-required intermediate type), so a missing field is TS2345/2739.
6. **`settingsSectionFields.ts`**: add the field to `SECTION_SETTINGS_FIELDS["depth-defaults"].depth`
   (`settingsSectionFields.ts:47`). — **Compile-time guarded**: `_assertEverySettingsFieldSectioned`
   (`:73-75`) fails if a `DepthSettings` key is absent from every section's `depth` column.
7. **`settingsRows.ts`**: declare a new `SettingsRow` (control kind, label, description) under
   `SETTINGS_GROUPS["depth-defaults"]` (`settingsRows.ts:279-299`). — **Hand-maintained** (no
   compiler guard ties a `DepthSettings` field to a declared row; only the row's *control kind*
   is compile-guarded via `SETTINGS_ROW_CONTROL_KINDS`/`_assertEveryRowControlKindListed`, and
   only after you've picked one). This is the step most likely to be silently skipped.
8. **`settingsWritePlan.ts`**: extend `SettingsInteraction` (kind `"global-depth"` already carries
   `direction: Direction`; a 3rd channel needs either widening `Direction`/the interaction's field
   ref, or a **new** interaction kind) and `planSettingsWrite` (`:77-106`). — Partially
   guarded: the `switch` is exhaustive over `SettingsInteraction["kind"]` (no `default`, so TS
   requires every arm), but nothing forces a *new field* to get a new interaction kind.
9. **Presenters**: `VicinityGraphSettingTab.ts` (`addDepthSlider` etc., ~line 704-716) and
   `SettingsRowView.tsx` (`DepthRow`, ~line 195-211) must read/write the new field. —
   **Compile-time guarded for control KIND** (both presenters `switch` on `row.control.kind`
   closed by `unhandledRowControl`, `settingsRows.ts:94-113`), but only after step 7 exists and
   only if the new row reuses the existing `"depth"` control kind shape; if Stage 3 needs a
   *new* control kind (channel is 3-valued, not boolean-direction), that switch becomes the
   compile-time forcing function across BOTH presenters — this is the strongest guard in the
   whole model.
10. **Tests to touch by hand** (structural walk covers most, but two are deliberately literal):
    - `src/engine/testFixtures/settingsSpecLeaves.ts` — nothing to edit; it walks the spec.
    - `src/engine/settingsProductDefaults.test.ts` — **hand-maintained, MUST edit**:
      `SHIPPED_SETTINGS_DEFAULTS` (`:48-83`) is a literal per-leaf table; a new leaf makes the
      structural `toEqual` fail until you add its default here (this is the intended tripwire).
    - `src/engine/settingsSpecBounds.test.ts` — `BOUNDS_ENFORCERS` (`:44+`) is a literal map from
      leaf id → enforcer function; a new bounded field needs an entry (structural-but-hand-added).
    - `src/persistence/settingsSpecPersistence.test.ts` and `src/view/settingsRowParity.test.ts` —
      pure walks, **no hand edit needed** (this is the "descriptor model" payoff).
    - `src/view/settingsResetPlan.test.ts` — uses `globalDepths: { outgoingDepth: 4, incomingDepth: 5 }`
      literal fixtures (`:37`) — would need the new field added to stay exhaustive if it asserts
      a full round object; check at implementation time.
11. **e2e**: `e2e/obsidianHarness.ts:58` (`DepthSettings` type import, no literal fields to edit),
    but concrete e2e specs that construct/assert full `{ outgoingDepth, incomingDepth }` literals
    are hand-maintained call sites (§2 below) — every one needs a third field added if it builds
    a whole-object literal.

**Verdict on the measurement mandate**: the guarded steps are real (spec completeness, section
completeness, parser completeness, control-kind exhaustiveness across both presenters) — a field
declared in `SETTINGS_SPEC` but never sectioned/parsed is now a compile error, which is the
"~15 files / ~8 hand-maintained lists" problem the ticket is measuring against. The still-manual
edits are: (a) the spec leaf itself + its row declaration (irreducible — this is "declare the
setting"), (b) the literal defaults table in `settingsProductDefaults.test.ts` (deliberate, by
design), (c) the bounds-enforcer map in `settingsSpecBounds.test.ts` when the field is bounded,
(d) whatever new `SettingsInteraction`/`SettingsCommand` arm the write plan needs, (e) any e2e
spec building a full-object depth literal. That is roughly 6-8 files touched for the mechanical
plumbing of ONE field today, several of which are compile-error-forced rather than silent — a
real drop from "~15 files / ~8 *silent*-fail lists," but not zero, and Stage 3's field is not a
peer add: it also turns a 2-branch `Direction` union into a 3-branch `CHANNEL` union, which
touches every `Record<Direction, …>` completeness table listed in §2 as ADDITIONAL compile
errors (a feature, not a cost, per the ticket's own framing).

---

## 2. Depth settings surface — `Direction` / `DIRECTION_DEPTH_FIELD` / every reference

- `Direction = "outgoing" | "incoming"` — `src/engine/types.ts:36`.
- `DepthTag.direction: Direction` — `types.ts:41`.
- `DepthSettings { outgoingDepth, incomingDepth }` — `types.ts:185-188`.
- `DIRECTION_DEPTH_FIELD: Readonly<Record<Direction, keyof DepthSettings>>` — `types.ts:209-212`,
  re-exported from `src/engine/index.ts:57`. THIS is the map that becomes `CHANNEL_DEPTH_FIELD`
  (3 entries) per the ticket's table — and because it's a `Record<Direction, …>`, widening
  `Direction`/introducing `Channel` here is the single completeness guard that will flag every
  other exhaustive `Record`/`switch` keyed on the old 2-value union.
- Consumers of `Direction` (need review for Stage 3, each is a candidate exhaustiveness point):
  - `src/engine/VicinityTraversal.ts`: `DIRECTIONS` const array (`:52`), `bfs(root, direction, …)`
    (`:94-134`, depth-limit ternary at `:101`), `neighborsOf(path, direction)` (`:136-140`,
    ternary dispatch to `getOutgoingLinks`/`getIncomingLinks`), `recordEdge` direction ternary
    (`:205-208`). This is where the ticket's "3 BFS runs, map lookup on channel" lands.
  - `src/adapters/GraphRequestAssembler.ts` (`:2,19,45`) — passes `globalDepths` through, no
    per-direction branching itself.
  - `src/view/settingsWritePlan.ts` — `SettingsInteraction` `"global-depth"` arm carries
    `direction: Direction` (`:37`), consumed by `DIRECTION_DEPTH_FIELD[interaction.direction]`
    (`:82`).
  - `src/view/settingsRows.ts` — `SettingsRowControl` `"depth"` arm carries `direction: Direction`
    (`:71`); two rows declared literally (`"outgoing"`/`"incoming"`) under `depth-defaults`
    (`:286-296`).
  - `src/view/VicinityGraphSettingTab.ts` — `addDepthSlider(container, row, direction, state)`
    reads `state.globalDepths[DIRECTION_DEPTH_FIELD[direction]]` (`~:704-716`).
  - `src/view/SettingsRowView.tsx` — `DepthRow({ row, direction, state })` same read pattern
    (`~:195-211`).
  - `src/view/settingsSectionFields.ts` — `depth: readonly (keyof DepthSettings)[]` column,
    `"depth-defaults"` section owns `["outgoingDepth", "incomingDepth"]` (`:47`).
- Test/fixture references to `outgoingDepth`/`incomingDepth` as literal object keys (all need a
  3rd field or explicit non-participation once renamed — this is the "hand-maintained" surface
  D2/D4 warned about): `src/adapters/GraphRequestAssembler.test.ts`,
  `src/engine/testFixtures/denseVaultFixtures.test.ts`, `src/engine/testFixtures/truncationHarness.ts`,
  `src/engine/GraphTruncator.denseFixtures.test.ts`, `src/engine/GraphTruncator.test.ts`,
  `src/engine/VicinityTraversal.test.ts`, `src/engine/NodeSizer.test.ts`,
  `src/engine/VicinityEngine.denseFixtures.test.ts`, `src/engine/VicinityEngine.test.ts`,
  `src/persistence/PluginDataStore.test.ts`, `src/persistence/persistedShapes.test.ts`,
  `src/view/ControlsModel.test.ts`, `src/view/settingsWritePlan.test.ts`,
  `src/view/settingsResetPlan.test.ts`, `src/view/settingsSectionFields.test.ts`.
- e2e literal usages of `outgoingDepth`/`incomingDepth` keys or depth-label locators (all break on
  the rename, all need the rename applied in lockstep — see §8 too):
  `e2e/edgeRoutingEval.e2e.ts:102`, `e2e/edgeRouting.e2e.ts:62`,
  `e2e/controlsRestart.e2e.ts:67,133,156` (locator fn named `incomingDepthValue`),
  `e2e/pinnedCentralScenario.e2e.ts:80,154,163` (`outgoingDepthValue`),
  `e2e/settingsResetReview.e2e.ts:38,60,75,91,103,118,130,211,227`,
  `e2e/settingsUxVisual.e2e.ts:359,366,378,382`.
- `docs-internal/plan/high-level-plan.md` and `README.md` do NOT use the literal JSON key names
  `outgoingDepth`/`incomingDepth` — README's depth section (`README.md:22,77,79,91,105,108,147,148,
  201`) uses prose ("outbound and incoming traversal", "Outgoing depth"/"Incoming depth" labels).
  These need prose updates ("Links out"/"Embeds out"/"Links in" per D2) but are not a grep-key
  concern. `high-level-plan.md:39` documents the outgoing/incoming DATA SOURCES (resolvedLinks /
  getBacklinksForFile), unrelated to the depth-field names but relevant to the "outgoing splits by
  kind" traversal change — this doc's depth cascade section should be updated per the ticket's
  final scope note ("Adjust ... docs-internal/plan/high-level-plan.md depth cascade, README Depth
  section as part of this ticket").

---

## 3. VicinityTraversal — DIRECTIONS / bfs / neighborsOf / DepthTag / visited

`src/engine/VicinityTraversal.ts` (full file read):

- `DIRECTIONS: readonly Direction[] = ["outgoing", "incoming"]` (`:52`) — becomes the 3-element
  channel list per the ticket's table. `traverse()` (`:75-92`) loops `for (const direction of
  DIRECTIONS)` once per root, calling `bfs(root, direction, rootPaths, collector)` (`:87-88`).
- `bfs()` (`:94-134`): picks `depthLimit` via a ternary on `direction` (`:101`,
  `direction === "outgoing" ? root.depths.outgoingDepth : root.depths.incomingDepth`) — becomes a
  map lookup on the new `CHANNEL_DEPTH_FIELD`. `visited: Map<VaultPath, number>` (`:102`) is
  per-BFS-run (i.e. per channel today, per direction) — under kind-pure channels (decision 6a)
  this stays exactly the same shape, just instantiated 3x instead of 2x per root.
- `neighborsOf(path, direction)` (`:136-140`) ternary-dispatches to
  `provider.getOutgoingLinks(path)` / `provider.getIncomingLinks(path)`. For the new
  `outgoing-link`/`outgoing-embed` channels this must further filter/split
  `getOutgoingLinks` results by kind — which requires `LinkProvider` to expose kind per outgoing
  target (see §4; today it returns a flat `readonly VaultPath[]` with no kind attached — this is
  the actual Stage-1→Stage-3 seam).
- **`isNodeBearing` eligibility gating**: happens in `bfs()` at `:122-124` — after the exclusion
  check, before `recordEdge`/enqueue — `if (!this.eligibility.isNodeBearing(neighbor)) { continue;
  }`. This is the mechanism D5 (attachments stay orthogonal to embed-ness) relies on: a
  `![[diagram.png]]` embed of a non-node-bearing file is filtered out HERE regardless of channel,
  before it could ever consume `embedDepthOut` budget or become a node. **No new code needed** to
  honor D5 — confirmed by reading the gate: it runs identically for every direction/channel.
- **Edge recording/normalisation**: `recordEdge(current, neighbor, direction)` (`:204-209`)
  normalises direction→(source,target) so edges always point linker→linked regardless of which
  BFS direction discovered them (`"incoming" ⇒ source=neighbor, target=current`). Under the new
  channel enum, `outgoing-link` and `outgoing-embed` both discover forward edges (current→neighbor
  is the natural direction for both), so `recordEdge` for these two channels is a strict subset of
  today's `"outgoing"` case — `incoming` is unchanged. The `EdgeAccumulator` (`EdgeAccumulator.ts`,
  not fully read here but referenced `VicinityTraversal.ts:2,194,208,220-221`) currently produces
  count-free `DirectedLink {source,target}` pairs (`types.ts:132-135`) with NO kind carried through
  — per §5/§7 below, `GraphEdge.count` (the only multiplicity field, `types.ts:141-144`) would need
  to become channel/kind-aware if edges must report "link vs embed vs both" (this is explicitly
  flagged in the ticket as "still open, smaller" — out of Stage 1/3's stated scope, which is depth
  budgeting only, not edge rendering).
- `TraversalRoot.depths: DepthSettings` (`:20-23`) is the per-root depth object threaded in from
  `GraphRequestAssembler`/`VicinityEngine`; a 3rd field arrives here for free once `DepthSettings`
  gains `embedDepthOut` (no separate plumbing — same object, new key).

---

## 4. LinkProvider port + ObsidianLinkProvider + FakeLinkProvider

- **Port** (`src/engine/LinkProvider.ts`, full file read):
  - `getOutgoingLinks(path): readonly VaultPath[]` (`:62`) — flat, **no kind**. This is the
    Stage-1 seam: Stage 1 needs this (or a new port method) to report link vs embed per target.
  - `getIncomingLinks(path): readonly VaultPath[]` (`:64`) — stays kind-blind by SCOPE DECISION
    (incoming-embed explicitly out of scope).
  - `getFileMetadata(path): FileMetadata | undefined` (`:66`) — `FileMetadata.attachments:
    readonly AttachmentRef[]` (`:28`) has NO kind field either; `AttachmentRef {path, isImage}`
    (`types.ts:46-49`) — per D5, attachments stay kind-blind (deliberately).
  - `getLinkCount(source, target): number` (`:73`) — the "sole multiplicity authority" the ticket
    names; becoming channel-aware (or gaining a second `embedCount`) is explicitly flagged as
    still-open and OUT of Stage 1/3's minimum scope (needed only if edges must visually/countwise
    distinguish kind — Stage 2, deferred per D3).
  - The doc comment at `:25-27` ("Provider-owned so adapters can refine the rule (e.g. embeds vs.
    plain …) without an engine change (OCP)") is the ticket's own citation and still reads exactly
    as quoted.
- **`ObsidianLinkProvider`** (`src/adapters/ObsidianLinkProvider.ts`, full file read):
  - `getOutgoingLinks` (`:119-126`) calls `outgoingPathsOf` (`:241-260`) which already
    distinguishes 3 sources of targets: fallback-parsed canvas (`canvasOutgoingByPath`, kind
    unknown per-reference at this call site — `CanvasReference` DOES carry a kind, see below),
    ordered markdown `OrderedReference[]` (built by `ReferenceOrder.orderedReferences`, which
    ALREADY merges `cache.links`+`cache.embeds` untagged — `ReferenceOrder.ts:44`), and
    core-indexed-canvas/not-yet-cached fallback via raw `resolvedLinks` keys (`:257-259`, no
    kind, no order). **All three paths currently discard kind** — confirmed exactly as the ticket
    states.
  - `getLinkCount` (`:135-149`) — canvas-fallback path counts raw occurrences in
    `canvasOutgoingByPath` (kind-blind, since `resolvedCanvasTargetsOf` at `:317-334` already
    flattens `CanvasReference.kind` away into a plain string target); core path reads
    `resolvedLinks[source]?.[target]` (Obsidian's own merged link+embed count, `:148`).
  - **§3a "always parse canvases" concretely means**: deleting the
    `CanvasCapabilityDetector.detectFor(...) === "core-indexed" → continue` skip at
    `ObsidianLinkProvider.ts:90-92` inside `static async create(...)`, so EVERY `.canvas` file goes
    through `canvasParseCache.referencesOf(...)` (already mtime-cached,
    `src/adapters/CanvasParseCache.ts:23-31`) regardless of whether `resolvedLinks` indexed it.
    `getOutgoingLinks`/`getLinkCount`/`getIncomingLinks` already prefer `canvasOutgoingByPath` /
    `canvasIncomingByPath` when present (`:242-243, 136-137, 130-132`), so removing the guard is
    the ENTIRE code change for 3a — no other call site needs to change. This also removes the
    per-canvas regime SPLIT that today lets `resolvedLinks`-served canvases silently differ from
    fallback-served ones in the case the ticket calls out (`nid_s676x55uojmtcwh9t4l9mc6zl_e`).
  - `resolvedCanvasTargetsOf` (`:317-334`) resolves BOTH `CanvasReference` kinds
    (`"file-node"`/`"text-node-link"`, `CanvasFallbackParser.ts:110-112`) into a flat
    `readonly string[]` — the kind tag is dropped exactly at this resolution step, another
    concrete Stage-1 site (alongside `ReferenceOrder`, the two shared regexes, and
    `ReferencePort`).
- **`FakeLinkProvider`** (`src/engine/FakeLinkProvider.ts`, full file read): declarative fixture
  provider — `getOutgoingLinks`/`getIncomingLinks`/`getLinkCount` all operate on flat
  `Record<string, readonly string[]>` link declarations (`FakeVaultSpec.links`, `:36`), with NO
  kind concept anywhere. Stage 1 will need either a new optional per-link-kind fixture shape here
  (e.g. `links: Record<path, readonly {target, kind}[]>` or a parallel `embedLinks` map) — this is
  the test-fake surface every engine-side traversal test depends on, so its shape change is a
  first-class Stage-1 deliverable, not incidental.
- **`FakeObsidianPorts`** (`src/adapters/FakeObsidianPorts.ts`, partial read): adapter-level fake
  — `fileCaches: Record<string, CachedMetadataPort>` (`:20`) already lets a test supply
  `links`/`embeds` arrays separately (mirrors real `CachedMetadata`), so Stage 1's markdown-side
  fixtures need NO shape change here — only `ReferenceOrder`'s consumption of them changes.

---

## 5. The four embed-discarding sites — current shape + existing tests

| Site | Current shape (confirmed) | Existing tests |
|---|---|---|
| `ReferenceOrder.orderedReferences` — `src/adapters/ReferenceOrder.ts:39-47` | `bodyRefs: ReferencePort[] = [...cache.links, ...cache.embeds]`, sorted by offset, kind dropped at the spread (`:44`); `OrderedReference {link, offset}` (`:9-12`) has no kind field | `src/adapters/ReferenceOrder.test.ts` |
| `ReferencePort` — `src/adapters/obsidianPorts.ts:35-38` | `{link, position}` only — no `original` (needed for the `!` prefix cross-check the ticket mentions) | covered indirectly via `FakeObsidianPorts`/`ObsidianLinkProvider.test.ts` fixtures |
| `Wikilinks.WIKILINK_SOURCE` — `src/shared/Wikilinks.ts:20` | `"!?\\[\\[([^\\]]+)\\]\\]"` — the `!` sits OUTSIDE capture group 1, confirmed; `linkTargetsOf` (`:42-51`) returns bare target strings, no kind | `src/shared/Wikilinks.test.ts` |
| `MarkdownInlineLinks.INLINE_LINK_SOURCE` — `src/shared/MarkdownInlineLinks.ts:32` | `"!?\\[[^\\[\\]]*\\]\\(([^()]*)\\)"` — same pattern, `!` outside the captured group | `src/shared/MarkdownInlineLinks.test.ts` |

Note: `CanvasFallbackParser.CanvasReference` (`src/adapters/CanvasFallbackParser.ts:110-112`)
already tags EVERY reference with a `kind: "file-node" | "text-node-link"` — that is a
RESOLUTION-mechanism tag, not a link/embed tag, and the ticket's "file node ⇒ embed" (research
§1) piggybacks on this existing tag rather than needing a new one; a text-node reference's
embed-vs-link status still depends on capturing the `!` in the two shared regexes above (since
`Wikilinks`/`MarkdownInlineLinks` are reused verbatim by `CanvasFallbackParser.textNodeReferencesOf`,
`:95-100`).

`BacklinksAdapter.extractSourcePaths` (`src/adapters/BacklinksAdapter.ts:30-42`) — confirmed keeps
only map/record KEYS, discarding values — but **this is OUT OF SCOPE** per the settled scope cut
(incoming stays kind-blind; §4/4a/4b of the research are retired, not needed). Still a real
"discards embed-ness" site in the code, just not one Stage 1/3 must touch.

---

## 6. CanvasCapability / CanvasFallbackParser / CanvasParseCache / core-indexed regime

- `CanvasCapabilityDetector.detectFor(resolvedLinks, canvasPath)` (`src/adapters/CanvasCapability.ts:22-26`)
  — pure key-presence check, `"core-indexed"` vs `"fallback-required"`. Single call site:
  `ObsidianLinkProvider.ts:90`.
- "Always-parse canvases" (3a) = delete the `if (... === "core-indexed") continue;` guard at
  `ObsidianLinkProvider.ts:90-92` (see §4 above for the full mechanics). `CanvasParseCache`
  (`src/adapters/CanvasParseCache.ts`) already mtime-caches so this costs one extra
  `vault.read`+`JSON.parse` only on FIRST build or after a canvas's mtime changes, confirmed by
  reading `referencesOf` (`:23-31`).
- **Tests pinning the regime split** (would need updating/retargeting if 3a lands): every test
  listed in the earlier grep under "canvas tests grep regime" —
  `src/adapters/CanvasCapability.test.ts` (pins the detector itself, stays valid — detection logic
  doesn't change, only whether its result is CONSULTED), and `src/adapters/ObsidianLinkProvider.test.ts`
  has ~10 paired "WHEN NOT core-indexed" / "WHEN core-indexed" test pairs (lines 123-131, 159-169,
  208-222, 337-351, 439-449) that assert the two regimes currently produce the SAME observable
  edges/backlinks — these remain valid as regression tests but the "core-indexed" arm would now
  additionally exercise the (no-longer-skipped) fallback parse path underneath; test author should
  confirm assertions still hold once the parser also runs there (should be a no-op per the
  file's own "the two regimes must yield the same edge set" invariant, but worth running).
- **e2e dependency**: `e2e/canvasMarkdownLinkIndexing.e2e.ts` is explicitly "the only place where
  the core-indexed side is measured rather than [assumed]" (per its own header comment, `:14`) —
  this is the e2e test most load-bearing for 3a; it should keep passing since 3a makes fallback-parse
  universal rather than removing it.

---

## 7. EdgeVisibility / getLinkCount multiplicity — STALE in the ticket

**`EdgeVisibility.ts` does not exist in this repo.** `find`/`grep` confirm zero hits except a
literal JSON-parsing test fixture string `"all-edges"` in
`src/persistence/persistedShapes.test.ts:87`, which is testing that an OLD/unknown persisted
field (`edgeVisibility`) is correctly ignored on parse — it is NOT a live feature. `SettingsSpec.ts`'s
own comment (`:100-101`) confirms: *"a spec entry for a field that no longer exists
(`groupByFolder` / `edgeVisibility`, deleted by the previous ticket)"*. **The ticket's §5/§7
citations of `EdgeVisibility.ts:49-59` and its "all-edges induced sweep" are STALE** — that
mechanism was removed by an intervening ticket. There is currently no all-edges/induced-edge
concept to make channel-aware.

`getLinkCount` itself is current and unchanged in shape (`LinkProvider.ts:73`,
`ObsidianLinkProvider.ts:135-149`) — still the sole multiplicity authority, still kind-blind, still
only relevant if a future stage needs edges to visually/numerically distinguish link vs embed
(Stage 2, explicitly deferred past Stage 3 per D3). **Not required for Stage 1 or Stage 3** (depth
budgeting does not read `getLinkCount` at all — confirmed: no call site in
`VicinityTraversal.ts`; it's consumed downstream in `EdgeCounts`/graph assembly, outside traversal).

---

## 8. What would break — e2e, importGuard, test fakes

- **importGuard** (`src/engine/importGuard.test.ts`) — scans `src/engine/` + `src/shared/` for
  `obsidian`/`obsidian-id-lib`/`react` imports. Stage 1's `LinkKind` type belongs in
  `src/engine/types.ts` (pure) — no risk. Any canvas-kind-tagging logic must stay in
  `src/adapters/` (already true for `CanvasFallbackParser`/`ObsidianLinkProvider`).
- **e2e depth key/label breakage** (rename `outgoingDepth`→`linkDepthOut`,
  `incomingDepth`→`linkDepthIn`, add `embedDepthOut`) — every e2e file listed in §2's e2e bullet
  breaks on the JSON-key rename: `e2e/edgeRoutingEval.e2e.ts:102`, `e2e/edgeRouting.e2e.ts:62`,
  `e2e/controlsRestart.e2e.ts` (locator named `incomingDepthValue`, itself just a variable name —
  only the `.toHaveText` assertions against UI-label-derived values matter, not the fn name, but
  worth renaming for readability), `e2e/pinnedCentralScenario.e2e.ts` (`outgoingDepthValue`),
  `e2e/settingsResetReview.e2e.ts` (9 call sites building/asserting `{outgoingDepth, incomingDepth}`
  literals), `e2e/settingsUxVisual.e2e.ts` (4 call sites). `e2e/obsidianHarness.ts:58,389`
  (`saveGlobalDepths(depths: DepthSettings)`) needs no signature change (still whole-object) but
  every CALLER building the literal needs updating.
- **Unit test fakes/fixtures** needing the 3rd field or explicit non-participation once
  `DepthSettings` gains `embedDepthOut`: every file in §2's unit-test bullet list (14 files) —
  most use `Partial<DepthSettings>` fixture helpers (`truncationHarness.ts:33,68`,
  `VicinityTraversal.test.ts:9`) so they compile unchanged and simply default the new field; the
  ones building FULL literal objects (`settingsResetPlan.test.ts:37`, `persistedShapes.test.ts`
  fixtures, `GraphRequestAssembler.test.ts`) need the 3rd key added or the object type will fail to
  satisfy `DepthSettings` (required field) — this is itself a compile-time catch, not silent.
- **`FakeLinkProvider`** (`src/engine/FakeLinkProvider.ts`) has no kind concept at all today —
  Stage 1 requires deciding its fixture shape (see §4) before any traversal-level Stage-1/3 test
  can be written; this is the highest-leverage single file to design first.
- **`docs-internal/RELEASE_CHECKLIST.md`** — ticket's D2 requires a release-note line here
  announcing the destructive global-depth-key rename; not yet present (file not inspected in
  depth this pass, but ticket explicitly calls out this as a required mitigation step, not
  optional).
