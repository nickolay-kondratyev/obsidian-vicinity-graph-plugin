# Vicinity Graph

A richer replacement for Obsidian's native local graph. Instead of identical
dots, Vicinity Graph shows the neighbourhood of your active note as informative,
folder-grouped nodes — each one telling you what the note is before you open it.

![Vicinity Graph showing the neighbourhood of a note as folder-grouped, informative nodes with routed connectors](./assets/images/for_readme/vicinity-graph-example-2026-Aug-11.png)

## Why you'd want it

The native local graph makes every note look the same and shows no structure
between them. Vicinity Graph fixes both:

- **Nodes that actually tell you something.** Each node carries its title, a
  first-image thumbnail, an icon strip for its attachments, its folder, and a
  size that reflects relevance.
- **Folders you can see — nested.** Notes that share a folder render inside a
  labelled group box, and sub-folders draw as boxes **within** their parent's box,
  so folder membership (at every level) is part of the picture. A note whose own
  folder is too small to draw falls into the nearest folder that is.
- **Connectors that stay out of the way.** Links are drawn as calm, right-angled
  connectors that route *around* your notes instead of cutting across them, so a
  busy graph stays readable — and every connector is clickable (see below).
- **Depth you control per relationship.** Outgoing links, embedded notes and
  incoming links each get their own reach, adjustable right in the view.
- **Pinning — globally or per note.** Hold one or more neighbourhoods on screen
  while you browse elsewhere.

The view opens in the right sidebar by default (matching native local-graph
muscle memory) and can be dragged into the main area.

## Install

Vicinity Graph is in the **Obsidian community plugin store**. Requires Obsidian
**1.12.4** or newer.

### Community plugins (recommended)

1. **Settings → Community plugins**, and turn on community plugins.
2. **Browse**, search for **Vicinity Graph**, **Install**, then **Enable**.
3. Run the **Vicinity Graph: Open in right sidebar** command.

## Where the graph opens

Two commands, both bindable to a hotkey:

| Command | Places the graph |
|---|---|
| **Vicinity Graph: Open in right sidebar** | docked in the right sidebar |
| **Vicinity Graph: Open below active note** | in a main-area pane below the current tab |

There is only ever **one** graph view: running either command moves the graph
there; running the command for where it already is just focuses it.

## Interacting with the graph

- **Click a node** — it becomes the graph's **central** note, and its markdown
  opens in the current tab. **Ctrl/Cmd-click** opens the note in a new tab.
- **Click a connector** — opens a preview of **that relationship**: every place
  the source note links the target, each expandable to its surrounding context
  with a **GO** button that jumps the editor to that exact line.
- **Drag a node's right/bottom edge or corner** to resize it; the handles appear
  on hover. The new size is remembered for that note in every graph.
- **Right-click a node** — pin / unpin, plus *Reset size* on a note you resized.
- Folder-group boxes are containers, not notes — clicking one does nothing.

## Pinning

Pinning holds a note's neighbourhood on screen as an extra central node. There
are **two kinds**, each with its own control (revealed on hover, top-right, and
in the right-click menu):

- **Global pin** — pins the note into **every** graph, whatever your active note
  is. Use it to keep a hub or a note you're working from always in view.
- **Per-note (local) pin** — pins the note **only while a particular note is
  active** (*Pin for this note*). Switch away and it disappears; switch back and
  it returns. The target shows even if the active note has no link to it. A note
  can carry both kinds at once.

Both kinds survive restarts and are keyed to a stable note id, so renaming or
moving a pinned note keeps it pinned. Pinned centrals traverse with their own
depth budget (the *Pinned …* dials), separate from the active note's.

> Just after an Obsidian restart, a pinned central can briefly render as a plain
> node until the background cleanup sweep runs (~15s). The pin is not lost — only
> its accent lags.

## Folder-note hierarchy

If you keep **folder notes** (the *Folder Notes* community-plugin convention),
Vicinity Graph draws that structure too — no setting to turn on. A folder note is
recognised either way it's commonly written:

