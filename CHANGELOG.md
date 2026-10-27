# Changelog

All notable changes to Joevix are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic versioning.

## [1.0.2] — 2026-10-27

### Added

- Motion tokens and a design-rules document based on Emil Kowalski's design-engineering
  principles.
- `tests/e2e/design.spec.ts`: Playwright checks for transition timing, property specificity,
  press feedback, hover gating, and reduced-motion behavior.
- A primary action style for **New theme** and **Save theme**.

### Changed

- Buttons, tabs, theme cards, presets, role chips, segments, and switches now use strong
  ease-out transitions and visible press feedback.
- Hover states are scoped to fine pointers so touch devices do not show sticky hover styles.
- Reduced motion keeps color, border, and opacity transitions while removing movement and press
  scaling.
- In-page edit controls now share the same press and panel motion rules.
- Version bumped to 1.0.2.

## [1.0.1] — 2026-10-20

### Added

- Joevix favicon for the options and popup pages, with an SVG source in `public/favicon.svg`.
- 16/32/48/128 px extension icons and 16/32 px toolbar action icons.
- `pnpm icons` to regenerate the PNG set from the SVG with Playwright Chromium.

### Changed

- The manifest policy check now requires the extension and action icon entries.
- Version bumped to 1.0.1.

## [1.0.0] — 2026-10-20

First packaged release. Joevix is a local-only Manifest V3 extension for Chrome, Edge, Brave,
and Firefox; store publication is out of scope.

### Added

- Built-in light, dark, sepia, and high-contrast themes, plus a system-following mode.
- Custom theme editor with color wheel, hex/RGB/HSL entry, contrast matrix, one-click contrast
  fix, font family, size, line height, letter spacing, and alignment.
- Per-origin optional access: no host permissions at install, one origin granted at a time,
  runtime content-script registration, revocation handling, and reset.
- Bundled Genius adapter and a generic fallback that never overrides unspecified sections.
- Layout edit mode with drag and keyboard reorder, hide/show, 20-step undo/redo, and reading
  width. Reorder uses CSS `order` and never moves DOM nodes.
- JSON export/import with a 256 KB limit, schema validation, Replace/Merge choice, hostile
  input rejection, and a full data-deletion flow.
- English and Bahasa Indonesia UI following `navigator.language`, with English fallback.
- First-run welcome card, copyable diagnostics, and three keyboard shortcuts.
- Playwright end-to-end suite with axe-core WCAG A/AA audits, security regression tests, and a
  network-capture test.

### Security

- Strict extension CSP with `require-trusted-types-for 'script'` and `trusted-types 'none'`.
- Lint bans for DOM XSS sinks, dynamic code, inline style attributes, and network APIs.
- Sender validation on every UI message; no `externally_connectable`.
- Dependency audit in CI, CodeQL analysis, Dependabot updates, and a committed lockfile.
- Release archives with SHA-256 checksums and a manifest policy check for both browsers.
- Vitest upgraded to remove a critical development-only advisory in `tinypool`.

### Documentation

- Added `SECURITY.md`, `CHANGELOG.md`, and `docs/release-1.0.md`.
- Documented install, verification, rollback, permissions, diagnostics, and manual release
  checks.

### Deferred

- Layout presets (FR-24) and the spacing half of FR-25.
- Theme sync (FR-42).
- A persistent A09 diagnostic ring buffer; **Copy diagnostics** is the v1.0 path.
- Human usability sessions and a manual screen-reader pass.
- Store publication.
