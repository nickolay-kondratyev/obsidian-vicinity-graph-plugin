# DETAILED PLAN — settings descriptor model (ticket 2, `nid_wimjq4ewgbg21n4zx9d4qq3a0_e`)

Status: ready for PLAN_REVIEWER. Author: PLANNER.
Binding inputs: `CLARIFICATION__PUBLIC.md` (D1/D2 not re-litigated), the three
`EXPLORATION_PUBLIC__*.md` reports, `docs-internal/notes/settings.md`,
`docs-internal/architecture-map.md`, `CLAUDE.md`.

Every type-level mechanism below was **compiled against the real `tsc`** with this
repo's flags (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`,
`noImplicitReturns`) before being written down. Results are in §8.

---

## 0. Executive summary — what I recommend and what I decline

**D3 decision: three per-family key spaces, one table per family, no unified
"cascade strategy" abstraction.** The three families do not share a cascade, do
not share an override type, and (critically) do not share a *key space*. A
unified list would have to be a heterogeneous union that every consumer narrows
by hand — and narrowing by hand is exactly the silent hole the ticket exists to
close. Details and the rejected alternatives: §2.

**Placement decision:** machine-facing descriptor data (defaults, bounds, spec
completeness) stays in `src/engine/SettingsSpec.ts`; the persistence
completeness guard is a *type* in `src/persistence/persistedShapes.ts`; the new
**section → field-key map** lands in a new `src/view/settingsSectionFields.ts`.
No labels, no descriptions, no "sections" enter `src/engine/`. Rationale: §3.

**Three things I decline, with reasons (§7):**

1. **Deriving `ViewSettings` (the type) from a runtime descriptor array.** That is
   the only way to reach the ticket's literal "ONE declaration", and it costs the
   per-field doc comments, IDE hover quality, `isolatedModules` cleanliness, and
   — decisively — it *weakens* `ViewSettingsResolver.resolve()`'s return-type
   guarantee, which CLARIFICATION constraint 5 forbids. I deliver
   **compile-forced N declarations** instead: adding a field still touches
   several sites, but the compiler *names every site you missed*. The failure
   mode this ticket exists to kill is **silent** drift, and compile-forced is
   not silent.
2. **Merging `forceLayoutFieldMeta.ts` + `nodePreviewPreferenceMeta.ts` into one
   file** (one reading of D1). They are keyed by `keyof ForceLayoutSettings` and
   by `NodePreviewPreference` — neither is `keyof ViewSettings`. There is no
   `keyof ViewSettings`-keyed row-copy table to fold them into, because
   **`sizing` and `forceLayout` are one field each but many rows each** — the
   row space is not the field space. Merging three unrelated key spaces into one
   module is an SRP regression that buys nothing. The two D1 items that *do*
   have a home (`settingsResetPlan`, `sizingMetrics`) are folded in. **Flagged
   for reviewer sign-off**, not blocking.
3. **DRY-ing `EngineDefaults.forceLayoutSettings()` against
   `clampForceLayoutSettings()`** (the 7 field names, twice). Both are already
   return-type-forced — they are duplication, not *silent* duplication.
   Collapsing them requires an `Object.fromEntries(...) as ForceLayoutSettings`
   cast, i.e. trading a compile guarantee for brevity. Wrong trade for this
   ticket.

**Honest framing of "start with a failing test":** the repo is *currently
consistent* — every `ViewSettings` field is parsed, specced and reset today. The
holes are **latent**: they bite the next time a field is added. So there is no
red-because-broken behaviour test to write, and I will not manufacture one. What
I do deliver, ordered:

- one test that is **red because the code it guards is genuinely wrong today** —
  `ForceLayoutSection`'s restore button being a fourth copy of the force-layout
  defaults (Step 1, §5);
- **red-because-new** TDD for the new `settingsSectionFields` module;
- **compile-level** guards proven (§8) to fire and to *name the missing field*.

---

## 1. Problem restated

Adding one settings field today means editing ~8 hand-maintained parallel lists.
Three of them fail **silently** (the compiler is happy, the feature is quietly
half-wired):

| # | Site | Why silent today |
|---|---|---|
| 1 | `src/persistence/persistedShapes.ts:135-158` `parseViewOverride` | Returns `ViewSettingsOverride` = `Partial<ViewSettings>`; a missing property is legal. A new field's persisted value is dropped on load, forever. |
| 2 | `src/view/settingsResetPlan.ts` section scopes | `_assertEveryResetScopePlaced` guards *scope placement*, nothing guards *field coverage*. A new field can be absent from every section reset. |
| 3 | `src/view/sizingMetrics.ts` `SIZING_METRICS` | An order-bearing `readonly SizingMetricLabel[]`, not a `Record<SizeMetricId, …>`. A missing metric is not a compile error. (A runtime test does catch it — see §6.) |

Two more, found during planning, same root cause and closed here for free:

| # | Site | Why silent today |
|---|---|---|
| 4 | `src/engine/SettingsSpec.ts` `ViewSpec` / `DepthSpec` / `NodeExclusionSpec` | Independent interfaces, not mapped over the settings types. A new `ViewSettings` field needs no spec entry to compile — so it has no default and no bounds. **Root of the family**: if the spec is incomplete, everything downstream is. |
| 5 | `src/engine/constants.ts:172` `type SizingRangeField = "metricWeight" \| …` | Hand-typed union, not derived from `SizingSpec`. A new bounded sizing field silently gets no range and no clamp. |

And one live structural defect (not silent, just wrong):

| # | Site | Defect |
|---|---|---|
| 6 | `src/view/ForceLayoutSection.tsx:53-60` | The panel's "Restore defaults" calls `EngineDefaults.forceLayoutSettings()` directly — a **fourth** independent copy of "what the force-layout defaults are", bypassing `SETTINGS_RESET_SCOPES["force-layout"].plan`. Values are identical today, so this is structural only. |

### Constraints (binding, restated so no step forgets them)

- **Absent override = inherit**, tested with `!== undefined`, never truthiness.
  A pinned `0` / `false` stays pinned. Primary constraint.