- **Beside the folder** — `Jon.md` sitting next to a folder `Jon/`.
- **Inside the folder** — `Jon/Jon.md`.

Either way, that note is the folder note of `Jon/`, and the notes inside `Jon/`
are its **descendants**; walking the other way, the folder note of the folder
that contains your note (and its folder note, and so on) are its **ancestors**.
The *Descendants* and *Ancestors* depth dials say how many folder levels to
follow — set either to 0 to switch it off. Deeper hops only continue through
sub-folders that have their own folder note.

A pure hierarchy relationship is drawn as a **dashed** connector (no count
badge), pointing from the folder note to the child. When the folder note *also*
links its child, the two collapse into the usual solid, badged link
connector — click it and the preview names both the link and the folder
relationship. (When both `Jon.md` and `Jon/Jon.md` exist, the inside one wins and
the sibling `Jon.md` is treated as an ordinary note.)

## Named relationships

An ordinary link is unlabelled — it just says *these two notes are connected*. A
**named relationship** adds the *kind* of connection, turning the graph into
something that can draw system diagrams and argument maps. Write the name before
a link with a `::`, exactly the way Breadcrumbs, ExcaliBrain and Juggl already
do, so a vault that already uses typed links works with no rewriting:

```
supports::[[Second law]]
```

In `First law.md` that reads *First law --supports--> Second law*, and the edge
in the graph is labelled **supports**. The name attaches to a link you already
have — it never hides or removes an edge, it only labels it — and the statement
can sit anywhere in a line; the surrounding prose is ignored. You can point at
several notes at once with a comma list (`up:: [[A]], [[B]]`) and name an
embed too (`shows::![[chart]]`).

There are three ways to write the name:

- **Bare** — `supports::[[note]]`. Simplest; the name is the word right before
  the `::`.
- **Bracketed, with an optional note** — `[supports:: [[note]] but not
  strongly]`. Wrapping the statement in `[…]` (or `(…)`) lets the name contain
  spaces, and any text after the target — here *but not strongly* — becomes a
  **qualifier** that rides along on the edge label. On the edge this reads
  `supports [X] but not strongly`, where `[X]` marks where the target note sits
  (the edge already points at it, so its title isn't repeated).
- **Relationship note** — `[[he supports]]::[[note]]`. When the name is itself a
  `[[wikilink]]`, that note *is* the relationship: the label is its title (or
  alias), and in the connector preview the name is a clickable link to it. The
  relationship note doesn't become its own dot on the graph just for being used
  this way — it only appears as a node where it's linked normally elsewhere.

**Frontmatter counts too.** A link-valued frontmatter property is a named
relationship whose name is the property key — `up: "[[parent]]"` draws an edge
labelled **up**. Lists (`up: ["[[a]]", "[[b]]"]`) name every entry. (This is the
built-in reading of link properties and is always on; it's separate from the
*Frontmatter links* setting below, which is about `id`-reference fields.)

On the graph the connector shows every name it carries; a small **+N** chip
appears if there are more names than fit, and clicking the connector opens a
preview listing them all — each with its qualifier, its surrounding context, and
a link to the relationship note where there is one.

Named relationships get **their own reach** — see the *Named links out* / *Named
links in* depth dials below — so you can follow a chain of `supports::` links
several hops deep without dragging every ordinary link along with it.

Statements inside **code** (fenced blocks or inline code) are ignored, so a `::`
in an example never mints a stray edge. Inline `::` statements in the leading
frontmatter block are ignored too — frontmatter is read through its properties
instead, as above.

## Settings

**Every setting is global** — one value used by every note and every open graph.
The only things remembered *per note* are the facts you set on it directly:
which notes are **pinned** and which you've **resized**.

Two surfaces edit the same values and stay in sync: the **settings tab**
(**Settings → Vicinity Graph**) and the in-view **Graph controls** panel.
Controls answer immediately — move a slider, toggle or field and the graph
redraws behind it.

The settings, grouped the same way on both surfaces:

- **Depth** — how far traversal reaches from each central note, with a separate
  budget for outgoing links, embedded notes, incoming links, **named links out**
  and **named links in** (named relationships — see above), and **descendants**
  and **ancestors** (folder-note hierarchy — see below) — and a second set of
  budgets for pinned notes. A depth of **0** turns that relationship off. Named
  links reach **2** hops out and **1** in by default (deeper than ordinary links,
  since named-link diagrams are the point); descendants and ancestors ship at
  **1** for the active note and **0** for pinned notes.
- **Grouping** — *Folder grouping depth* sets how many levels of nested folder
  groups render: **0** turns grouping off entirely, and the slider runs `1`–`10`
  and then **∞** (unlimited, the default). *Full folder path* labels a collapsed
  folder chain (a run of single-child folders drawn as one group) with its full
  path (`A/B/C`) instead of just the innermost folder name (off by default;
  groups that are not collapsed always show their folder name).
- **Node sizing** — each node fits what it shows between a minimum and maximum
  height, with an optional extra floor for image nodes. A size you set by
  dragging always wins.
- **Node contents** — a *Preview* pill choosing what a node shows: **Auto**
  (outline for your roots, first image for neighbours), **Title only**,
  **Outline** or **Image**, plus an *Outline depth* for how many heading levels
  an outline shows. Clicking an outline entry opens the note at that heading.
- **Edges** — *Show cross links* also draws links between two on-screen notes
  that traversal never walked (which notes are shown never changes, only the
  lines between them). *Edge depth into groups* sets how many nested-group levels
  an edge may reach into before collapsing onto the group box (**0** keeps every
  group edge collapsed).
- **Force layout** — sliders named like Obsidian's native graph (center, repel,
  link force, link distance) plus spacing and edge-clearance controls, each with
  a *Restore defaults* button.
