# Ticket: human smoke run — the Preview pill in a REAL Obsidian, light AND dark

**Status:** OPEN — needs a human with a real Obsidian window and a real theme.
**Origin:** `node-content-preference` (deviation **B2** + the reviewer's trough question,
both recorded in `.ai_out/node-content-preference/node-content-preference/IMPLEMENTATION__PUBLIC.md`).

Everything functional about the pill IS automated (unit truth table +
`e2e/settingsUxVisual.e2e.ts` and `e2e/nodeOutline.e2e.ts` against a real Obsidian).
What automation cannot settle is whether the control **looks** right under a theme
nobody has tested, because the exact colours are the theme's business.

## Already measured in a real Obsidian 1.12.7, DEFAULT theme — do not re-derive

`settingsUxVisual.e2e.ts`'s "selected Preview segment is filled distinctly from the
trough" case resolves and logs the computed colours, and drops
`.out/settings-ux/preview-pill-{light,dark}.png`. Measured:

| | trough | selected fill | selected text | unselected text |
|---|---|---|---|---|
| dark | `rgb(42,42,42)` | `rgb(138,92,245)` | `rgb(255,255,255)` | `rgb(179,179,179)` |
| light | `rgb(255,255,255)` | `rgb(152,115,247)` | `rgb(255,255,255)` | `rgb(92,92,92)` |

So, in the DEFAULT theme: **`--text-on-accent` does resolve** (white, both themes), and
the trough is a genuine inset in dark (`#2a2a2a` over a `#1e1e1e` page) while in light it
equals the page colour. White-on-accent measures ≈3.4:1 — below WCAG AA for body text,
but it is Obsidian's OWN accent/`--text-on-accent` pairing, identical to every `.mod-cta`
button in the app, so changing it here would make our control the odd one out.

What is left for a human is therefore narrower than it looks: **a third-party theme**,
and the two taste calls below (items 3 and 4).

## What to look at

Open **Settings → Vicinity Graph → Node contents**, and the in-view graph controls'
**Node contents** disclosure. Do it once in **light** and once in **dark**, and once
under whatever community theme you actually use.

1. **`--text-on-accent` on the selected segment** (`src/view/segmented-control.css`) —
   **under YOUR theme.** This is the repo's FIRST use of that variable, so there is no
   shipped precedent. If a theme leaves it unset, the selected segment's label
   inherits `--text-muted` on an accent fill = unreadable. A fallback was deliberately
   NOT added: every plausible fallback (`--text-normal`) is also illegible on an accent
   fill in dark themes, so it would hide the bug instead of showing it. If a real theme
   breaks this, the fix is a different selected-state treatment, not a fallback colour.
2. **The trough, under your theme.** The unselected background is
   `--background-modifier-form-field` (a human decision, replacing
   `--background-primary`). Obsidian 1.12.7's `app.css` sets it to `--color-base-00` on
   `body` and `--color-base-25` in `.theme-dark`, which is why the default light theme
   leaves the pill framed only by its 1px border — exactly what Obsidian's own
   light-theme `input[type=text]` looks like. Confirm that reads as a control and not
   as plain text next to your theme's other inputs.
3. **The focus ring** (`.vicinity-graph-segmented:has(input:focus-visible)`) is
   `--interactive-accent`, the same colour as the selected fill. Tab to the group
   with `Auto` selected (the default, and the segment at the group's edge): the ring
   abuts the fill with only a 1px border between them. Judge whether that reads as
   focus. A `--text-accent`-toned ring or a 1–2px offset is the cheap fix.
4. **Panel width.** The panel is 260px and its segments are equal thirds
   (`flex: 1 1 0`). At a large UI font the labels ellipsise. Check "Outline" is
   still readable.
5. **Keyboard.** Tab must land on the group ONCE; ←/→ must move the selection AND
   apply it; a screen reader should announce "Preview, radio group, Auto, 1 of 3".

## Behavioural checks the dev vault is set up for

`scripts/setup-dev-vault.sh`'s printed checklist now includes these; the short version:

- **Outline** → `outline-cover.md`'s MAIN node swaps its image for its outline.
- **Image** → `outline-note.md`'s MAIN node swaps its outline for a thumbnail.
- **Auto** → both go back to what document position says.
- Flipping the pill must **not move any node** (it is a data-only refresh by design;
  `sizePx` does not depend on the preference).
- Flip it on the settings tab, then open the graph controls: the panel's pill must
  show the same value (and vice versa — one global, two surfaces).

## Record the result here

Append what you saw, per theme. If item 1 or 3 is bad, file a follow-up rather than
patching CSS inside this ticket.
