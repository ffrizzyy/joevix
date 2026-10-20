# Adapters

One JSON file per site, plus `index.ts`, which parses the registry and matches URLs. Adapters
are bundled, reviewed, and validated at build time and in tests — there is no user-authored or
imported adapter path in v1 (ADR-7).

| File          | Site               |
| ------------- | ------------------ |
| `genius.json` | Genius lyric pages |

See `docs/adapter-guide.md` for the shape, matching rules, and the selector allowlist.
