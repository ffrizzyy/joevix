# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository:

<https://github.com/ffrizzyy/joevix/security/advisories/new>

Do not open a public issue for a suspected vulnerability. Include the affected version,
browser, reproduction steps, and the impact you believe it has. This is a local-only,
single-maintainer project, so there is no bug bounty or formal response SLA. Reports will be
acknowledged as soon as practical.

## Security design

Joevix is a Manifest V3 extension that restyles pages locally. It has no server, no account
system, no analytics, and no network code.

- **No standing site access.** The production manifest declares `content_scripts: []` and no
  host permissions. A content script is registered for one origin only after the user grants
  that optional permission.
- **Service worker owns privilege.** Storage, permissions, and script registration are handled
  only in the background service worker. The content script can only exchange typed,
  Zod-validated messages (ADR-11).
- **No page text.** The content script reads page structure for adapter matching, never text,
  form values, cookies, or keys. Diagnostics contain adapter labels and counts only.
- **CSS only.** Themes are allowlisted custom properties. Colors are parsed to numbers and
  rebuilt as `#rrggbb`; `url()`, `@import`, `attr()`, `expression()`, and `image-set()` are
  rejected. Layout uses CSS `order`, `display`, and width; DOM nodes are never moved.
- **Injection sinks are banned.** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`,
  `new Function`, string timers, inline `style` attributes, and network APIs fail lint.
- **Strict extension CSP**, including Trusted Types enforcement:
  `default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self'; img-src 'self'
data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none';
require-trusted-types-for 'script'; trusted-types 'none'`.
- **Bounded imports.** One versioned envelope, 256 KB maximum, 100 themes, 500 sites, and
  schema validation before anything is written.
- **No external messaging.** There is no `externally_connectable` entry, so web pages cannot
  message the extension. Every UI message is checked for an extension-page or expected-origin
  sender.

## Release verification

Release archives are produced by `pnpm package:release`. Each GitHub release includes
`SHA256SUMS.txt` and `release.json`. Verify a downloaded archive before loading it:

```powershell
Get-FileHash .\joevix-1.0.2-chrome.zip -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

```bash
sha256sum -c SHA256SUMS.txt     # Linux
shasum -a 256 -c SHA256SUMS.txt # macOS
```

The release workflow runs type checking, lint, unit tests, dependency audit, Playwright E2E,
axe audits, the manifest policy check, and the package size budget before publishing.

## Known limitations

- Joevix is not undetectable. A page can see the injected host element and attribute, and a
  main-world script could hook `attachShadow`. Joevix does not expose page data or privileged
  APIs through that surface.
- The v1.0 build does not keep a persistent diagnostic event log. **Copy diagnostics** is the
  supported troubleshooting path; it runs on demand and never leaves the device.
- Store publication is out of scope for v1.0. Builds are unsigned developer builds.