- **`sizing` / `forceLayout` are atomic** units of `ViewSettings`. The unit of
  resolution is `keyof ViewSettings` (5 entries) — never "every leaf number".
- **`ViewSettingsResolver.resolve()` is not to be weakened.** It is untouched by
  this plan. Not one line.
- **Engine purity** (`src/engine/importGuard.test.ts`) and
  **`view → adapters → engine`** layering.
- **No user-facing copy changes, no CSS class renames.** `e2e/selectorGuard.test.ts`
  is a tripwire under `npm test`.
- **No `PERSISTED_SHAPE_VERSION` bump** — no persisted shape changes here.

---

## 2. D3 — family shape: the decision and the alternatives

### 2.1 The three families are not three instances of one thing

| Family | Key space | Override type | Cascade | Reset write |
|---|---|---|---|---|
| `ViewSettings` (5) | `keyof ViewSettings` | `Partial<ViewSettings>` | main → ranked pinned → global | `global-view` (whole object) |
| `DepthSettings` (2) | `keyof DepthSettings` | `DepthOverride` | own-doc → global (no ranking) | `global-depths` |
| `NodeExclusionSettings` (2) | `keyof NodeExclusionSettings` | — none — | none (global only) | `node-exclusion` |

Three key spaces, three override types, three cascades, three persistence
commands. The only thing genuinely shared is the *idiom* ("a key set, guarded to
be total"), which is three lines of TypeScript.

### 2.2 Option A — one unified descriptor list with a declared cascade strategy — REJECTED

```ts
// The shape this forces:
type SettingsFieldDescriptor =
  | { family: "view";      key: keyof ViewSettings;           cascade: "main-pinned-global"; … }
  | { family: "depth";     key: keyof DepthSettings;          cascade: "own-global"; … }
  | { family: "exclusion"; key: keyof NodeExclusionSettings;  cascade: "none"; … };
const SETTINGS_FIELDS: readonly SettingsFieldDescriptor[] = [ … ];
```

Fatal objection: **it cannot produce the completeness guard the ticket asks
for.** `parseViewOverride`'s guard has to be keyed by `keyof ViewSettings`. From
a flat heterogeneous array you get there only via
`SETTINGS_FIELDS.filter(d => d.family === "view")` — a *runtime predicate*. A
wrong or stale predicate does not fail to compile. The unified list would
therefore reintroduce, at the descriptor layer, exactly the silent hole it was
built to close.

Secondary objections: it invents a `cascade` strategy abstraction with exactly
three instances, two of which have 1–2 fields (over-generalisation, YAGNI); and
every consumer narrows the union by hand before it can do anything useful, which
is more ceremony than the tables it replaces.

### 2.3 Option B — three per-family tables — **RECOMMENDED**

Each family's table is a `Record`/mapped type over *its own* `keyof`, so
completeness is enforced by TypeScript with zero runtime machinery — the pattern
that **already works** in this repo at `ForceLayoutSpec`
(`SettingsSpec.ts:67`), `FORCE_LAYOUT_RANGES` (`constants.ts:151`),
`FORCE_LAYOUT_FIELD_META` and `NODE_PREVIEW_OPTION_META`.

Against the ticket's acceptance criterion — *"adding a new field requires
editing ONE declaration"*: within a family, yes. Ticket 6 adds `embedDepthOut`,
a **depth** field: one entry in the depth spec, one entry in the depth key list
of the owning section, one parse expression — and the compiler names each one
you skip (§8 proves it, with the error messages). Cross-family generality would
buy nothing, because no workflow ever adds "a field of an unknown family".

Against DRY: the three tables share no *knowledge*, only a 3-line type idiom.
DRY is about knowledge duplication, not syntactic similarity — and I explicitly
decline to extract the idiom into a generic helper (§7.4) because doing so
degrades the compiler's error message, which is the entire point of the guard.

Against SRP: one table = one family = one cascade = one reason to change. ✔

### 2.4 Option C — extend `SETTINGS_SPEC` entries into full descriptors carrying `parse` — REJECTED

Tempting (it is the closest thing to "one declaration per field"), and I costed
it seriously. Rejected because it drags ~80 lines of **persistence recovery
policy** into the pure engine. "A partially-mangled persisted `sizing` object is
repaired field-by-field from defaults rather than dropped" is a statement about
*disk content recovery*, not about the graph domain. Moving it into
`src/engine/` would also require an `isRecord` predicate there and would blur a
currently clean split:

- **engine owns**: what a *valid value* of this field is (bounds, clamps, enum
  membership). Already true — `clampOutlineMaxDepth`, `clampSizingSettings`,
  `NODE_PREVIEW_PREFERENCES` all live in the engine and persistence imports them.
- **persistence owns**: what a *valid JSON shape* is, and what to do with a
  mangled one.

The guard can be a **type** that crosses the boundary at zero runtime cost
(§4.2). That gets 100% of the safety at 0% of the layering damage.

---

## 3. Placement — where the descriptor data lives, and why

```
src/engine/SettingsSpec.ts          defaults + bounds + spec-completeness guards   (machine-facing)
src/engine/constants.ts             SizingRangeField derived from the spec
src/engine/types.ts                 DepthOverride := Partial<DepthSettings>
        │  (type-only knowledge flows outward; nothing flows in)
        ▼
src/persistence/persistedShapes.ts  parse-completeness guard as a MAPPED TYPE over keyof ViewSettings
        ▲
src/view/settingsSectionFields.ts   NEW: section → field-key map + coverage guards (UI-facing)
src/view/settingsResetPlan.ts       reset plans DERIVED from the section map
src/view/sizingMetrics.ts           + compile guard
src/view/{forceLayout,nodePreview}…Meta.ts   unchanged, stay focused (§7.2)
```

**Why the section map is view-layer, not engine-layer.** A "section" is one of
the six settings-tab *cards*. The pure graph engine has no notion of a settings
card and must not acquire one. The import guard would *permit* the strings
(they are plain data), but the layering rule forbids the concept: `src/engine/`
is the graph core, not the settings UI. `view → engine` is the legal direction,
so the view can freely key its tables off `keyof ViewSettings`.

**Why the parse guard is persistence-layer.** It is a mapped type over an
engine-owned key space, declared where the parser lives. Types have no runtime
representation, so this creates no import inversion and no coupling the layering
rule cares about — `persistedShapes.ts` already imports `ViewSettings` from
`../engine`.

**Explicit statement for the reviewer:** no label, no description, no section
name, and no React/Obsidian reference is added anywhere under `src/engine/` or
`src/shared/`. `src/engine/importGuard.test.ts` stays green by construction, and
this plan adds **zero new imports** to the engine.

---

## 4. The concrete TypeScript

### 4.1 Engine — spec completeness (closes hole #4), derived sizing range keys (hole #5)

`src/engine/SettingsSpec.ts` — append after the section shapes:

```ts
/**
 * Compile-time completeness of the SPEC itself — the root of the settings
 * family. A settings field with no spec entry has no default and no bounds, so
 * every table downstream (defaults, ranges, clamps, reset plans) is built on
 * sand. Both directions are guarded because BOTH have bitten this repo:
 * a field with no spec entry, and a spec entry for a field that no longer
 * exists (`groupByFolder` / `edgeVisibility`, deleted by ticket 1).
 *
 * The error names the offending key, e.g.
 *   Type 'true' is not assignable to type '"embedDepthOut"'.
 *
 * NOTE: only TOP-LEVEL keys are compared. `SizingSpec` deliberately carries an
 * extra `metricWeight` (bounds shared by every metric's weight) that has no
 * `SizingSettings` counterpart, so a leaf-level guard would false-positive.
 */
type UnspeccedSettingsField =
	| Exclude<keyof ViewSettings, keyof ViewSpec>
	| Exclude<keyof DepthSettings, keyof DepthSpec>
	| Exclude<keyof NodeExclusionSettings, keyof NodeExclusionSpec>;
export const _assertEverySettingsFieldSpecced: UnspeccedSettingsField extends never
	? true
	: UnspeccedSettingsField = true;

/** The reverse: a spec entry whose settings field was deleted (an orphan default). */
type OrphanSpecField =
	| Exclude<keyof ViewSpec, keyof ViewSettings>
	| Exclude<keyof DepthSpec, keyof DepthSettings>
	| Exclude<keyof NodeExclusionSpec, keyof NodeExclusionSettings>;
export const _assertNoOrphanSpecField: OrphanSpecField extends never ? true : OrphanSpecField = true;
```

This needs `ViewSettings`, `DepthSettings`, `NodeExclusionSettings` added to the
existing `import type { … } from "./types"` — all engine-internal, no new
dependency edge.

`src/engine/constants.ts:172` — one line, hole #5:

```ts
/**
 * The bounded sizing fields — DERIVED from the spec, so a new bounded sizing
 * field fails to compile in `SIZING_RANGES` below until it is given a range.
 * (`metrics` carries defaults only; its weights are bounded by `metricWeight`.)
 */
type SizingRangeField = Exclude<keyof SizingSpec, "metrics">;
```

(`SizingSpec` becomes a type-only import from `./SettingsSpec`, which
`constants.ts` already imports from.)

### 4.2 Persistence — parse completeness (closes hole #1), the inherit rule in ONE place

`src/persistence/persistedShapes.ts`:

```ts
/**
 * THE inherit rule, implemented exactly once: a field reaches the override only
 * when its parsed value is `!== undefined`. Never truthiness, never `||` — a
 * pinned `0` / `false` / `""` is a PIN, not an absence. Every per-field
 * `definedOnly(...)` spread this replaced was an independent chance to get that
 * wrong.
 */
function definedFieldsOnly<T extends object>(values: { readonly [K in keyof T]: T[K] | undefined }): Partial<T> {
	const defined: Record<string, unknown> = {};
	for (const key of Object.keys(values)) {
		const value = (values as Record<string, unknown>)[key];
		if (value !== undefined) {
			defined[key] = value;
		}
	}
	// Safe by construction: every surviving key/value pair came out of `values`,
	// whose type is `T`'s own key space. TS cannot follow that through `Object.keys`.
	return defined as Partial<T>;
}

/**
 * Every {@link ViewSettings} field's parsed value, `undefined` where the raw
 * object holds nothing usable. **This mapped type IS the completeness guard**:
 * the properties are REQUIRED (only their values may be `undefined`), so a new
 * `ViewSettings` field that no branch below parses is a compile error naming it —
 * instead of a persisted value that silently never round-trips through disk.
 */
type ParsedViewFields = { readonly [K in keyof ViewSettings]: ViewSettings[K] | undefined };

function parseViewOverride(raw: unknown): ViewSettingsOverride {
	if (!isRecord(raw)) {
		return {};
	}
	const outlineMaxDepth = numberOrUndefined(raw["outlineMaxDepth"]);
	const parsed: ParsedViewFields = {
		nodeCap: numberOrUndefined(raw["nodeCap"]),
		// Clamped with the SAME function the slider uses, so hand-edited JSON cannot
		// reach 0 (a silent off-switch the feature does not have) or an undefined level.
		outlineMaxDepth: outlineMaxDepth === undefined ? undefined : clampOutlineMaxDepth(outlineMaxDepth),
		// Unrecognized values (hand-edited JSON, a downgrade from a future version)
		// fall through as absent, so the spec default applies.
		nodePreviewPreference: NODE_PREVIEW_PREFERENCES.find(
			(preference) => preference === raw["nodePreviewPreference"],
		),
		sizing: parseSizing(raw["sizing"]),
		forceLayout: parseForceLayout(raw["forceLayout"]),
	};
	return definedFieldsOnly<ViewSettings>(parsed);
}

/** Keeps only recognized, correctly-typed depth fields (absence = inherit). */
function parseDepthOverride(raw: unknown): DepthOverride {
	if (!isRecord(raw)) {
		return {};
	}
	return definedFieldsOnly<DepthSettings>({
		outgoingDepth: numberOrUndefined(raw["outgoingDepth"]),
		incomingDepth: numberOrUndefined(raw["incomingDepth"]),
	});
}
```

Note what did **not** change: every per-field parse rule keeps its exact
behaviour and its exact WHY comment (drop-vs-clamp for `outlineMaxDepth`,
repair-then-clamp for the two composites, enum membership for the preference).
`definedOnly` stays in the file — `parseDocData` still uses it for
`depths`/`view`/`centralDepths`, which are *sub-objects*, not fields of a
settings family.

`src/engine/types.ts` — `DepthOverride` becomes derived, mirroring
`ViewSettingsOverride = Partial<ViewSettings>`:

```ts
/**
 * Partial per-doc depth override (absence = inherit the global default).
 * `Partial<DepthSettings>` rather than a parallel interface, for the same reason
 * {@link ViewSettingsOverride} is: the two shapes then cannot drift field-for-field.
 */
export type DepthOverride = Partial<DepthSettings>;
```

`keyof DepthOverride` (used by `DIRECTION_DEPTH_FIELD` and
`SettingsCommand.field`) is unchanged by this.

### 4.3 View — the section → field-key map (closes hole #2)

New file `src/view/settingsSectionFields.ts`:

```ts
import type { DepthSettings, NodeExclusionSettings, ViewSettings } from "../engine";

/**
 * WHICH SETTINGS FIELDS BELONG TO WHICH SETTINGS SECTION — the one structural
 * fact both the settings tab's six cards and their scoped "Restore defaults"
 * buttons are built from.
 *
 * Split by FAMILY, not flattened: the three families cascade differently, carry
 * different override types and land in different persistence commands
 * (`global-view` / `global-depths` / `node-exclusion`). Flattening them would
 * force every consumer to re-derive the family with a runtime predicate, and a
 * runtime predicate is exactly the kind of unguarded branch this table exists
 * to eliminate.
 *
 * View-layer on purpose: a "section" is a settings-tab CARD. The pure engine has
 * no notion of one and must not acquire it (architecture-map layering).
 */

/** The six settings sections, in settings-tab render order. */
export const SETTINGS_SECTIONS = [
	"depth-defaults",
	"node-sizing",
	"node-contents",
	"force-layout",
	"node-exclusion",
	"performance",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** The settings keys one section owns, per family. */
export interface SectionSettingsFields {
	readonly view: readonly (keyof ViewSettings)[];
	readonly depth: readonly (keyof DepthSettings)[];
	readonly exclusion: readonly (keyof NodeExclusionSettings)[];
}

/**
 * "This section owns no field of that family." Spelled out rather than made
 * optional: an OPTIONAL family key cannot be read by the completeness guard
 * below (indexed access on a union whose members lack the property is an error),
 * and the guard is the whole point of the table.
 */
const NO_FIELDS = [] as const;

export const SECTION_SETTINGS_FIELDS = {
	"depth-defaults": { view: NO_FIELDS, depth: ["outgoingDepth", "incomingDepth"], exclusion: NO_FIELDS },
	"node-sizing": { view: ["sizing"], depth: NO_FIELDS, exclusion: NO_FIELDS },
	"node-contents": { view: ["outlineMaxDepth", "nodePreviewPreference"], depth: NO_FIELDS, exclusion: NO_FIELDS },
	"force-layout": { view: ["forceLayout"], depth: NO_FIELDS, exclusion: NO_FIELDS },
	"node-exclusion": { view: NO_FIELDS, depth: NO_FIELDS, exclusion: ["enabled", "patterns"] },
	performance: { view: ["nodeCap"], depth: NO_FIELDS, exclusion: NO_FIELDS },
} as const satisfies Readonly<Record<SettingsSection, SectionSettingsFields>>;

/**
 * Compile-time completeness: a settings field that belongs to NO section has no
 * scoped restore-defaults affordance and no home in the tab. It surfaces here as
 * a type error naming the orphaned field, e.g.
 *   Type 'true' is not assignable to type '"embedDepthOut"'.
 *
 * (`as const satisfies` above is what preserves the literal key tuples this
 * reads; a plain type annotation would widen them to `keyof …[]` and make the
 * guard vacuously true.)
 */
type SectionedField<TFamily extends keyof SectionSettingsFields> =
	(typeof SECTION_SETTINGS_FIELDS)[SettingsSection][TFamily][number];

type UnsectionedSettingsField =
	| Exclude<keyof ViewSettings, SectionedField<"view">>
	| Exclude<keyof DepthSettings, SectionedField<"depth">>
	| Exclude<keyof NodeExclusionSettings, SectionedField<"exclusion">>;

export const _assertEverySettingsFieldSectioned: UnsectionedSettingsField extends never
	? true
	: UnsectionedSettingsField = true;
```

### 4.4 View — reset plans derived from the section map

`src/view/settingsResetPlan.ts`:

```ts
/** `current`, with every listed key restored from `defaults`. Siblings untouched. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function restoreFields<T extends object>(current: T, defaults: T, keys: readonly (keyof T)[]): T {
	// The cast only strips `readonly` off a generic; every write below is to a key
	// of T with a value of T's own type for that key.
	const restored = { ...current } as Mutable<T>;
	for (const key of keys) {
		restored[key] = defaults[key];
	}
	return restored;
}

/**
 * The commands one SECTION's reset emits, derived from the section's declared
 * key set. Whole-object writes with the untouched fields carried over, exactly
 * as `planSettingsWrite` does — merging here keeps sibling sections
 * byte-identical across a reset.
 *
 * Emission order is view → depth → exclusion. It is observable: `applyReset`
 * awaits each command in turn, and each is a full `data.json` rewrite. Every
 * section today owns fields of exactly ONE family, so this order is the order
 * the hand-written plans already produced.
 */
function planSectionReset(section: SettingsSection, ctx: SettingsWriteContext): readonly SettingsCommand[] {
	const fields = SECTION_SETTINGS_FIELDS[section];
	const commands: SettingsCommand[] = [];
	if (fields.view.length > 0) {
		commands.push({
			kind: "global-view",
			view: restoreFields(ctx.globalView, EngineDefaults.viewSettings(), fields.view),
		});
	}
	if (fields.depth.length > 0) {
		commands.push({
			kind: "global-depths",
			depths: restoreFields(ctx.globalDepths, EngineDefaults.depthSettings(), fields.depth),
		});
	}
	if (fields.exclusion.length > 0) {
		commands.push({
			kind: "node-exclusion",
			nodeExclusion: restoreFields(ctx.nodeExclusion, EngineDefaults.nodeExclusionSettings(), fields.exclusion),
		});
	}
	return commands;
}
```

Each of the six section entries in `SETTINGS_RESET_SCOPES` then becomes
`plan: (ctx) => planSectionReset("<section>", ctx)`. **Label, description and
confirmation are untouched — byte-identical.**

`SettingsResetScope` becomes derived, which makes the six-scope union and the
six-section list structurally the same thing:

```ts
export type SettingsResetScope = SettingsSection | typeof ALL_SETTINGS_RESET_SCOPE;

/** Re-exported under its established name so every existing import keeps working. */
export const SECTION_RESET_SCOPES = SETTINGS_SECTIONS;
```

`_assertEveryResetScopePlaced` **stays** (it becomes tautological, costs
nothing, and removing a guard needs a reason better than "it can no longer
fail").

**`all` stays bespoke** — whole-slice writes, not a merge:

```ts
	all: {
		…
		// Whole-slice writes (NOT a merge, and NOT derived from the section map):
		// this is the belt-and-braces scope. Deriving it would make it only as
		// complete as the section map, which is precisely the thing it exists to
		// be independent of.
		plan: () => [ …unchanged… ],
```

### 4.5 View — `SIZING_METRICS` compile guard (closes hole #3)

`src/view/sizingMetrics.ts` — the annotation becomes `as const satisfies`, plus
the standard guard:

```ts
export const SIZING_METRICS = [
	{ id: "own-file-size", label: "Own file size" },
	…unchanged…
] as const satisfies readonly SizingMetricLabel[];

/**
 * Compile-time completeness: a metric missing from the list would silently
 * vanish from BOTH sizing surfaces. It surfaces here as a type error naming it.
 * (The unit test additionally catches a metric listed TWICE — which a type
 * guard cannot see.)
 */
type UnlistedMetric = Exclude<SizeMetricId, (typeof SIZING_METRICS)[number]["id"]>;
export const _assertEverySizingMetricListed: UnlistedMetric extends never ? true : UnlistedMetric = true;
```

### 4.6 View — the panel's restore button through the shared plan (fixes #6)

`src/view/ForceLayoutSection.tsx`:

```tsx
	/**
	 * The SAME plan the settings tab's "Restore force layout defaults" row runs —
	 * never `EngineDefaults.forceLayoutSettings()` directly, or the panel becomes a
	 * second opinion on what a force-layout default is.
	 *
	 * WHY-NOT `planSettingsResetConfirmation` too: the panel has no confirm modal.
	 * The force-layout scope declares no confirmation (pinned by a unit test in
	 * `settingsResetPlan.test.ts`), so nothing is being skipped.
	 */
	const restoreDefaults = async (): Promise<void> => {
		for (const command of planSettingsReset("force-layout", ctx)) {
			await actions.applySettings(command);
		}
	};
```

with `onClick={() => void restoreDefaults()}`. Class name, `title`, and button
text are **unchanged** — `e2e/selectorGuard.test.ts` and every e2e locator stay
green.

Produced command, before vs after — identical:

```
before: planSettingsWrite({kind:"global-force-layout", forceLayout: EngineDefaults.forceLayoutSettings()}, ctx)
      → { kind:"global-view", view: { ...ctx.globalView, forceLayout: <defaults> } }
after:  planSettingsReset("force-layout", ctx)
      → [{ kind:"global-view", view: restoreFields(ctx.globalView, defaults, ["forceLayout"]) }]
      = { kind:"global-view", view: { ...ctx.globalView, forceLayout: <defaults> } }
```

**No behavioural change** — as CLARIFICATION predicted. The sequential `await`
loop is a fourth hand-rolled serial chain; that is ticket 3's territory and the
existing DRY ticket `nid_4zffe7mj5p1eabi9m6wfh06k0_e` — noted, not fixed here.

---

## 5. Sequenced steps

Each step leaves the tree compiling and `npm test` green (except Step 1, which
is deliberately red until Step 2). Redirect verbose output: `npm run check >
.tmp/check.log 2>&1`.

| # | Step | Kind | Depends on |
|---|---|---|---|
| 1 | **RED**: add the force-layout-defaults single-source tripwire test | design-bearing | — |
| 2 | **GREEN**: route `ForceLayoutSection`'s restore through `planSettingsReset` | mechanical | 1 |
| 3 | Engine: spec-completeness guards; `SizingRangeField` derived; `DepthOverride := Partial<DepthSettings>` | mostly mechanical, one small design call | — |
| 4 | Persistence: `definedFieldsOnly` + `ParsedViewFields` mapped-type guard | **design-bearing** (the inherit invariant) | 3 |
| 5 | View: `SIZING_METRICS` `as const satisfies` + compile guard | mechanical | — |
| 6 | View: new `settingsSectionFields.ts` + its tests | **design-bearing** | — |
| 7 | View: `settingsResetPlan.ts` derives section plans from the map | **design-bearing** | 6 |
| 8 | Docs + change log + ticket | mechanical | 1–7 |

### Step 1 — RED: the only genuinely broken thing today

New `src/view/forceLayoutDefaultsSingleSource.test.ts`, in the repo's
established source-scan idiom (`importGuard.test.ts`, `selectorGuard.test.ts`,
`thumbnailDensityThreshold.test.ts`, `vaultTarget.test.ts`):

- **RED today**: `ForceLayoutSection.tsx` calls `EngineDefaults.forceLayoutSettings()`.
- Allowlist with a per-entry WHY, so the guard is self-documenting rather than
  arbitrary:
  - `settingsResetPlan.ts` — THE reset plan; this is the single source.
  - `GraphLayoutRunner.ts:26` — a *parameter default* for a rendering fallback,
    not a settings write. (Verified: those are the only two legitimate callers.)
- Second test: the scan finds ≥ 1 view file (non-vacuous guard) — same
  discipline as `importGuard.test.ts`.

Tests (BDD, one behaviour each):
1. `WHEN src/view is scanned THEN only the allowlisted modules read the force-layout defaults directly`
2. `WHEN the scan runs THEN it finds at least one view module (the guard is not vacuous)`

> This test is **optional-but-recommended**. If PLAN_REVIEWER judges a tripwire
> disproportionate for one call site, strike it and keep Step 2 — the structural
> fix stands on its own. But then the ticket has *no* red-first test, and that
> should be an explicit choice, not an accident.

### Step 2 — GREEN: `ForceLayoutSection` restore through the shared plan
Per §4.6. Plus, in `settingsResetPlan.test.ts` (additive):
3. `WHEN the force-layout scope's confirmation is read THEN it is absent (the in-graph panel applies this scope with no confirm dialog)` — a tripwire so a confirmation added later cannot be silently skipped by the panel.

Verify: `npm test` (Step 1 now green), `npm run check`.

### Step 3 — Engine guards
Per §4.1 + `DepthOverride` per §4.2. Nothing else in the engine changes.
`ViewSettingsResolver.ts` is **not touched**.
Verify: `npm run check` (must be green — the guards only fire when something is
missing, and nothing is missing today), `npm test`.

### Step 4 — Persistence parse guard (design-bearing)
Per §4.2. Depends on Step 3 (`definedFieldsOnly<DepthSettings>` returns
`Partial<DepthSettings>`, which must *be* `DepthOverride`).

Additive tests in `src/persistence/persistedShapes.test.ts`:
4. `WHEN a persisted view override pins nodeCap to zero THEN the parsed override keeps the zero (presence = pinned)` — the view-side twin of the existing depth zero-pin proof at `settingsResolvers.test.ts:38-40`.
5. `WHEN a persisted view override omits a field THEN the parsed override omits its key (absence = inherit)`
6. `WHEN a persisted view override carries every ViewSettings field THEN every field survives parsing` — driven off `Object.keys(EngineDefaults.viewSettings())`, so it is the *runtime* companion to the compile guard and grows by itself.

Green today (tests 4–6 pin existing behaviour); their job is to make the
refactor provably behaviour-preserving.

### Step 5 — `SIZING_METRICS` guard
Per §4.5. Existing `sizingMetrics.test.ts` must stay green unchanged.
Watch: `e2e/settingsDependentRows.e2e.ts:47-49` indexes `SIZING_METRICS[0]`; as a
const tuple that is now non-nullable, so its `if (!METRIC_UNDER_TEST) throw`
guard becomes structurally unreachable. It still compiles — **leave it alone**
(touching e2e here would violate D1's "no e2e churn" signal).

### Step 6 — `settingsSectionFields.ts` (design-bearing)
Per §4.3. Nothing consumes it yet, so the tree compiles.

New `src/view/settingsSectionFields.test.ts` — **red because the module is
new** (honest TDD, not a bug fix):
7. `WHEN the section map is read THEN every ViewSettings field appears in exactly one section`
8. `WHEN the section map is read THEN every DepthSettings field appears in exactly one section`
9. `WHEN the section map is read THEN every NodeExclusionSettings field appears in exactly one section`
10. `WHEN the section list is read THEN it matches the settings-tab reset scopes`

Tests 7–9 add what the compile guard **cannot** see: a field listed in *two*
sections (which would make two cards both claim to own it).

### Step 7 — reset plans derived (design-bearing)
Per §4.4. **The acceptance test for this step is that
`src/view/settingsResetPlan.test.ts` stays 100% green with zero edits** — it
already pins every section's exact emitted command against a fully-tuned
context. If an assertion has to move, the refactor changed behaviour: **stop and
escalate** (§6).

Additive test:
11. `WHEN every section reset is applied to a fully-tuned context THEN together they restore every ViewSettings field to its default` — the coverage property stated behaviourally, complementing the compile guard.

### Step 8 — docs
- `docs-internal/notes/settings.md`: mark holes 1–3 closed, record the two extra
  holes found (spec completeness, `SizingRangeField`), and record the D2
  deferral so ticket 6 is not surprised.
- `docs-internal/architecture-map.md`: one line for `settingsSectionFields.ts` if
  the map enumerates view modules (check at implementation time).
- `change_log` entry; close the ticket; TOP_LEVEL_AGENT closes the moot
  sub-ticket `nid_3k0a4zl6in0mj8lcjibkjq2dx_e`.
- **No release-note "stored data reset" entry** — no persisted shape changed and
  `PERSISTED_SHAPE_VERSION` is not bumped.

Suggested commits: one per step (Step 1+2 may be one commit so the tree is never
committed red).

---

## 6. Blast radius — every existing test, and what happens to it

**Headline: this plan proposes changing ZERO existing assertions.** Every
behaviour-capturing test must stay green *unedited*. That is the plan's own
correctness proof.

| Existing test | Expectation | Why |
|---|---|---|
| `src/view/settingsResetPlan.test.ts` (309 l.) | **Unchanged, green** | The literal per-scope command baselines against `TUNED_CTX` are exactly what proves Step 7 preserved behaviour. Deliberately kept out of `as const` narrowing (see risk R2). |
| `src/view/sizingMetrics.test.ts` | **Unchanged, green** | Runtime coverage + duplicate detection; complements, does not duplicate, the new compile guard. |
| `src/persistence/persistedShapes.test.ts` | **Unchanged + 3 additions** | Round-trip, clamp, repair, zero-depth-survives, removed-field-dropped all keep passing — the per-field parse rules are moved, not altered. |
| `src/engine/SettingsSpec.test.ts` | **Unchanged, green** | Baselines defaults/limits; the new guards are additional exports it does not enumerate. |
| `src/engine/settingsResolvers.test.ts` | **Unchanged, green** | `ViewSettingsResolver` / `TraversalSettingsResolver` are not touched at all. |
| `src/engine/forceLayoutSettings.test.ts`, `sizingSettings.test.ts` | **Unchanged, green** | `EngineDefaults` / clamps untouched (§7.3). |
| `src/engine/importGuard.test.ts` | **Unchanged, green** | Zero new engine imports. |
| `src/view/forceLayoutFieldMeta.test.ts`, `nodePreviewPreferenceMeta.test.ts`, `settingsWriteScope.test.ts`, `ControlsActions.test.ts` | **Unchanged, green** | Those modules are not modified. |
| `e2e/settingsBaseline.test.ts` | **Unchanged, green** | Reset labels/descriptions byte-identical; `SECTION_RESET_SCOPES` keeps its name and order via re-export. |
| `e2e/selectorGuard.test.ts` | **Unchanged, green** | No CSS class added, renamed or removed. |
| `e2e/*.e2e.ts` (Playwright) | **Unchanged** | No copy change, no row change, no count change. |
| `e2e/settingsDependentRows.e2e.ts` | **Unchanged**, one now-dead guard branch | See Step 5. Compiles; deliberately not touched. |

**Escalation rule for IMPLEMENTATION (non-negotiable):** if you find yourself
editing an assertion in *any* pre-existing test file, **stop**. Either the
refactor changed behaviour (a bug — fix the refactor) or a genuine behaviour
change is required (needs explicit human approval before proceeding). Do not
quietly re-baseline. A test edited to match new output is the exact failure mode
`CLAUDE.md` names as the worst lie.

**New files:** `src/view/settingsSectionFields.ts`,
`src/view/settingsSectionFields.test.ts`,
`src/view/forceLayoutDefaultsSingleSource.test.ts`.

---

## 7. Explicit non-goals and declines

### 7.1 Not in this ticket — belongs to the chain

| Deferred to | What |
|---|---|
| **Ticket 3** (write/refresh pipeline) | `PluginDataStore.persist` read-modify-write race; reset-vs-queued-write ordering; the serial promise chains (incl. the new one in `ForceLayoutSection`, and existing DRY ticket `nid_4zffe7mj5p1eabi9m6wfh06k0_e`). |
| **Ticket 4** (dual presenters) | Rewriting `VicinityGraphSettingTab.display()` / `GraphToolbar` to iterate descriptors. A `keyof ViewSettings`-keyed ROW copy table (and the tab-vs-panel copy divergences: "Exclude notes from the graph" vs "Exclude notes", the missing outline-depth panel row, the missing panel descriptions). Panel confirmation modal; panel restore buttons for the other five sections. |
| **Ticket 5** (spec-driven tests) | Replacing the e2e literal baselines — `MIN_NAMED_CONTROLS = 26`, the reset isolation matrix, `SECTION_CARD_HEADINGS`, `CONTROLS_PANEL_DISCLOSURES` — with descriptor-iterating assertions; the tab-vs-panel parity test. |
| **Ticket 6** (embed-depth field) | **D2: the `linkDepthOut` / `embedDepthOut` / `linkDepthIn` rename stays deferred.** `outgoingDepth` / `incomingDepth` and their UI copy are unchanged here. |

**Handoff note for ticket 6** (cost measurement baseline). After this ticket,
adding one new **view** field costs these edits — and the compiler names every
one you skip except the last:

1. `src/engine/types.ts` — the field on `ViewSettings` *(compile-forces 2–4)*
2. `src/engine/SettingsSpec.ts` — `ViewSpec` entry + `SETTINGS_SPEC` value *(guarded)*
3. `src/persistence/persistedShapes.ts` — one parse expression *(guarded)*
4. `src/view/settingsSectionFields.ts` — one key in one section *(guarded)*
5. UI copy + row rendering in the tab and (if mirrored) the panel *(ticket 4's job to guard)*

A new **depth** field (which is what `embedDepthOut` is) costs the same shape
against `DepthSettings` / `DepthSpec` / `parseDepthOverride` / the
`depth-defaults` section.

### 7.2 Declining the file-merge reading of D1 — needs reviewer sign-off

D1 lists four "shared view meta tables" to fold in. Two are folded:
`settingsResetPlan` (→ the section map drives its plans) and `sizingMetrics`
(→ compile guard). I decline to merge `forceLayoutFieldMeta.ts` and
`nodePreviewPreferenceMeta.ts` into a single module:

- They are keyed by `keyof ForceLayoutSettings` and by `NodePreviewPreference`.
  **Neither is `keyof ViewSettings`**, so neither can join a field-descriptor
  table — they are *leaf* metadata below an atomic field.
- There is no `keyof ViewSettings`-keyed row-copy table to fold them into,
  because **the row space is not the field space**: `sizing` is one field and
  eight rows; `forceLayout` is one field and seven rows. A
  `Record<keyof ViewSettings, {label, description}>` would be a category error
  for exactly those two.
- Both are already single-source and compile-exhaustive. Merging three unrelated
  key spaces into one module trades SRP ("keep files focused") for a shorter
  file list.

Cost of the decline: none that I can find. Anything ticket 4 needs from them, it
imports from where they live today.

### 7.3 Declining the `EngineDefaults.forceLayoutSettings()` / `clampForceLayoutSettings()` DRY
Both hand-list the same 7 field names. Both are **return-type-forced** — a
missing field is already a compile error, so this is duplication, not *silent*
duplication. Collapsing them needs
`Object.fromEntries(...) as ForceLayoutSettings`, trading a compile guarantee
for brevity. Wrong direction for a ticket whose entire thesis is compile-time
guards. Same reasoning for `ViewSettingsResolver.resolve()`'s 5-field literal —
**and CLARIFICATION constraint 5 forbids touching it anyway.**

### 7.4 Declining a generic helper for the `_assertEvery…` idiom
The idiom appears 3 more times after this ticket. Wrapping
`Exclude<…> extends never ? true : Exclude<…>` in a generic alias would make the
compiler report the alias instead of the missing key name. §8 shows the error
messages naming `"embedDepthOut"` — that legibility *is* the feature.

### 7.5 Not doing
- No `PERSISTED_SHAPE_VERSION` bump; no persisted shape change; no migration.
- No `SettingsInteraction` / `SettingsCommand` union change.
- No `GraphBuildRequest` change (exploration §5.9 — a 4th parallel surface, but
  adapters never enumerate field names, so nothing here reaches it).
- No `Setting.setDynamicTooltip()` removal (CLARIFICATION 6).
- No CSS, no copy, no e2e edits.

---

## 8. Risks, and the evidence against each

Every mechanism below was compiled with this repo's exact flags before being
proposed. Probes are in `.tmp/scratch/` (throwaway).

| # | Risk | Mitigation / evidence |
|---|---|---|
| R1 | The mapped type `{ [K in keyof ViewSettings]: T \| undefined }` might not force keys present, making the parse guard vacuous | **Verified.** Omitting a key errors: `TS2741: Property 'embedDepthOut' is missing in type … but required in type 'ParsedViewFields'`. (`exactOptionalPropertyTypes` is OFF in this repo, which does not affect *required* properties.) |
| R2 | `as const satisfies` over-narrowing a table breaks `===` comparisons in existing tests — e.g. `settingsResetPlan.test.ts:269` compares `label === "Restore defaults"`, which TS rejects as "no overlap" once labels are literal types | **Designed around.** `SETTINGS_RESET_SCOPES` keeps its current annotation; the literal tuples live only in the new `SECTION_SETTINGS_FIELDS`. This is the main reason the section map is a *separate* table rather than a `resets` field on the existing one. |
| R3 | `restoreFields`'s readonly-strip cast on a generic | One documented cast; every write is `T[K] = T[K]`. **Verified compiling**, returns `ViewSettings` (no `Partial` leakage). Chosen over `{...current, ...pick(defaults, keys)}` precisely to avoid relying on TS's `Partial`-spread inference. |
| R4 | `noUncheckedIndexedAccess` making `SECTION_SETTINGS_FIELDS[section]` `\| undefined` | **Verified** not an issue: `section` is a literal union and the object has all those keys, so no `undefined` is introduced. `fields.view.length` and the `readonly (keyof ViewSettings)[]` widening both compile. |
| R5 | `isolatedModules` breaking type re-exports | All new types are `export type` / local; `SECTION_RESET_SCOPES = SETTINGS_SECTIONS` is a value binding. No `export { SomeType } from` added. |
| R6 | The coverage guard being **vacuously true** (`SectionedField` collapsing to `never` or to `string`) | **Verified both directions**: it accepts today's complete map and, with an unhandled `embedDepthOut` added, fails as `TS2322: Type 'true' is not assignable to type '"embedDepthOut"'`. Additionally back-stopped by runtime tests 7–9, which also catch double-listing (invisible to the type guard). |
| R7 | Empty `NO_FIELDS` arrays breaking the guard | **Verified**: `(readonly [])[number]` is `never`; `never` in a union is absorbed. Guard stays sound. |
| R8 | `definedFieldsOnly`'s `Partial<T>` return not assignable to `DepthOverride` | Fixed by Step 3 (`DepthOverride := Partial<DepthSettings>`). **Step 4 must not land before Step 3.** |
| R9 | Reset command *order* changing (observable — `applyReset` awaits each in sequence, each a full `data.json` rewrite) | Every section owns exactly one family today, so the derived order is byte-identical. The chosen view→depth→exclusion order is documented in code for the day a section spans families. Pinned by the unchanged `settingsResetPlan.test.ts` `.map(c => c.kind)` assertions. |
| R10 | The `all` scope silently becoming "only as complete as the section map" | Deliberately **not** derived. Whole-slice writes retained, with the WHY-NOT in code. |
| R11 | `SIZING_METRICS` tuple-narrowing breaking a consumer | `SizingSection.tsx` / `VicinityGraphSettingTab.ts` destructure `{id, label}` — narrower types are strictly more permissive at those call sites (`id` becomes a literal used to index `metrics`). `e2e/settingsDependentRows.e2e.ts` gets one dead guard branch (Step 5) — compiles, left alone. |
| R12 | The source-scan tripwire (Step 1) going stale / false-positive | Bounded: one symbol, one directory, an explicit allowlist with a WHY per entry, plus a non-vacuity test. Same idiom as four existing scans. Marked optional so the reviewer can strike it. |
| R13 | Engine purity regression | Zero new imports in `src/engine/`; zero UI strings added there. `importGuard.test.ts` green by construction. |
| R14 | Scope creep into ticket 4 via "descriptor drives the rows" | Hard boundary stated in §7.1/§7.2: no row-copy table, no renderer change. The one renderer edit (§4.6) swaps a defaults source and touches no markup, class, or text. |

---

## 9. Acceptance criteria

**Automated (all under `npm test` + `npm run check`):**

- A1 `npm run check` is green — and, per §8, a `ViewSettings` field added without
  a spec entry / parse branch / section entry makes it **red, naming the field**.
  (Reviewer may verify with a throwaway field; do not commit one.)
- A2 Tests 1–2 (force-layout single source): red before Step 2, green after.
- A3 Tests 7–10 (section map): red before Step 6, green after.
- A4 Tests 3–6, 11: green.
- A5 **Every pre-existing test file passes with zero edits** (§6).
- A6 `e2e/selectorGuard.test.ts` and `e2e/settingsBaseline.test.ts` green,
  unedited.
- A7 `npm run test:e2e` unaffected — no copy, count, class or row changed. (Run
  it if the environment allows; it is the release gate, not the fast gate.)

**Structural (reviewable, not automated):**

- A8 `parseViewOverride` no longer contains a hand-enumerated property list that
  can be short; `!== undefined` presence semantics appear in exactly one function.
- A9 `EngineDefaults.forceLayoutSettings()` has exactly two callers in
  `src/view/` (the reset plan and the layout-runner parameter default).
- A10 No label/description/section string exists under `src/engine/`.

---

## 10. Open questions

None blocking. Two items want a reviewer opinion, both argued above and both
safe to proceed on if the reviewer is silent:

- **Q-A (§7.2)** — I decline the file-merge reading of D1 for
  `forceLayoutFieldMeta` / `nodePreviewPreferenceMeta`, on the grounds that the
  row space is not the field space. If the owner intended a literal file merge,
  say so and I will re-plan that slice — but I believe it would be an SRP
  regression that ticket 4 then has to undo.
- **Q-B (§5, Step 1)** — the source-scan tripwire is the ticket's only genuinely
  red-first test. Keep it (recommended) or accept that the ticket has none.
