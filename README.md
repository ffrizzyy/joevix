# Joevix

Restyle and rearrange the pages you visit — on your own screen only. Joevix is a Manifest V3
browser extension with no network code, no accounts, and no analytics. Version **1.0.1** is the
current packaged release for Chrome, Edge, Brave, and Firefox.

The full specification is in [`joevix-extension-spec.md`](./joevix-extension-spec.md) (v0.2).

## Status

| Milestone | Contents                                                                             | State |
| --------- | ------------------------------------------------------------------------------------ | ----- |
| M0        | Repository, WXT, strict TypeScript, lint ban list, tokens, schemas                   | Done  |
| M1        | Built-in themes, CSS engine, no-flash boot, popup, per-site enable, generic fallback | Done  |
| M2        | Per-origin permissions, runtime registration, revocation, reset, cross-tab sync      | Done  |
| M3        | Color wheel, contrast matrix, custom themes                                          | Done  |
| M4        | Site adapters, build-time validation, section detection                              | Done  |
| M5        | Layout editing (reorder, hide, undo)                                                 | Done  |
| M6        | Import/export, delete-all, privacy panel, global off                                 | Done  |
| M7        | Accessibility, usability, E2E, hardening                                             | Done  |
| M8        | Release 1.0: security checklist, documentation, packaged builds, checksums           | Done  |

Known gaps in this build:

- Layout presets (FR-24) and the spacing half of FR-25 are not in this build. M5 ships edit
  mode, drag and keyboard reorder, hide/show, 20-step undo/redo, and the per-site reading width.
- Theme sync (FR-42) and the persistent A09 diagnostic ring buffer are deferred; **Copy
  diagnostics** is the v1.0 troubleshooting path.
- The automated accessibility suite passes, but human usability sessions and a manual
  screen-reader pass are still release-checklist items (see `docs/testing.md` and
  `docs/release-1.0.md`).

M8 shipped the 1.0.0 release: Trusted Types on extension pages, manifest policy checks, CodeQL
and Dependabot, a release packaging script with SHA-256 checksums, a security E2E suite, and the
release/rollback documentation. Version 1.0.1 adds the Joevix favicon and extension/action
icons. See [`docs/release-1.0.md`](./docs/release-1.0.md).

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
pnpm test             # Vitest unit and DOM tests
pnpm test:e2e         # builds a test copy, then Playwright + axe-core
pnpm check:manifest   # manifest permissions, CSP, and entry-point policy
pnpm check:size       # 250 KB package / 40 KB gzip content-script budget
pnpm package:release  # both ZIPs, manifest/size checks, SHA-256 checksums
pnpm icons            # regenerate favicon PNGs (requires Playwright Chromium)
pnpm audit --audit-level high
pnpm lint             # ESLint, including the banned-API list
```

## Install a release build

Download `joevix-1.0.1-chrome.zip` or `joevix-1.0.1-firefox.zip` from the
[latest release](https://github.com/ffrizzyy/joevix/releases/latest), verify it against
`SHA256SUMS.txt`, then unzip it.

- **Chrome / Edge / Brave:** open `chrome://extensions`, enable **Developer mode**, choose
  **Load unpacked**, and select the unzipped folder.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**,
  and select `manifest.json`. Firefox removes temporary add-ons when it closes; a signed build
  would require store publication, which is out of scope for v1.0.

Verify a download:

```powershell
Get-FileHash .\joevix-1.0.1-chrome.zip -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

```bash
sha256sum -c SHA256SUMS.txt
```

To build from source instead, run `pnpm build` (Chrome) or `pnpm build:firefox`, then load
`.output/chrome-mv3` or `.output/firefox-mv3` the same way.

Open the popup on any `https` page and use the switch to grant access to that site only. On
first install the popup shows three theme previews. Pick one to set the default for future
sites, or skip and keep the system theme. Nothing is written until you choose.

## Keyboard shortcuts

| Shortcut      | Action                                      |
| ------------- | ------------------------------------------- |
| `Alt+Shift+J` | Open the Joevix popup                       |
| `Alt+Shift+E` | Start or cancel layout editing on this page |
| `Alt+Shift+T` | Cycle to the next theme on this site        |

Remap them at `chrome://extensions/shortcuts` (Firefox: `about:addons` → gear → Manage Extension
Shortcuts). A site must be enabled and have host access before a shortcut can act on it.

## Diagnostics

**Copy diagnostics** in the popup footer copies a short text report: extension version, site,
adapter id and version, how many sections were found, and the labels of missing sections. It
contains no page text and makes no request.

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
- **Layout is CSS only.** Edit mode outlines adapter sections in an open shadow root, then saves
  `order`, `hidden`, and `contentWidthPx` per site. Sections move through CSS `order` only when
  the adapter container is already flex or grid; no node is ever moved (ADR-6). Reorder, hide,
  and width changes have a 20-step undo history until **Done** is pressed.
- **Custom themes** are edited against a live preview pushed to open Joevix pages. Cancel calls
  `end-preview` and restores each site's saved theme; Save writes the theme and resyncs every tab.
- **No network code.** ESLint bans `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon`, dynamic `Image`, `eval`, `new Function`, string timers, and HTML sinks. The E2E
  suite also asserts that the extension issues no request outside the page's own origin.
- **Extension pages enforce Trusted Types** (`require-trusted-types-for 'script'`,
  `trusted-types 'none'`) on top of a strict CSP with `connect-src 'none'`.
- **Interface language** follows `navigator.language`: English and Bahasa Indonesia ship; other
  languages fall back to English. Built-in theme names are translated, custom names are not.
- **Accessibility** is checked with axe-core on the options and popup pages, including a 320px
  viewport, keyboard tab navigation, focus-visible rings, forced-colors rules, and live-region
  announcements while sections move, hide, or show.

## Security and release verification

The threat model, reporting process, and supported versions are in [`SECURITY.md`](./SECURITY.md).
Every release runs type checking, lint, unit and E2E tests, axe audits, `pnpm audit`, CodeQL, a
manifest policy check, and the size budget. `pnpm check:manifest` verifies that both built
manifests keep only `storage`, `activeTab`, and `scripting`, keep `content_scripts` and
`web_accessible_resources` empty, and use the spec CSP.

Release archives are produced by `pnpm package:release`, which writes
`releases/v<version>/`, `SHA256SUMS.txt`, and `release.json`. See
[`docs/release-1.0.md`](./docs/release-1.0.md) for the 1.0.0 evidence table, manual checks, and
rollback procedure. The 1.0.1 patch only adds the icon set and its manifest policy check.

## Privacy

Everything stays in `chrome.storage.local` under four keys: `joevix:meta`, `joevix:settings`,
`joevix:themes`, `joevix:sites`. No page text, no history, no identifiers, no requests.
See [`docs/privacy.md`](./docs/privacy.md).

## Project layout

```
src/entrypoints/   background, inject (content), popup, options
src/core/          pure TypeScript: model, color, contrast, css, site, layout, storage
src/ui/            shared tokens and helpers
src/adapters/      bundled per-site adapters (JSON + registry)
public/            favicon and generated extension/action icons
tests/unit/        Vitest unit and jsdom tests
tests/e2e/         Playwright extension tests and axe audits
docs/              privacy policy, adapter guide, layout editing, testing, release record
releases/          local packaged artifacts and checksums (git-ignored)
```
