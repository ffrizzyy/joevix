# Joevix 1.0.0 release record

Build date: 2026-10-20

Status: 1.0.0 packaged and tagged. The automated release gates pass; human usability and
screen-reader checks are still open and are listed below. This is a local, unsigned developer
release. Store publication is out of scope for v1.0.

## Artifacts

| File                       | Browser                         |
| -------------------------- | ------------------------------- |
| `joevix-1.0.0-chrome.zip`  | Chrome, Edge, Brave (128+)      |
| `joevix-1.0.0-firefox.zip` | Firefox (128+)                  |
| `SHA256SUMS.txt`           | SHA-256 for both archives       |
| `release.json`             | Version, build time, file sizes |

SHA-256:

```text
b4377ac63df8765fc08c2731f0d44e5a84fd3ffebb9cc6dbaa994c2366d0b7a9  joevix-1.0.0-chrome.zip
4448fe71c31aa74efa1b9edca9e2c203b8d040e0e9c0a057951fe576b6107c92  joevix-1.0.0-firefox.zip
```

Build them locally with:

```bash
pnpm install
pnpm package:release
```

The archives are written to `releases/v1.0.0/`. The release workflow repeats the full test
suite and uploads the same files when a `v*` tag is pushed.

## Install from a release zip

1. Unzip the archive for your browser.
2. Chrome/Edge/Brave: open `chrome://extensions`, enable **Developer mode**, choose
   **Load unpacked**, and select the unzipped folder.
3. Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**,
   and select `manifest.json` inside the unzipped folder.

Firefox temporary add-ons are removed when the browser closes. A signed build would be needed
for persistent installation; signing is part of store publication and is not done here.

## Automated release evidence

| Gate                                | Result                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| TypeScript strict type check        | Pass                                                             |
| ESLint, including banned APIs       | Pass                                                             |
| Unit / DOM / fuzz tests             | 146 tests in 19 files pass                                       |
| Playwright end-to-end               | 20 tests pass                                                    |
| axe-core WCAG A/AA                  | Zero violations on options and popup, including 320px            |
| Dependency audit                    | `pnpm audit --audit-level high` reports no known vulnerabilities |
| Manifest policy, Chrome and Firefox | `pnpm check:manifest` passes                                     |
| Package size                        | 236.4 KB Chrome / 236.5 KB Firefox, under 250 KB                 |
| Content-script budget               | 37.3 KB raw / 13.2 KB gzip, under 40 KB gzip                     |
| Network capture                     | No request outside the page origin during the theme flow         |
| SHA-256 checksums                   | Generated in `releases/v1.0.0/SHA256SUMS.txt`                    |

The E2E count includes the security regression suite: hostile-page runtime isolation, edit-host
data exposure, malicious import rejection, pre-grant registration, reset cleanup, and theme
re-application after a site rewrites the `html` attributes.

## Security checklist (spec 8.6)

| Item                                                      | Status | Evidence                                                         |
| --------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| No HTML sinks, `eval`, `Function`, or string timers       | Pass   | `eslint.config.js`; `pnpm lint`                                  |
| Zero extension network requests                           | Pass   | `theme.spec.ts` request capture; lint network bans               |
| Malicious/oversized/CSS-injection import rejected         | Pass   | `envelope.test.ts`, `fuzz.test.ts`, `security.spec.ts`           |
| Hostile page cannot message; host exposes no page text    | Pass   | `security.spec.ts` checks runtime isolation and shadow-host text |
| Built manifest permissions match 8.3 for both browsers    | Pass   | `scripts/check-manifest.mjs`                                     |
| `content_scripts` empty; registration only after a grant  | Pass   | Manifest check; E2E asserts no dynamic script before enabling    |
| No high/critical dependency advisories                    | Pass   | `pnpm audit`; Dependabot and CodeQL workflows                    |
| Reset removes sheet/attributes and unregisters the script | Pass   | `security.spec.ts`                                               |

Trusted Types is now enabled on extension pages in addition to the CSP in the spec.

## Acceptance traceability

The Must requirements are mapped to their primary tests in spec section 18. Every automated entry
in that matrix is covered by the commands above. These acceptance paths remain manual because
they need a real browser prompt, pointer gesture, or human:

- native host-permission grant and denial (FR-32);
- pointer drag-and-drop reorder (FR-21); Move up/down is covered;
- privacy-panel wording review (FR-44);
- five-person usability test (spec 7.5);
- screen-reader, forced-colors, Firefox install, and shortcut remapping.

## Manual release checks

These cannot be completed in the build environment and remain open for the maintainer:

- Five-person usability test from spec 7.5 (target: at least four of five finish each task
  without help). No sessions have been recorded yet.
- NVDA or VoiceOver pass over the edit bar, live announcements, focus restoration, and the
  options tabs.
- Windows High Contrast / forced-colors visual check. Automated forced-colors CSS is present,
  but it has not been inspected on a real display.
- Firefox install, permission prompt, and shortcut checks. The automated suite is
  Chromium-only because Playwright cannot load unsigned Firefox extensions the same way.
- Real shortcut remapping through `chrome://extensions/shortcuts` and `about:addons`.

## Rollback

There is no earlier public build, so 1.0.0 has no predecessor to roll back to. For future
releases, keep the previous `releases/vX.Y.Z/` directory (or the previous GitHub release) and:

1. Export data from **Options → Data and privacy** before changing versions.
2. Remove the newer unpacked extension.
3. Load the previous archive.
4. Import the backup if the storage schema moved forward.

Storage is schema-versioned and migrated forward. Downgrades are not guaranteed to read data
written by a newer schema, which is why the export step comes first.

## Known limitations

- Layout presets (FR-24) and the spacing half of FR-25 are not implemented.
- Theme sync (FR-42) is deferred.
- The A09 persistent diagnostic ring buffer is not in v1.0; **Copy diagnostics** is on demand
  and never leaves the device.
- Genius pages currently have a block-level `main`, so reorder is unavailable there. Hide and
  width still work; synthetic fixtures cover the reorder path.
- Human usability and screen-reader checks listed above remain open.

## Verification commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm audit --audit-level high
pnpm test:e2e
pnpm check:manifest
pnpm check:size
pnpm package:release
```
