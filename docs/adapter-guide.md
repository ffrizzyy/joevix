# Adapter guide (M4)

Adapters are small JSON files that name the sections of one site. They ship with the extension
and are validated at build time. There is no user-authored adapter path in v1 (ADR-7): an
adapter is code we reviewed, not input we accept.

## Shape

```json
{
  "id": "example-lyrics-site",
  "schemaVersion": 1,
  "match": ["https://example.com/*"],
  "container": "main",
  "sections": [
    { "key": "lyrics", "label": "Lyrics", "selector": "[data-lyrics]" },
    { "key": "info", "label": "Song info", "selector": ".song-info" },
    { "key": "related", "label": "Recommended", "selector": ".related", "defaultHidden": true }
  ]
}
```

## Selector rules

`isSafeSelector()` in `src/core/layout/sections.ts` is the gate. It rejects:

- `input`, `textarea`, `:checked`, `:target`, `[value` — form and value probing
- `:has(`, `attr(` — indirect attribute reads
- `url(`, `@import`, `{`, `}`, `;` — style injection
- `[href^=`, `^`, `$` — attribute-value matching

Keep selectors structural: tag, class, id, child and descendant combinators, `:nth-child`.

## Matching

`match` holds URL patterns, not full regular expressions. The only wildcard is `*`, and each
pattern needs a scheme and host: `https://genius.com/*-lyrics*`,
`https://*.genius.com/*-lyrics*`. A `*.` host matches one or more subdomains. Match on the
narrowest set of pages that actually has the sections; a broken match sends a lyric page down
the generic path.

## Build-time validation

`wxt.config.ts` imports the adapter registry, so `pnpm build`, `pnpm dev`, and `wxt prepare`
fail before bundling if an adapter is malformed. The same schema runs in
`tests/unit/adapter.test.ts`, and `parseAdapters()` re-checks the registry when the service
worker starts. Three layers, one schema.

## Bundled adapters

| Id       | Pages                    | Container | Sections                                 |
| -------- | ------------------------ | --------- | ---------------------------------------- |
| `genius` | `genius.com` lyric pages | `main`    | Song info, Lyrics, Recommended, Comments |

Genius splits a song into several `[data-lyrics-container="true"]` blocks, so the lyrics
section resolves to more than one element. Hiding works on the whole set; reordering does not,
because the blocks are nested and CSS `order` only moves direct children of the container. The
adapter reports that honestly through `reorderable` instead of moving DOM nodes (ADR-6).

## Container requirement for reordering

CSS `order` only works when the container lays out its children with flex or grid **and** the
section is a direct child. The layout engine checks this before offering drag and drop
(ADR-6). If the container cannot support it, the section is skipped with a notice rather than
moved in the DOM.

## Testing an adapter

```bash
pnpm test        # adapter schema, selector safety, and section detection
```

Save a trimmed copy of the page as a fixture under `tests/fixtures/` so tests never depend on
a live site. `tests/fixtures/genius-lyrics.html` is the reference: it keeps the real wrapper
classes and data attributes while dropping scripts, styles, and ads. Tests parse it with
`DOMParser` and run the same `detectSections()` the content script uses.
