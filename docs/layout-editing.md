# Layout editing (M5)

Edit mode is the only place where a page can be rearranged. It is entered from the popup's
**Edit layout** button, which is enabled when the site is on and a bundled adapter matches the
page.

## In the page

- Declared sections get a dashed outline and a floating label. The page stays interactive.
- A bar at the bottom holds **Done**, **Undo**, **Redo**, **Reset**, and **Sections**.
  **Sections** opens the list, which has a reading-width slider and one row per section.
- **Move up / Move down** buttons are the keyboard-equal alternative to dragging. Dragging a
  row onto another row in the same movable group reorders it. Only sections CSS can actually
  move are draggable; the rest can be hidden, and say so in a notice.
- **Hide / Show** writes the section to the saved `hidden` list. Hiding is always available.
- **Reset** returns the draft to adapter defaults, not to the last save.
- **Done** saves once, closes edit mode, and keeps the result. **Escape** leaves without
  saving and restores the last saved layout. Undo history is 20 steps and is cleared when the
  session ends (ADR-10).

## What is saved

Only three fields on the site record (spec 5.1):

| Field            | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `order`          | Adapter section keys; unknown keys are dropped on save       |
| `hidden`         | Subset of `order`                                            |
| `contentWidthPx` | Reading width, 480–1200; 720 leaves the page's own width alone |

The content script sends one typed `layout-save` message. The service worker re-resolves the
keys against the adapter, drops anything stale, writes storage, and resyncs open tabs for the
site. No selector or page content is stored. An order equal to the adapter's declared order is
stored as `[]`, so CSS `order` rules stay off until a section actually moves; this keeps
undeclared siblings in place.

## Why some sections cannot move

The engine never touches the DOM (ADR-6). CSS `order` reorders **direct children** of an
already flex or grid parent. A section is movable only when:

1. the adapter container computes to `display: flex` or `display: grid`, and
2. the section resolves to exactly one element, and
3. that element's parent is the container.

Everything else is hide-only. In practice, Genius lyric pages (the first bundled adapter) have
a block container and nested lyric blocks, so they support hide/show and width but not move.
The UI states this rather than silently doing nothing or forcing a layout change that could
break the page.

## Code map

| File                              | Role                                                 |
| --------------------------------- | ---------------------------------------------------- |
| `src/core/layout/editor.ts`       | Pure draft, history, move, hide, width transitions   |
| `src/core/layout/edit-ui.ts`      | Shadow-root bar, section list, drag, width slider    |
| `src/core/layout/sections.ts`     | `buildLayoutCss()` and selector safety               |
| `src/entrypoints/inject.ts`       | Session lifecycle, section marking, save message     |
| `src/entrypoints/background.ts`   | `start-edit` and sanitized `layout-save`             |

Unit tests cover the transitions, history cap, CSS scoping, width bounds, and the DOM
interactions (`tests/unit/editor.test.ts`, `edit-ui.test.ts`, `sections.test.ts`).

## Deferred

Layout presets (spec FR-24: single / two column / focus) and the spacing half of FR-25 are
not part of this milestone. A preset needs a cross-site definition that does not guess which
sections are "secondary"; hiding arbitrary content would break the no-surprises rule
(NFR-03). The reading width ships on its own.