- **Node exclusion** — keep whole classes of notes (index/MOC hubs, templates, a
  `rel/` folder) out of every graph via a regex pattern list. Your central and
  pinned notes always stay.
- **Frontmatter links** — *Id-reference fields* names the frontmatter fields
  (e.g. `deps`) whose values are read as references to another note's
  frontmatter `id`, and drawn as ordinary link edges — in **both** directions,
  so the referenced note also shows who points at it. Type a field name and
  press <kbd>Enter</kbd> to add it; each added field shows as a chip with its
  own **×** to remove it. Empty by default (the feature is off); it rides the
  same depth budgets as `[[wikilinks]]`.
- **Performance** — a node cap (default **100**, the readable ceiling); beyond it
  the graph truncates and shows a hidden-node count.

Typed fields (sizing numbers, node cap, patterns) apply once you pause typing or
leave the field, not per keystroke. Every section has its own *Restore defaults*
row, and **Restore all Vicinity Graph settings** at the bottom resets everything
— **your pinned notes are never touched by any of them**.

## Scope & limits

- **Local graph only** — no global graph, and no unresolved (ghost) links.
- **Layout is computed** — node positions aren't manually draggable-to-persist
  (dragging resizes; it doesn't move).
- **Outline entries jump to the first heading with that text**, so duplicate
  headings are ambiguous. `*.excalidraw.md` and canvas files show no outline.
- Heading labels strip common inline markdown but aren't a full renderer; the
  raw heading text is always what opens the note.

## Third-party notice

The right-angled connectors are routed by
[libavoid-js](https://github.com/Aksem/libavoid-js), a WebAssembly build of the
**libavoid** connector-routing library, licensed **LGPL-2.1-or-later**. It runs
entirely offline (no network, no disk) and only ever receives on-screen node
rectangles — never your note contents, paths, or metadata.

## Development

Building, testing, and cutting releases are covered in
[`docs-internal/development.md`](./docs-internal/development.md).

## License

Vicinity Graph is **source-available** under the **Kondratyev Source Available
License, Version 2.3 (KSAL-2.3)** — not an OSI open-source license. See
[`LICENSE.md`](./LICENSE.md), which is the authoritative and controlling text.
