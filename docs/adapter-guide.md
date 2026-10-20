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

## Container requirement for reordering

CSS `order` only works when the container lays out its children with flex or grid **and** the
section is a direct child. The layout engine checks this before offering drag and drop
(ADR-6). If the container cannot support it, the section is skipped with a notice rather than
moved in the DOM.

## Testing an adapter

```bash
pnpm test        # adapter schema and selector safety
```

Save the page as a fixture under `tests/fixtures/` so tests never depend on a live site.
