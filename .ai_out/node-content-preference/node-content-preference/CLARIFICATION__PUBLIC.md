# CLARIFICATION — node-content-preference (HUMAN-APPROVED)

Resolved directly with the human engineer before planning. These are
**binding requirements**; a deviation needs fresh human approval.

## Original task

> Allow users to smoothly choose whether they want to view outline when it's
> present and fits, or an image. Add a **PILL** setting for that choice, exposed
> in **both** the settings and the graph controls. This setting takes precedence
> over the previous rule of "show image if the image is before the outline".

## Q1 — Pill options → **3-way: `Auto` / `Outline` / `Image`** ✅

| Value | Meaning |
|---|---|
| `Auto` | **Today's rule, unchanged**: the image wins iff it sits before the first heading; otherwise the outline shows. |
| `Outline` | Prefer the outline whenever the note has headings (overrides document position). |
| `Image` | Prefer the first image whenever the note has one (overrides document position). |

**Rationale**: keeps the documented document-position escape hatch
(`high-level-plan.md:93`, `README.md:137-146`, `SettingsSpec.ts:118-124`,
`VicinityGraphSettingTab.ts:313-319` "no enable/disable toggle by design
(CLARIFICATION Q2)") alive as the `Auto` branch. **No previously supported
behavior is removed** ⇒ the `ObsidianLinkProvider` "image wins" behavior-capturing
tests keep asserting that rule; they may be *relocated* to wherever the `Auto`
branch ends up living, but their assertions must survive in substance.

The CLARIFICATION-Q2 docs are **superseded, not contradicted**: document position
still decides — under `Auto`. Docs must be updated to say exactly that.

## Q2 — Default → **`Auto` (preserve today's behavior)** ✅

Zero visible change on upgrade; users opt in. Default lives in
`SETTINGS_SPEC.globalView` like every other knob. Additive field with a spec
default ⇒ **do NOT bump `PERSISTED_SHAPE_VERSION`** (precedent: `outlineMaxDepth`).

## Q3 — Scope → **Global only** ✅

One vault-wide value on `globalView`. **Both surfaces edit the same global
value** — the settings-tab pill and the graph-controls pill are two views of one
setting, matching how Node sizing / Force layout controls already behave.
**No per-doc `ViewSettingsOverride` for this field.** (The resolver still needs
the field listed explicitly at `ViewSettingsResolver.ts:46-53`, since every
`ViewSettings` key must appear there.)

## Requirements the human did NOT need to decide (derived, but binding)

1. **Graceful fallback, always.** A preference expresses a *preference*, never a
   blank node: `Outline` with no headings ⇒ show the image if there is one;
   `Image` with no image ⇒ show the outline if there is one; neither ⇒ `none`.
   The pill must never make a node emptier than `Auto` would.
2. **"Fits" = the existing 104px container-query gate.** Do not invent JS
   height measurement. Overflow keeps scrolling as it does today.
3. **`sizePx` must NOT depend on the preference** — otherwise every toggle
   crosses `SIZE_RELAYOUT_THRESHOLD` and forces a full relayout.
   A flip must stay a data-only refresh, exactly like `outlineMaxDepth`.
4. **Precedence logic must be a pure, unit-testable function** (extend
   `src/view/nodePreviewChoice.ts`), per repo convention — there are no React
   component tests for `NoteNode`/`NodeOutline` to lean on.
5. **The adapter must stop discarding the outline.** Since `Auto` is now one
   branch among three, `ObsidianLinkProvider.outlineOf()` can no longer return
   `[]` to mean "the image won" — the outline must always be extracted, and the
   document-position *fact* must be carried downstream as data so the view can
   apply whichever branch the user picked. Adapter reports facts; the view decides.
6. **Both surfaces share data + write path, duplicate markup** — the established
   force-layout contract (`forceLayoutFieldMeta.ts` + `planSettingsWrite`), not a
   shared React component (Obsidian's `Setting` API cannot mount inside React).
7. **Docs to update**: `README.md` (user-facing model), 
   `docs-internal/plan/high-level-plan.md:93`, and the superseded code comments.
8. **Do not touch** the known-RED `linkStrengthFactor.max` baseline in
   `SettingsSpec.test.ts` (author-only per its ticket).
