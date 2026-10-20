# Joevix

Restyle and rearrange the pages you visit — on your own screen only. Joevix is a Manifest V3
browser extension with no network code, no accounts, and no analytics.

The full specification is in [`joevix-extension-spec.md`](./joevix-extension-spec.md) (v0.2).

## Status

| Milestone | Contents | State |
|---|---|---|
| M0 | Repository, WXT, strict TypeScript, lint ban list, tokens, schemas | Done |
| M1 | Built-in themes, CSS engine, no-flash boot, popup, per-site enable, generic fallback | Done |
| M2 | Per-origin permissions, runtime registration, revocation, reset, cross-tab sync | Done |
| M3 | Color wheel, contrast matrix, custom themes | Done |
| M4 | Site adapters | Planned |
| M5 | Layout editing (reorder, hide, undo) | Planned |
| M6 | Import/export, delete-all, privacy panel, global off | Done |
| M7 | Accessibility, usability, E2E, hardening | Planned |

Known gaps in the current build:

- Adapters and layout editing (M4/M5). `buildLayoutCss` and the selector allowlist exist and are
  tested, but no adapter ships yet, so **Edit layout** is disabled with an explanation.
- The first-run welcome card (spec 7.1) is not drawn yet; the popup opens straight to the
  per-site enable prompt.
- Playwright end-to-end tests are not wired up yet (unit coverage is 91 tests).

## Requirements

- Node 20+ (developed on Node 24)
- pnpm 9+

## Commands

```bash
pnpm install
pnpm dev              # Chrome with hot reload
pnpm build            # production build in .output/chrome-mv3
pnpm build:firefox    # .output/firefox-mv3
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest unit tests
pnpm lint             # ESLint, including the banned-API list
```

## Loading the extension

1. `pnpm build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select `.output/chrome-mv3`

Open the popup on any `https` page and use the switch to grant access to that site only.

## How it works

```
popup / options  --typed, Zod-validated messages-->  service worker
                                                        |
                                     storage + permissions + registration
                                                        |
                                     validated commands  v
                                                   content script (inject.js)
                                                   CSS custom properties on <html>
```

- **Storage is service-worker only.** The content script never touches `chrome.storage`
  or `permissions` (ADR-11).
- **Content scripts are registered per origin at runtime.** The manifest declares
  `content_scripts: []`, so the extension has no standing access to any site (spec 8.3).
- **Theming is CSS custom properties** scoped under `html[data-joevix="on"]`, applied through a
  constructed stylesheet. Reset removes one sheet and one attribute.
- **Custom themes** are edited against a live preview pushed to open Joevix pages. Cancel calls
  `end-preview` and restores each site's saved theme; Save writes the theme and resyncs every tab.
- **No network code.** ESLint bans `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon`, dynamic `Image`, `eval`, and `innerHTML`.

## Privacy

Everything stays in `chrome.storage.local` under four keys: `joevix:meta`, `joevix:settings`,
`joevix:themes`, `joevix:sites`. No page text, no history, no identifiers, no requests.
See [`docs/privacy.md`](./docs/privacy.md).

## Project layout

```
src/entrypoints/   background, inject (content), popup, options
src/core/          pure TypeScript: model, color, contrast, css, site, layout, storage
src/ui/            shared tokens and helpers
src/adapters/      bundled per-site adapters (M4)
tests/unit/        Vitest
docs/              privacy policy, adapter guide
```
