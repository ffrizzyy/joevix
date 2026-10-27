# Testing (M8)

## Commands

```bash
pnpm typecheck
pnpm lint
pnpm test          # Vitest: unit, schema, jsdom
pnpm test:e2e      # builds .output/e2e-chrome, then Playwright + axe
pnpm check:manifest # built manifest policy for Chrome and Firefox
pnpm check:size    # after a production build
pnpm audit --audit-level high
```

`pnpm test:e2e` runs `wxt build` and `scripts/make-e2e-extension.mjs`. It uses Playwright's
bundled Chromium (`channel: 'chromium'`), not the system browser, because branded Chrome builds
may ignore `--load-extension` in automation.

## Test build

Playwright cannot click a native host-permission prompt. The test script copies
`.output/chrome-mv3` to `.output/e2e-chrome` and changes **only the manifest**:

- adds `host_permissions: ["https://genius.com/*"]`;
- adds a `content_scripts` entry for the same origin, so the page script runs without runtime
  registration.

Everything else (service worker, schemas, adapters, popup, options) is the production bundle.
The patch lives in `scripts/make-e2e-extension.mjs` and never touches `.output/chrome-mv3`.

The lyric fixture is served by `context.route()` at
`https://genius.com/Queen-bohemian-rhapsody-lyrics`, so the bundled Genius adapter matches
without a local server or real network. Subresources are fulfilled with `204`.

## Coverage

| Spec file               | What it proves                                                               |
| ----------------------- | ---------------------------------------------------------------------------- |
| `theme.spec.ts`         | Enable, system scheme, cross-tab sync, global off, font size, reset          |
| `edit.spec.ts`          | Reorder, hide, width, Done persistence, Escape restores the saved layout     |
| `accessibility.spec.ts` | axe-core on options and popup, 320px width, arrow-key tabs, focusable import |
| `shortcuts.spec.ts`     | All three commands registered; `edit-toggle` starts and cancels a session    |
| `security.spec.ts`      | Hostile-page isolation, edit-host text, imports, reset, delete-all, SPA      |
| `design.spec.ts`        | Motion timing, press feedback, hover gating, reduced-motion behavior         |

The browser-level shortcut keypresses themselves cannot be dispatched from Playwright; the
suite checks registration plus the command handler's content-script path. Remap and press the
keys manually when changing the manifest commands.

## axe-core

`runAxe()` loads `axe-core/axe.min.js` with `page.addInitScript`, which runs outside the page CSP.
It reloads and audits the options page and an inactive popup tab. The popup tab is opened with
`chrome.tabs.create({ active: false })` after activating the fixture tab, so its active-tab query
sees the lyric page. The audit must return zero WCAG A/AA violations.

## Size budget

`scripts/check-size.mjs` sums the Chrome/Firefox output and gzips `inject.js`:

- package: **250 KB** (NFR-01);
- content script: **40 KB gzip**.

The build currently has roughly 4 KB of package headroom. Re-run the script after adding an
adapter or a dependency; CI fails if either limit is crossed.

## Design and motion

`tests/e2e/design.spec.ts` checks the built extension against the motion rules in
[`docs/design.md`](./design.md): no `transition: all`, no UI transitions or animations over
300ms, visible press feedback, hover styles scoped to fine pointers, and reduced motion that
keeps color transitions while dropping movement.

## Security checks

`pnpm lint` enforces the banned-sink and network lists in `eslint.config.js`. The E2E suite adds
runtime evidence:

- the page has no extension runtime messaging handle;
- an edit-mode shadow root contains adapter labels, not page text;
- oversized and CSS-injecting imports are rejected without persisting data;
- no dynamic content script exists before the site is granted;
- reset removes the adopted stylesheet and unregisters the script;
- the theme returns after a site strips the `html` attribute;
- the theme flow makes no request outside the page origin.

`pnpm check:manifest` locks the built manifests to the spec: exact permission sets, empty
`content_scripts` and `web_accessible_resources`, no wildcard `<all_urls>`, the strict CSP plus
Trusted Types, the extension/action icon entries, and the correct Firefox
background/optional-permission keys. CI runs `pnpm audit --audit-level high`; CodeQL and
Dependabot run alongside CI.

## Still manual

- Five-person usability test from spec 7.5.
- Screen-reader pass with NVDA or VoiceOver (edit bar, live announcements, focus restoration).
- Windows High Contrast / forced-colors visual check.
- Firefox install and permission flow; the Playwright suite is Chromium-only.
- Real Chrome/Firefox shortcut UI remapping.
