# Joevix: Browser Extension Specification

**Working title:** Joevix
**Document type:** Software Development Life Cycle (SDLC) specification
**Version:** 0.2
**Date:** 2026-10-20
**Owner:** Project maintainer (single developer)
**Status:** Implemented through M2 (see README for milestone state)
**Scope:** Personal use, local-only, no publishing of third-party content

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | 2026-10-19 | First draft: SDLC frame, requirements, architecture, security, milestones                                                                                                                                                                                                 |
| 0.2     | 2026-10-20 | Resolved 14 contradictions (milestones, size budget, manifest, CSP, shadow DOM, tokens, data model); added acceptance criteria, traceability matrix, measurement methods, decision log, per-browser manifest, adapter trust model; corrected MV3 and accessibility claims |

## Contents

1. Product Summary
2. SDLC Approach
3. Requirements
4. Architecture and Tech Stack
5. Data Design
6. Design System: Minimalist
7. User-Friendliness Plan
8. Security and Privacy
9. Testing Strategy
10. Delivery Pipeline (CI/CD)
11. Milestones
12. Release Checklist
13. Maintenance Plan
14. Risks and Mitigations
15. Glossary
16. References for the Team
17. Decision Log
18. Traceability Matrix
19. Open Questions

---

## 1. Product Summary

Joevix is a browser extension that lets one person restyle and rearrange the pages of websites they visit, on their own screen only. It offers three things:

1. **Themes**: light, dark, system, sepia, high contrast, and a custom theme built with a color wheel.
2. **Rearranging**: move, hide, and resize page sections through a visual edit mode.
3. **Per-site memory**: each site keeps its own theme and layout, restored automatically on every visit.

The first target is lyrics pages (for readability: larger text, calmer colors, lyrics placed above clutter), but the engine is generic and works through small per-site "adapter" files that ship with the extension.

### 1.1 What Joevix will not do

- It will not copy, extract, store, or share page content such as lyrics. It only changes presentation.
- It will not run user-written JavaScript. "Tampering" is limited to declarative rules (styles, hide, reorder). This is a deliberate security decision (see section 8).
- It will not accept user-authored or imported adapters in v1 (see 8.3, adapter trust model).
- It will not send data to any server. There is no account, no analytics, no remote code.

### 1.2 Success criteria

Every criterion has a defined measurement so it can be argued about with evidence, not opinion.

| Goal          | Measure                                                                  | Method                                                                          |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Easy to start | A new user applies a theme to a page in under 30 seconds with no reading | Timed task in the 7.5 usability test; median over 5 participants                |
| Easy to undo  | Any change can be reverted in one click, from the popup                  | Manual test: reset from popup returns the page to baseline in every flow        |
| Safe          | No high or medium findings in the security review checklist (8.6)        | Checklist review plus one hostile-page fixture and one malicious import fixture |
| Light         | Content script ≤ 40 KB gzipped; total package ≤ 250 KB                   | `wxt build` output size report in CI; budget table in 3.3                       |
| Fast          | ≤ 3 ms of added main-thread scripting per page load (p95)                | 10 cold loads of a fixture in a Performance trace; sum of Joevix script time    |
| No flash      | No visible white flash when a dark theme is active                       | Filmstrip capture of first 10 frames on a dark fixture                          |
| Accessible    | All UI passes WCAG 2.2 AA                                                | axe-core on popup and options with open shadow roots, plus manual keyboard pass |

**Budget note (fixed in 0.2):** the 0.1 draft promised 150 KB while bundling three webfont families. v1 ships **no webfonts** (ADR-1), which brings the package comfortably under 250 KB and keeps `web_accessible_resources` empty.

---

## 2. SDLC Approach

An iterative model (short increments with a working build at the end of each) is used because the main risk is unknown site layouts, which only show up by testing real pages.

| Phase             | Output                                                              | Exit condition                                              |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Planning       | This document, scope, risks                                         | Scope agreed                                                |
| 2. Requirements   | Section 3                                                           | Every requirement has an ID and an acceptance test (18)     |
| 3. Design         | Architecture (4), data (5), design system (6), UX (7), security (8) | Reviewed against the threat model and the decision log (17) |
| 4. Implementation | Code per milestone (11)                                             | Typecheck, lint, unit tests, build all pass                 |
| 5. Testing        | Unit, integration, end-to-end, accessibility, security              | All Must acceptance tests pass                              |
| 6. Release        | Packaged build                                                      | Checklist in 12 complete                                    |
| 7. Maintenance    | Adapter updates, dependency updates                                 | Monthly review                                              |

Work is tracked as small issues, each linked to a requirement ID (for example `FR-12`).

---

## 3. Requirements

Priority uses MoSCoW: **M** must, **S** should, **C** could, **W** will not (this version).

### 3.1 Personas

| Persona       | Need                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| Reader        | Wants lyrics in a larger font, dark background, less clutter                           |
| Tinkerer      | Wants to move sections around and fine-tune colors                                     |
| Cautious user | Wants proof the extension is not collecting anything and a simple way to switch it off |

### 3.2 Functional requirements

**Themes**

| ID    | Requirement                                                                               | Pri | Acceptance                                                                                      |
| ----- | ----------------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------- |
| FR-01 | Provide built-in themes: Light, Dark, Sepia, High Contrast                                | M   | Each applies every color role; built-ins cannot be edited or deleted                            |
| FR-02 | "System" mode follows the operating system light/dark setting                             | M   | Toggling OS scheme updates the page within 200 ms                                               |
| FR-03 | Custom theme using a color wheel (hue and saturation on the wheel, lightness on a slider) | M   | Handle follows pointer; value fields update live                                                |
| FR-04 | Custom theme accepts typed hex, RGB, or HSL values                                        | M   | All three parse; invalid input shows inline error and keeps last good value                     |
| FR-05 | Editable roles: background, surface, text, muted text, accent, border                     | M   | Changing any role updates the page preview immediately                                          |
| FR-06 | Automatic contrast check with a one-click fix                                             | M   | Reports ratio for text-on-background, text-on-surface, muted-on-background; fix reaches ≥ 4.5:1 |
| FR-07 | Font controls: family (safe list), size, line height, letter spacing, alignment           | M   | Each persists per site and applies after reload                                                 |
| FR-08 | Save and name custom themes; duplicate, rename, delete                                    | S   | Duplicate/rename/delete work; deleting a referenced theme detaches it from sites (5.2)          |
| FR-09 | Live preview while adjusting, with Apply and Cancel                                       | M   | Cancel restores the pre-edit page state exactly                                                 |
| FR-10 | Export and import a theme as a JSON file                                                  | S   | Exported file re-imports; invalid file is rejected with a friendly message                      |
| FR-11 | Schedule: switch theme by time of day                                                     | C   | Not in v1                                                                                       |

**Rearranging and hiding**

| ID    | Requirement                                                         | Pri | Acceptance                                                                  |
| ----- | ------------------------------------------------------------------- | --- | --------------------------------------------------------------------------- |
| FR-20 | Edit mode: sections outlined and labeled by the site adapter        | M   | Only adapter-declared sections are outlined; page remains interactive       |
| FR-21 | Reorder sections by drag and drop                                   | M   | Drop commits new order; Escape cancels the drag                             |
| FR-22 | Reorder with keyboard (Move up / Move down) as an equal alternative | M   | Full reorder possible with keyboard only                                    |
| FR-23 | Hide and show sections, with a visible list of what is hidden       | M   | Hidden list always reachable in edit mode                                   |
| FR-24 | Layout presets: Single column, Two column, Focus                    | S   | Preset changes apply without breaking readability                           |
| FR-25 | Adjust content width and spacing with sliders                       | S   | Values persist per site                                                     |
| FR-26 | Undo and redo within an edit session                                | M   | 20-step history; `Done` clears history (ADR-10)                             |
| FR-27 | "Reset this site" restores the original page in one click           | M   | Removes every injected style, attribute, and registered script for the site |

**Site handling**

| ID    | Requirement                                                                                     | Pri | Acceptance                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------- |
| FR-30 | Each site has its own saved theme and layout                                                    | M   | Two sites keep independent settings                                                          |
| FR-31 | Per-site on/off switch in the popup                                                             | M   | Off removes styles immediately; on restores them                                             |
| FR-32 | Site access granted by the user per site, at first use                                          | M   | Pre-prompt explains, then the browser's own dialog appears; denial leaves the page untouched |
| FR-33 | Site adapters are small declarative files describing named sections and selectors               | M   | Adapter validated at build time against a schema                                             |
| FR-34 | Generic fallback for sites without an adapter: theme only, no rearranging                       | M   | Any https site can be themed; edit mode is disabled with an explanation                      |
| FR-35 | Re-apply customizations when a single-page site changes content without reloading               | M   | Fixture with scripted DOM swaps keeps the theme                                              |
| FR-36 | Pick-an-element tool to help create a new adapter section visually                              | W   | Deferred (ADR-7): adapters are bundled and reviewed, not user-authored                       |
| FR-37 | Cross-tab live sync: a change in one tab applies to other open tabs of the same site            | S   | Two tabs update within 250 ms                                                                |
| FR-38 | Per-site "safe mode" ("Something looks off") that disables Joevix on that page and offers reset | M   | One click restores the page to baseline                                                      |

**Settings and data**

| ID    | Requirement                                                                            | Pri | Acceptance                                                                         |
| ----- | -------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------- |
| FR-40 | All settings stored locally in the browser                                             | M   | No network calls; data present after restart                                       |
| FR-41 | Export and import of all settings, validated before applying                           | S   | One versioned envelope; invalid or oversized file rejected (8.4)                   |
| FR-42 | Optional sync of themes via the browser's built-in sync                                | C   | Not in v1                                                                          |
| FR-43 | "Delete all my data" button                                                            | M   | Clears storage, revokes optional host permissions, unregisters scripts             |
| FR-44 | Plain-language privacy panel stating what is stored and that nothing leaves the device | M   | Text matches the stored keys exactly                                               |
| FR-45 | Global "turn off everywhere" switch                                                    | M   | Disables all sites without deleting settings                                       |
| FR-46 | Copy diagnostics to clipboard (no network)                                             | S   | Produces a short text report with version, site, adapter id, and selector failures |
| FR-47 | Keyboard shortcuts for open popup, toggle edit mode, cycle theme                       | C   | Configurable in the browser's shortcut UI                                          |

**Explicitly out of scope (W for v1)**

User-written scripts, user-authored or imported adapters, cloud accounts, sharing themes through a server, extracting or saving page text, mobile browsers, store publication, moving DOM nodes for reordering (ADR-6).

### 3.3 Non-functional requirements

| ID     | Category        | Requirement                                                                                        | How it is measured                                         |
| ------ | --------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| NFR-01 | Performance     | Content script ≤ 40 KB gzipped; theme applied before first paint in practice                       | Build size report; filmstrip test (1.2)                    |
| NFR-02 | Performance     | No polling; observers are throttled with `requestAnimationFrame` and disconnected during edit mode | Code review plus Performance trace                         |
| NFR-03 | Reliability     | A failing adapter selector skips that section, shows a calm notice, never breaks the page          | Fixture with a renamed selector                            |
| NFR-04 | Compatibility   | Chrome, Edge, Brave (MV3, primary); Firefox (MV3, second target, per-browser manifest in 8.3)      | Manual smoke test each browser; CI builds both             |
| NFR-05 | Accessibility   | WCAG 2.2 AA; full keyboard operation; screen reader labels; reduced motion; forced colors          | axe-core + manual pass (9)                                 |
| NFR-06 | Privacy         | Zero network requests from extension code; no telemetry                                            | DevTools network capture on all flows; lint ban list (8.3) |
| NFR-07 | Security        | OWASP-aligned controls in section 8                                                                | 8.6 checklist                                              |
| NFR-08 | Maintainability | TypeScript strict; adapters and core separated; no `any` in `src/core`                             | `tsc --noEmit` and lint                                    |
| NFR-09 | Localization    | All UI text in message files (`en`, `id`)                                                          | No hardcoded strings in components                         |
| NFR-10 | Storage         | Stay within browser quotas; cap themes and sites; handle quota failure with a message              | Unit test simulates a quota error                          |

### 3.4 User stories with acceptance criteria

**US-1: Switch to dark theme**
As a reader, I want to switch a page to dark mode so my eyes are comfortable at night.

- Given I am on a supported page, when I open the popup and choose Dark, the page changes within 200 ms.
- When I reload the page, Dark is still applied with no white flash.
- When I press Reset, the original appearance returns.

**US-2: Pick my own color**
As a tinkerer, I want to choose a background color on a wheel so the page matches my taste.

- Given the custom theme editor is open, when I drag on the wheel, the page previews the color live.
- If text contrast is below 4.5:1, a warning appears with a Fix button.
- Cancel discards the change; Apply stages it; Save stores it under a name.

**US-3: Move sections**
As a tinkerer, I want to move the lyrics section above the side content.

- In edit mode I can drag a section or use Move up / Move down.
- The new order is saved for this site on `Done` and restored on the next visit.
- Undo reverses my last move within the session.

**US-4: Stay in control**
As a cautious user, I want to know what the extension can access.

- Joevix asks for a site only when I enable it there, after a pre-prompt that explains why.
- The privacy panel lists the exact stored keys and states that nothing is sent anywhere.
- I can revoke a site, and optionally delete that site's saved data, from the options page.

---

## 4. Architecture and Tech Stack

### 4.1 Overview

```
+---------------------------+       +------------------------------+
|  Popup (Preact)           |       |  Options page (Preact)       |
|  quick theme, site switch |       |  themes, sites, privacy      |
+-------------+-------------+       +---------------+--------------+
              |   typed, validated messages         |
              v                                     v
        +-----------------------------------------------+
        |  Service worker (background, MV3)             |
        |  permission + registration, storage, routing  |
        +----------------------+------------------------+
                               |  validated commands only
                               v
        +-----------------------------------------------+
        |  Content script (per enabled origin)          |
        |  - Theme engine (CSS custom properties)       |
        |  - Layout engine (CSS order / display)        |
        |  - Edit mode UI (open Shadow DOM)             |
        |  - Mutation observer (throttled)              |
        +-----------------------------------------------+
```

**Trust boundary rule (enforced by review and lint):** the content script never touches `chrome.storage` or `permissions`. It receives validated commands from the service worker and reads nothing else. The service worker is the only component that reads and writes storage.

### 4.2 Technology choices

| Area                  | Choice                                               | Reason                                                                             |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Language              | TypeScript (strict)                                  | Fewer runtime errors, safer refactors                                              |
| Extension framework   | WXT (Vite based)                                     | Manifest V3, Chrome and Firefox builds, hot reload                                 |
| UI                    | Preact                                               | About 4 KB, fast popup startup                                                     |
| Styling               | Plain CSS with custom properties                     | No runtime cost; direct fit for theming                                            |
| Injected UI isolation | **Open** Shadow DOM, namespaced attributes           | Testable with axe and Playwright; isolation does not depend on closed mode (ADR-2) |
| Validation            | Zod in the service worker and options page only      | Runtime checks without spending the content-script budget                          |
| Color math            | In-house HSL helpers (no dependency)                 | Wheel and contrast checks                                                          |
| Color wheel           | Custom canvas component                              | Native color inputs vary and are not wheel-shaped                                  |
| Drag and drop         | Pointer events with keyboard fallback                | Works on touch and mouse; accessible                                               |
| Icons                 | Inline SVG components (Phosphor-style geometry)      | No network, no `web_accessible_resources`                                          |
| Fonts                 | System font stacks only in v1                        | Meets the size budget and needs no WAR entry (ADR-1)                               |
| Unit tests            | Vitest                                               | Fast, TypeScript native                                                            |
| End-to-end tests      | Playwright with a loaded extension                   | Real browser checks on saved page fixtures                                         |
| Accessibility tests   | axe-core in Playwright                               | Automated WCAG checks on open shadow roots                                         |
| Lint and format       | ESLint (flat config, `typescript-eslint`) + Prettier | Consistent, banned risky APIs                                                      |
| Package manager       | pnpm with committed lockfile                         | Reproducible installs                                                              |
| CI                    | GitHub Actions                                       | All checks on every change                                                         |

### 4.3 Key design decisions

1. **Declarative only.** Rules are data (JSON), never code. This removes the biggest risk found in script-injection tools.
2. **Prefer CSS over moving DOM nodes.** Reordering uses the CSS `order` property. Moving nodes is out of scope for v1 (ADR-6) because it fights frameworks and is hard to reverse.
3. **CSS variables for theming.** One set of variables on the root element is changed; the stylesheet maps site elements to those variables. Switching themes is a single update.
4. **Site adapters are bundled and read-only in v1.** No import path, no user authoring, no element picker. This keeps the trust boundary at "code we shipped" (ADR-7).

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

5. **Permissions requested at the moment of need.** `storage`, `activeTab`, and `scripting` are required; site access is an optional host permission granted per origin.
6. **Content scripts are registered at runtime, per origin** (8.3). Nothing is declared in `content_scripts` in the manifest, so the extension has no standing access to any site.
7. **No network code at all.** Not just "no fetch allowances": a lint ban list covers `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, and dynamic image/link loads.

### 4.4 Project structure

```
joevix/
  src/
    entrypoints/
      background.ts
      content.ts
      popup/          (index.html, main.tsx, app.tsx, popup.css)
      options/        (index.html, main.tsx, app.tsx, options.css)
    core/
      theme/          (color, contrast, builtins, css, resolve)
      layout/         (sections, capability detection)
      storage/        (schema, store, migrations, envelope)
      messaging/      (protocol, validation)
      site.ts         (siteId and origin pattern)
    adapters/         (one JSON file per site, bundled)
    ui/               (shared Preact primitives: Swatch, Toggle, Segmented)
    locales/          (en, id)
  tests/
    unit/
    fixtures/         (saved HTML pages)
  public/             (favicon.svg, icon/*.png)
  docs/               (privacy policy, adapter guide)
  .github/workflows/  (ci.yml, codeql.yml, release.yml)
```

---

## 5. Data Design

### 5.1 Stored objects

Storage keys are namespaced and versioned.

```
joevix:meta      { schemaVersion: number }
joevix:settings  { enabledEverywhere, onboarded, defaultThemeId }
joevix:themes    Theme[]            (user themes only; built-ins live in code)
joevix:sites     Record<siteId, SiteConfig>
```

```ts
type Theme = {
  schemaVersion: number;
  id: string; // "custom:<uuid>" or builtin id
  name: string; // 1..40 chars
  mode: 'light' | 'dark' | 'sepia' | 'contrast' | 'custom';
  builtin: boolean; // built-ins are never stored
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
  }; // normalized to #RRGGBB
  font: {
    family: 'system' | 'serif' | 'mono';
    sizePx: number; // 12..40
    lineHeight: number; // 1.2..2.2
    letterSpacingEm: number; // -0.02..0.1
    align: 'start' | 'center';
  };
};

type SiteConfig = {
  schemaVersion: number;
  siteId: string; // see 5.2
  enabled: boolean;
  themeId: string | 'system'; // "system" is a sentinel, not a Theme.mode value
  order: string[]; // adapter section keys; unknown keys are dropped
  hidden: string[]; // subset of order
  layout: 'single' | 'two' | 'focus';
  contentWidthPx: number; // 480..1200
  adapterId: string | null;
  adapterVersion: number | null;
  updatedAt: number; // epoch ms
};
```

**Removed in 0.2:** per-record `version` replaced by one `schemaVersion`, so migrations run once against the whole store instead of ad hoc. `Theme` and `SiteConfig` both carry it for forward compatibility.

### 5.2 Rules

- **`siteId`** is the page hostname, lowercased, with a single leading `www.` removed. `m.example.com` and `example.com` are separate sites in v1. This is documented in the privacy panel and tested.
- **`originPattern`** is `scheme://host/*` (no `www.` normalization), used for `permissions.request` and `scripting.registerContentScripts`.
- Every value is validated with a schema on write and on read. Invalid values fall back to defaults and the invalid record is dropped, never partially applied.
- Only the documented keys are stored. No browsing history, no page text, no timestamps of visits.
- `order` must contain only known adapter keys and no duplicates. Missing keys are appended in adapter order at read time.
- `hidden` is intersected with `order` at read time.
- If `themeId` points at a deleted theme, the site falls back to the System theme and the popup shows a quiet notice (5.2).
- Caps: 100 user themes, 500 sites, 200 KB total serialized. Exceeding a cap shows a message and does not write.

### 5.3 Storage limits

| Area            | Used for                        | Limit              | Behavior at limit                                                            |
| --------------- | ------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `storage.local` | Meta, settings, themes, sites   | 10 MB (Chrome MV3) | Write fails cleanly; UI reports "Storage is full" and offers export + delete |
| `storage.sync`  | Not used in v1 (FR-42 deferred) | —                  | —                                                                            |

### 5.4 Migrations

- One migration function per version step, run in order on startup.
- Before migrating, the current store is copied to `joevix:backup:<version>` (one backup, overwritten each time).
- If a migration throws, Joevix keeps the old data, logs locally, and runs in read-only mode with a visible notice. It never silently resets.

---

## 6. Design System: Minimalist

The interface follows a calm, editorial style: warm neutral colors, generous whitespace, thin borders, almost no shadows, one typeface family doing most of the work.

### 6.1 Principles

1. **Quiet by default.** Color is used only for meaning or for the user's own theme preview.
2. **Space before decoration.** Separate things with whitespace and hairlines, not boxes inside boxes.
3. **One clear action per area.** Each screen has a single primary button.
4. **Plain words.** Labels say what happens: "Move up", "Hide section", "Reset this site".

### 6.2 Color tokens (the extension's own interface)

Ratios below were computed, not estimated. Text tokens must be ≥ 4.5:1; control boundaries ≥ 3:1.

| Token                | Light     | Dark      | Use                                   | Contrast          |
| -------------------- | --------- | --------- | ------------------------------------- | ----------------- |
| `--jx-bg`            | `#FBFBFA` | `#191919` | Canvas                                | —                 |
| `--jx-surface`       | `#FFFFFF` | `#202020` | Cards, panels                         | —                 |
| `--jx-text`          | `#111111` | `#EDEDEB` | Primary text                          | 18.24 / 15.00     |
| `--jx-muted`         | `#726F6C` | `#9B9A97` | Secondary text                        | 4.82 / 6.25       |
| `--jx-border`        | `#EAEAEA` | `#2F2F2F` | Decorative hairlines only             | 1.16 (decorative) |
| `--jx-border-strong` | `#8F8D89` | `#6B6A67` | Input and control boundaries (1.4.11) | ≥ 3.0             |
| `--jx-key`           | `#F7F6F3` | `#262626` | Keyboard key background               | —                 |
| `--jx-primary`       | `#111111` | `#EDEDEB` | Primary button fill                   | —                 |
| `--jx-primary-hover` | `#333333` | `#F7F6F4` | Primary button hover                  | —                 |

**Changed in 0.2:** `--jx-muted` light was `#787774` (4.32:1, a fail) and is now `#726F6C` (4.82:1). `--jx-border` is explicitly decorative; form controls use `--jx-border-strong`. Dark hover no longer jumps to pure white.

Status colors (low saturation, small tags and messages). All meet 4.5:1 on their own background.

| Meaning | Background | Text      | Ratio |
| ------- | ---------- | --------- | ----- |
| Error   | `#FDEBEC`  | `#9F2F2D` | 6.26  |
| Info    | `#E1F3FE`  | `#1F6C9F` | 4.98  |
| Success | `#EDF3EC`  | `#346538` | 6.08  |
| Warning | `#FBF3DB`  | `#956400` | 4.62  |

In dark mode these swap to dark tinted backgrounds with the same hue family and text that still meets 4.5:1. Values are checked by a unit test against the table.

### 6.3 Typography

No bundled webfonts in v1 (ADR-1). The stack uses fonts already present on the operating system, with graceful fallback.

| Role          | Font stack                                                                   | Notes                                   |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------- |
| Interface     | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif` | 14px body, line height 1.6              |
| Headings      | `ui-serif, Georgia, 'Times New Roman', serif`                                | Letter spacing -0.02em, line height 1.1 |
| Code and keys | `ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace`              | Shortcuts and hex values                |

Scale: 12, 14, 16, 20, 28, 40 px. **Minimum interface text is 12px**, including tags.

### 6.4 Spacing, shape, depth

- Spacing unit: 4px. Common steps: 8, 12, 16, 24, 32, 48.
- Corner radius: 4px for buttons and inputs, 8px for cards. Small tags are pill shaped.
- Borders: `1px solid var(--jx-border)` for decoration; `1px solid var(--jx-border-strong)` for interactive boundaries.
- Shadows: none by default. Hover on cards may use `0 2px 8px rgba(0,0,0,0.04)`.
- No gradients and no glass effects.

### 6.5 Components

| Component         | Specification                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Primary button    | Solid `--jx-primary`, inverse text, 4px radius, no shadow, `scale(0.98)` while pressed                    |
| Secondary button  | Transparent, 1px `--jx-border-strong`, same height                                                        |
| Toggle            | 36 × 20px track inside a **44 × 44px hit area** (padding on the label row), flat knob, visible focus ring |
| Segmented control | Light / Dark / System; borders only, selected segment has a filled surface                                |
| Section list row  | Drag handle, label, eye icon, up and down buttons; hairline separators; minimum row height 44px           |
| Tag               | Uppercase, **12px**, 0.05em tracking, pastel fill from the status table                                   |
| Keyboard hint     | `<kbd>` with 1px border, 4px radius, `--jx-key` background, mono font                                     |
| Accordion         | No container box; hairline between items; plain `+` and `-` toggle                                        |
| Notice            | Pastel tag color, one sentence, one optional action                                                       |

**Changed in 0.2:** the toggle's visual track stays 36 × 20 but its interactive target is 44 × 44 (was a 20px-tall target, which failed 7.3). Tags are 12px (was 11px, contradicting the minimum).

### 6.6 Color wheel specification

- **Wheel:** 200px circle. Angle is hue, distance from center is saturation. 1px border; handle is a 16px ring with a 2px inner outline for visibility on any color.
- **Lightness slider:** directly below, full width, track shows the current hue and saturation from dark to light.
- **Value fields:** one text field accepting hex, plus small RGB and HSL fields. Typing updates the wheel.
- **Role selector:** six swatches (background, surface, text, muted, accent, border). Selecting one decides which color the wheel edits.
- **Contrast badge:** tag showing the worst failing pair, e.g. `7.2:1 Pass` or `3.1:1 Low` with a Fix button. Contrast is evaluated for text-on-background, text-on-surface, and muted-on-background.
- **Fix algorithm:** keep hue and saturation, move lightness toward the pole that increases contrast until ≥ 4.5:1, then stop at the first step that passes (no overshoot to black or white unless required).
- **Keyboard:** arrows move the handle by 1 degree or 1 percent; Shift by 10. Announced as hue, saturation, and lightness values.
- **Presets row:** six curated swatch sets (Bone, Slate, Forest, Plum, Sand, Ink).

### 6.7 Icons

Phosphor-style geometry, drawn as inline SVG in a 20px box, filled weight, one visual weight across the set. Icons are code, not assets, so nothing is exposed through `web_accessible_resources`. No emoji anywhere in the interface or its documentation.

### 6.8 Motion

- Panels fade and rise 8px over 200ms with `cubic-bezier(0.16, 1, 0.3, 1)`.
- Only `transform` and `opacity` are animated.
- Motion is removed when `prefers-reduced-motion: reduce`.
- Theme changes on the page use a 150ms color transition, disabled in reduced motion.

### 6.9 Screen layouts

**Popup (360px wide)**

```
+--------------------------------------+
|  Joevix                    [ On  o] |
|  example.com                         |
|--------------------------------------|
|  Theme                               |
|  [ Light | Dark | System ]           |
|  [ Sepia ] [ Contrast ] [ Custom ]   |
|--------------------------------------|
|  Text size   A-  ------o-----  A+    |
|--------------------------------------|
|  [ Edit layout ]     Reset this site |
|--------------------------------------|
|  Settings                  Privacy   |
+--------------------------------------+
```

**Edit mode (in the page)**

A slim floating bar in the browser top layer (`<dialog>` or `popover`, so a transformed ancestor cannot trap it): `Done`, `Undo`, `Redo`, `Reset`, and a "Sections" button that opens the list with handles, eye icons, and up/down buttons. Sections show a 1px dashed outline and a small label while editing. The host element gets `all: initial` so page inheritance cannot leak in.

**Options page**

Single column, 720px maximum width, tabs: Themes, Sites, Data and Privacy, About. Large whitespace between groups.

---

## 7. User-Friendliness Plan

This is a requirement area, not decoration. Each item below maps to a requirement ID.

### 7.1 First-run experience

1. A single welcome card in the popup: "Choose how pages should look." Three theme previews, one click each. No account, no setup form. Persisted by `settings.onboarded`.
2. When the user enables a site, a **Joevix pre-prompt screen** explains "Joevix needs access to this site to change how it looks. Nothing is sent anywhere." with a Continue button. Only then is `permissions.request()` called from that click. The browser's own dialog cannot be customized, which is why the explanation comes first (ADR-3).
3. A short, skippable hint on first edit mode: "Drag a section, or use the arrow buttons." Persisted per site.

### 7.2 Everyday ease

- **Few decisions.** The popup shows theme, text size, enable switch, reset, and settings. Everything else is on the options page.
- **Instant feedback.** Theme and text size apply live.
- **Always reversible.** Undo and redo in edit mode; "Reset this site" always visible; "Turn off everywhere" in the popup menu (FR-45).
- **Safe mode.** "Something looks off" disables Joevix on that page and offers reset (FR-38).
- **Clear language.** No jargon. "Section" instead of "DOM element", "Site" instead of "origin".
- **Keyboard shortcuts** (FR-47, changeable at the browser's shortcut page): open popup `Alt+Shift+J`, toggle edit mode `Alt+Shift+E`, cycle theme `Alt+Shift+T`. `Alt+Shift+R` was dropped because it collides with the Windows keyboard-layout switch.

### 7.3 Accessibility

- Full keyboard operation, including drag-and-drop alternatives (FR-22).
- Visible focus rings (2px, ≥ 3:1 against adjacent colors) on every control.
- Interactive targets at least 32px, with a 44px hit area for the toggle and section rows.
- Labels and roles for screen readers; a live region announces "Section moved to position 2".
- Respect `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast`, and `forced-colors: active`.
- Never convey meaning by color alone; contrast badges also carry text.
- Popup and options reflow at 200% zoom and 320px width without horizontal scrolling (1.4.10).

### 7.4 Error handling tone

| Situation         | Message                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Section not found | "This part of the page could not be found. The site may have changed. Your other changes still work." |
| Import failed     | "This file is not a valid Joevix backup. Nothing was changed."                                        |
| Low contrast      | "Text may be hard to read with these colors. Fix it?"                                                 |
| Storage full      | "Your browser storage is full. Export a backup, then delete a theme you no longer use."               |
| Permission denied | "Joevix cannot change this site without access. Nothing was changed."                                 |

### 7.5 Usability testing

Five people who have not seen the extension. Tasks: apply dark mode, pick a custom color, move the lyrics section, undo, reset. Target: at least four of five finish each task without help. This is a manual test, not a CI job. Record confusion points and fix before release.

---

## 8. Security and Privacy

Joevix runs inside pages the user trusts and handles only local settings, but extensions are powerful, so the design follows OWASP guidance for extensions and web apps.

### 8.1 Threat model (summary)

| Asset                    | Threat                                                   | Actor                                    |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------- |
| User's browsing activity | Collection or leakage                                    | Malicious update, compromised dependency |
| Page content             | Injection of harmful content through settings or imports | Crafted import file, malicious page      |
| Extension messaging      | Spoofed messages from a web page or another extension    | Hostile website, unrelated extension     |
| Extension code           | Tampered dependency or build                             | Supply chain attacker                    |
| Page integrity           | Style rules used to leak data (CSS exfiltration)         | Crafted theme file                       |
| User's trust             | Silent broad access                                      | Over-broad permissions                   |

Trust boundaries: web page (untrusted) → content script (limited trust, no storage or permission access) → service worker (trusted) → stored data (always validated).

**Corrected in 0.2:** the 0.1 claim that pages "cannot detect" the extension was wrong. A host element is visible to page scripts and a main-world script can hook `attachShadow`. Joevix does not rely on being undetectable; it relies on not exposing data or privileged APIs.

### 8.2 OWASP Top 10 (2021) mapping

| OWASP item                                     | Risk for Joevix                                       | Control                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control                      | Content script or page acting beyond its rights       | Content script has no storage, permission, or network API use (lint + review); service worker checks `sender.id` and `sender.url` on every message; site access is per origin and revocable                                                                            |
| A02 Cryptographic Failures                     | Sensitive data exposure                               | No sensitive data collected; nothing transmitted; no secrets in code                                                                                                                                                                                                   |
| A03 Injection                                  | DOM XSS, CSS injection from stored or imported values | No `innerHTML`, `eval`, or `new Function`; text via `textContent`; colors parsed to numbers and rebuilt as `#RRGGBB`; allowlisted CSS properties only; `url()`, `@import`, `expression()`, `image-set()`, and `attr()` never allowed; Trusted Types on extension pages |
| A04 Insecure Design                            | Features that expand risk                             | Declarative rules only; no user scripts; no user adapters; threat model reviewed each milestone                                                                                                                                                                        |
| A05 Security Misconfiguration                  | Broad permissions, weak CSP                           | Minimal permissions; optional host permissions fetched per origin; strict CSP (8.3); no `<all_urls>`                                                                                                                                                                   |
| A06 Vulnerable and Outdated Components         | Library vulnerabilities                               | Few dependencies (Preact, Zod, WXT); committed lockfile; `pnpm audit` in CI; monthly updates                                                                                                                                                                           |
| A07 Identification and Authentication Failures | Not applicable                                        | No accounts                                                                                                                                                                                                                                                            |
| A08 Software and Data Integrity Failures       | Tampered build, malicious import                      | Pinned deps, reproducible CI build, checksums on release, schema + size limits on import, no remote code                                                                                                                                                               |
| A09 Security Logging and Monitoring Failures   | Silent failure                                        | Copy diagnostics (FR-46) on demand, containing adapter labels and counts but no page text; persistent local ring buffer deferred from v1.0                                                                                                                             |
| A10 Server-Side Request Forgery                | Not applicable                                        | No network code at all                                                                                                                                                                                                                                                 |

### 8.3 Extension-specific controls

**Manifest (Chrome / Edge / Brave)**

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "activeTab", "scripting"],
  "optional_host_permissions": ["https://*/*", "http://*/*"],
  "content_scripts": [],
  "web_accessible_resources": [],
  "content_security_policy": {
    "extension_pages": "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types 'none'"
  }
}
```

**Per-browser differences (NFR-04)**

| Concern                 | Chrome / Edge / Brave              | Firefox                                             |
| ----------------------- | ---------------------------------- | --------------------------------------------------- |
| Optional hosts key      | `optional_host_permissions`        | `optional_permissions` with host patterns           |
| Background              | Service worker                     | Event page (`background.scripts`)                   |
| Runtime content scripts | `scripting.registerContentScripts` | `scripting.registerContentScripts` (MV3), same flow |
| Permission prompt       | Per-origin optional grant          | Per-origin optional grant, different wording        |

WXT emits both manifests from one config; the Firefox-specific keys live in the `firefox` manifest override.

**Why `content_scripts` is empty**
Declared content scripts require host permission at install time, which would mean standing access to every site. Instead the service worker calls `scripting.registerContentScripts()` with a single-origin match **after** the user grants that origin, and calls `unregisterContentScripts()` when permission is revoked (`permissions.onRemoved`). The current tab is injected immediately with `scripting.executeScript` so enabling works without a reload.

**CSP notes**

- `frame-ancestors` is not honoured in `extension_pages`, so it is omitted rather than listed as if it worked.
- `style-src 'self'` means **no inline style attributes**. Dynamic values use CSS custom properties set through CSSOM and class swaps, never `setAttribute('style', ...)`.
- No bundled fonts or images mean `font-src` and `img-src` stay minimal and `web_accessible_resources` stays empty.

**Messaging**

- Fixed, typed command set, Zod-validated; unknown shapes are dropped.
- Service worker verifies `sender.id === runtime.id` and that `sender.url` is an extension page or the expected content-script origin.
- No `externally_connectable`; pages cannot message the extension.
- Content script never reads storage; it asks and is told.

**Content script hygiene**

- Open Shadow DOM with a `joevix-` attribute namespace and `all: initial` on the host.
- Never reads form fields, cookies, or page text; no keystroke listeners outside its own UI.
- Styles are applied through one constructed stylesheet attached to `document.adoptedStyleSheets`. Reset removes the sheet and every attribute in one step.
- Adapters that target `input[type=password]`, `input[type=credit-card]`, or payment iframes are rejected at build time by the adapter schema test.

**Network ban list (lint-enforced)**
`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `importScripts`, `new Image()` with a remote `src`, and `url()` in any generated CSS. Zero-request behavior is verified by a network capture in the security tests, not by trust.

### 8.4 Data handling and privacy

- Local-only storage; no analytics, telemetry, or identifiers.
- The privacy panel lists the exact storage keys and offers export and full deletion.
- Imports: one versioned envelope, maximum 256 KB, per-item caps (100 themes, 500 sites), schema validated, and applied only after a summary is shown.
- Import never merges silently: the user chooses Replace or Merge.
- Optional sync (FR-42) is deferred; when added it will store themes only, never sites.
- A short privacy policy ships in `docs/` and in the About tab.

### 8.5 Secure development practices

| Practice           | Detail                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Code review        | Every change reviewed against the 8.6 checklist                                           |
| Static analysis    | ESLint flat config with `typescript-eslint`; banned APIs; TypeScript strict; CodeQL in CI |
| Dependency control | `pnpm audit` in CI; Dependabot; new packages require justification                        |
| Secrets            | None required; secret scanning enabled                                                    |
| Build integrity    | Lockfile committed; clean CI checkout; release checksums                                  |
| Release access     | 2FA on the repository and (if ever published) the store account                           |
| Fuzz testing       | Random and malformed inputs against the import and color parsers                          |

### 8.6 Security acceptance checklist

- [x] No use of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `Function`, or string-based timers (lint rule enforced)
- [x] Network inspection shows zero requests from the extension during all flows
- [x] A malicious import file (oversized, wrong types, CSS with `url()`, script strings) is rejected with a friendly message
- [x] A hostile test page cannot message the extension; the extension exposes no data through its host element
- [x] Permissions in the built manifest match 8.3 for both Chrome and Firefox
- [x] `content_scripts` is empty in the built manifest and registration happens only after a grant
- [x] Dependency audit shows no high or critical issues
- [x] Reset removes every injected sheet and attribute, and unregisters the site's content script

### 8.7 Legal and terms-of-service notes

- Joevix changes presentation locally. It does not copy, store, or redistribute site content, including lyrics, which are copyrighted.
- Adapters describe page structure only; they contain no site text.
- Users remain responsible for following the terms of the sites they customize. Site terms differ; restyling one's own screen is common but not universally permitted.
- Store publication is out of scope for v1.

---

## 9. Testing Strategy

| Level                | Tooling                                                             | What is covered                                                                                                                     | Automated    |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Unit                 | Vitest                                                              | Color conversion, contrast, palette generation, contrast fix, schema validation, migrations, reorder rules, import envelope, siteId | Yes          |
| Component            | Vitest + testing library                                            | Color wheel interaction, section list, toggle                                                                                       | Yes          |
| Integration          | Playwright with the extension loaded                                | Popup → service worker → content script messaging, storage persistence, permission flow                                             | Yes          |
| End to end           | Playwright on saved fixtures                                        | Apply theme, hide section, reset, reload persistence, safe mode                                                                     | Yes          |
| Single-page behavior | Playwright with scripted DOM swaps                                  | Re-apply after dynamic changes                                                                                                      | Yes          |
| Visual regression    | Playwright screenshots on fixtures                                  | Theme output does not drift                                                                                                         | Yes          |
| Accessibility        | axe-core (open shadow roots) + keyboard-only + manual screen reader | WCAG 2.2 AA                                                                                                                         | Partly       |
| Security             | Lint rules, fuzzing, hostile-page fixture, manifest diff check      | 8.6                                                                                                                                 | Yes          |
| Performance          | Performance trace on fixtures, filmstrip capture                    | NFR-01, NFR-02, no-flash                                                                                                            | Yes          |
| Cross-browser        | Chrome, Edge, Brave, Firefox                                        | Manifest differences, storage, registration                                                                                         | Manual smoke |
| Usability            | Five-person task test (7.5)                                         | Ease of use                                                                                                                         | Manual       |

**Test data:** pages are saved as static HTML fixtures so tests never depend on live sites.

**Definition of done for any feature:** requirement ID linked, unit tests written, end-to-end test where user visible, accessibility check passed, security checklist items reviewed, documentation updated.

---

## 10. Delivery Pipeline (CI/CD)

1. Developer pushes a branch; pull request opens.
2. CI runs: install from lockfile, typecheck, lint, unit tests, build for Chrome and Firefox, end-to-end tests, accessibility tests, dependency audit, CodeQL.
3. All checks pass and one review approval before merge.
4. A tagged release builds final packages, generates SHA-256 checksums, and attaches them to the release.
5. Packages are loaded unpacked for personal use. Store submission is out of scope for v1.

---

## 11. Milestones

| Milestone                       | Contents                                                                                                                                        | Requirements              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| M0: Foundation                  | Repository, WXT setup, CI, lint ban list, manifest, design tokens, schemas                                                                      | NFR-07, NFR-08            |
| M1: Theme engine                | Built-in themes, CSS variable engine, no-flash boot, popup theme switch, per-site enable via `activeTab` + one-shot injection, generic fallback | FR-01, 02, 09, 30, 31, 34 |
| M2: Permissions and persistence | Per-origin optional host permissions, runtime registration, revocation, reset, cross-tab sync                                                   | FR-27, 32, 37, 38         |
| M3: Color wheel                 | Wheel, lightness slider, hex/RGB/HSL entry, contrast matrix, fix, saved custom themes                                                           | FR-03 to 08               |
| M4: Site adapters               | Adapter format and build-time validation, first real adapter, section detection                                                                 | FR-33                     |
| M5: Layout editing              | Edit mode, drag + keyboard reorder, hide/show, undo/redo, presets, width                                                                        | FR-20 to 26               |
| M6: Data and privacy            | Export, import with validation, delete all, privacy panel, quota handling                                                                       | FR-40, 41, 43, 44, 45     |
| M7: Polish and hardening        | Accessibility pass, usability test, fuzzing, performance tuning, Bahasa Indonesia strings                                                       | NFR-01 to 10              |
| M8: Release 1.0                 | Final security checklist, documentation, packaged build                                                                                         | All Must items            |

**Fixed in 0.2:** M1 no longer depends on the permission system built in M3; it uses `activeTab` for one-shot injection. FR-10, FR-34, FR-42, FR-45, FR-46, FR-47 now have explicit homes or are marked deferred:

- FR-10 (theme export) — M6, alongside the settings envelope.
- FR-42 (sync) — deferred, not in 1.0.
- FR-45 (global off) — M6.
- FR-46 (copy diagnostics) — M7.
- FR-47 (shortcuts) — M7.

Deferred ideas (not committed): schedules (FR-11), element picker for adapters (FR-36), sync (FR-42), more layout presets, additional languages.

**Implementation note (M5):** FR-24 (single / two column / focus presets) and the spacing half
of FR-25 are deferred. The shipped editor covers FR-20, 21, 22, 23, 25 (reading width), and 26:
outlines, drag and keyboard reorder, hide/show, undo/redo, and the per-site reading width. A
preset needs a cross-site definition that does not guess which sections are secondary; hiding
arbitrary content would violate NFR-03. See `docs/layout-editing.md`.

**Implementation note (M7):** English and Bahasa Indonesia UI, the first-run welcome card,
copyable diagnostics (FR-46), keyboard shortcuts (FR-47), deterministic fuzz tests, the
post-build size budget, and the Playwright + axe-core suite shipped. The automated audit covers
options/popup at 320px, keyboard tabs, focus rings, forced colors, and edit-mode live
announcements. Human usability sessions and a screen-reader pass remain release-checklist items.

**Implementation note (M8):** v1.0.0 ships packaged Chrome and Firefox archives with SHA-256
checksums, a manifest policy check, Trusted Types on extension pages, CodeQL and Dependabot, and
a security E2E suite. The automated accessibility audit has no WCAG A/AA violations. The A09
persistent ring buffer is deferred; **Copy diagnostics** is the on-demand v1.0 path. Screenshot
baselines from the testing strategy are not in CI; functional E2E and axe cover the shipped
flows. Human usability sessions and a manual screen-reader pass remain open in
`docs/release-1.0.md`.

---

## 12. Release Checklist

- [ ] All Must requirements have passing acceptance tests
- [x] Security checklist (8.6) fully ticked
- [ ] Accessibility audit completed with no AA failures
- [ ] Usability test targets met (7.5)
- [x] Permissions, `content_scripts: []`, and CSP match 8.3 for both browsers
- [x] Privacy statement and README updated
- [x] SHA-256 checksums generated for release files
- [x] Rollback: previous build kept in `releases/` and documented in the README

---

## 13. Maintenance Plan

| Task | Frequency |
|---|---|---|
| Check adapters against live sites and fix broken selectors | Monthly, or when a site visibly changes |
| Update dependencies and review audit results | Monthly |
| Re-test on latest Chrome and Firefox | Every browser major release |
| Review permissions and CSP | Every release |
| Review the threat model and decision log | Every two milestones |

**Adapter breakage handling:** when a selector stops matching, the affected section is skipped, a quiet notice appears in the popup, and the rest of the page is untouched. Fixing it means editing one small JSON file.

---

## 14. Risks and Mitigations

| Risk                                                              | Likelihood | Impact | Mitigation                                                                                                       |
| ----------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Sites change layout and break adapters                            | High       | Medium | Skip-on-failure, small adapter files, monthly checks, diagnostics export                                         |
| CSS `order` cannot reorder because the container is not flex/grid | High       | Medium | Capability check before enabling drag; per-section skip with a notice; DOM moves explicitly out of scope (ADR-6) |
| Site framework re-renders and drops injected classes              | Medium     | Medium | Re-apply on mutation, throttled; never move nodes                                                                |
| Users pick unreadable color combinations                          | Medium     | Low    | Contrast matrix with one-click fix                                                                               |
| Page CSP blocks something the extension needs                     | Low        | Medium | No external assets; CSSOM injection; system fonts                                                                |
| Excess permissions reduce trust                                   | Low        | High   | Per-origin optional permissions; empty `content_scripts`; visible privacy panel                                  |
| A dependency is compromised                                       | Low        | High   | Very few dependencies, lockfile, audits                                                                          |
| Site terms restrict modification                                  | Low        | Medium | Local-only presentation changes, no extraction, notice in About                                                  |
| Closed shadow DOM would block testing                             | —          | —      | Avoided by design: open shadow DOM (ADR-2)                                                                       |

---

## 15. Glossary

| Term           | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| Adapter        | A small file that names the sections of one website                     |
| Section        | A named block of a page, such as "Lyrics" or "Recommended"              |
| Theme          | A set of colors and text settings                                       |
| Edit mode      | The state where sections can be moved or hidden                         |
| Content script | The part of the extension that runs inside a web page                   |
| Service worker | The extension's background component                                    |
| CSP            | Content Security Policy, browser rules limiting what code can run       |
| Site ID        | Lowercased hostname with `www.` removed                                 |
| Origin pattern | `scheme://host/*`, used for permission requests and script registration |
| OWASP          | Open Worldwide Application Security Project                             |
| WCAG           | Web Content Accessibility Guidelines                                    |

---

## 16. References for the Team

- OWASP Top 10 (2021)
- OWASP ASVS
- OWASP Cheat Sheet Series: DOM-based XSS Prevention, Content Security Policy, Input Validation
- Chrome Extensions: Manifest V3, `scripting.registerContentScripts`, permissions, CSP
- MDN: WebExtensions, Shadow DOM, `prefers-color-scheme`, `forced-colors`
- W3C WCAG 2.2

---

## 17. Decision Log

| ID     | Decision                                                           | Rationale                                                                                      | Consequence                                                           |
| ------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| ADR-1  | No bundled webfonts in v1; system stacks only                      | Met the 250 KB budget, keeps WAR empty, avoids page-CSP font blocking                          | Slightly less distinctive typography; revisit with subset fonts in v2 |
| ADR-2  | Open Shadow DOM, namespaced classes                                | axe-core and Playwright cannot inspect closed roots; isolation comes from scoping, not secrecy | Page scripts can inspect the host; accepted                           |
| ADR-3  | Permission requested from a Joevix pre-prompt button               | Browser dialogs cannot be customized; `permissions.request` needs a user gesture               | One extra click on first enable                                       |
| ADR-4  | Popup applies instantly; custom editor is staged with Apply/Cancel | Matches user expectation for one-click themes while protecting fine-tuning                     | Two commit models, documented                                         |
| ADR-5  | `siteId` = hostname minus `www.`                                   | Simple, predictable, no public-suffix list needed                                              | Subdomains are separate sites; documented                             |
| ADR-6  | Reorder by CSS `order` only; no DOM moves                          | Reversible, does not fight frameworks, small attack surface                                    | Requires flex/grid container; skipped otherwise                       |
| ADR-7  | Adapters bundled and read-only; no user adapters                   | Removes an untrusted-input boundary and the element-picker scope                               | FR-36 deferred                                                        |
| ADR-8  | Allowlisted CSS properties, values rebuilt from typed data         | Blocks CSS exfiltration and injection                                                          | Some styling ideas need new allowlist entries                         |
| ADR-9  | Contrast fix preserves hue and saturation                          | Keeps the user's intent while meeting AA                                                       | May need many lightness steps; capped at 100                          |
| ADR-10 | Undo history is session-scoped and cleared on Done                 | Simple, predictable mental model                                                               | No cross-session undo                                                 |
| ADR-11 | Storage access is service-worker only                              | Keeps the content script unprivileged                                                          | One extra message hop                                                 |
| ADR-12 | One import envelope, 256 KB, versioned                             | Single code path to fuzz and validate                                                          | Theme-only export is a filtered export of the same shape              |
| ADR-13 | No `frame-ancestors` in the extension CSP                          | It is ignored there; listing it implies protection that does not exist                         | Extension pages are not embeddable anyway                             |
| ADR-14 | Lint ban list instead of trusting CSP alone                        | CSP does not cover every network channel (beacons, image loads)                                | Some legitimate APIs are unavailable                                  |

---

## 18. Traceability Matrix

Must requirements, their milestone, and their primary test.

| Requirement                 | Milestone | Primary test                                    |
| --------------------------- | --------- | ----------------------------------------------- |
| FR-01 Built-in themes       | M1        | Unit: every theme has six valid colors          |
| FR-02 System mode           | M1        | E2E: system light/dark change updates `--jx-bg` |
| FR-03 Color wheel           | M3        | Unit: color math; pointer drag manual           |
| FR-04 Hex/RGB/HSL entry     | M3        | Unit: parser round-trip and rejects             |
| FR-05 Six color roles       | M1        | Unit: CSS output contains each role             |
| FR-06 Contrast + fix        | M3        | Unit: fix reaches ≥ 4.5 for 1000 random pairs   |
| FR-07 Font controls         | M1        | E2E: theme size persists after reload           |
| FR-09 Live preview / Cancel | M3        | Unit: draft cancel restores prior state         |
| FR-20 Section outlines      | M5        | E2E: fixture outlines only declared sections    |
| FR-21 Drag reorder          | M5        | E2E: reorder via Move up; drag gesture manual   |
| FR-22 Keyboard reorder      | M5        | Unit: keyboard move and focus retention         |
| FR-23 Hide/show             | M5        | E2E: hidden section stays hidden after reload   |
| FR-26 Undo/redo             | M5        | Unit: history stack cap and ordering            |
| FR-27 Reset site            | M2        | E2E: page equals baseline after reset           |
| FR-30 Per-site settings     | M1        | Unit: two sites keep independent configs        |
| FR-31 Site switch           | M1        | E2E: off removes styles immediately             |
| FR-32 Permission flow       | M2        | Manual: native grant/denial; sender unit        |
| FR-33 Adapter format        | M4        | Unit: schema rejects bad adapters               |
| FR-34 Generic fallback      | M1        | Unit: no adapter; manual themed fallback        |
| FR-35 SPA re-apply          | M2        | E2E: attribute rewrite keeps theme              |
| FR-38 Safe mode             | M2        | E2E: reset restores baseline                    |
| FR-37 Cross-tab sync        | M2        | E2E: second tab updates after a theme change    |
| FR-40 Local storage         | M1        | Unit + E2E: values survive reload               |
| FR-43 Delete all            | M6        | E2E: storage and dynamic scripts cleared        |
| FR-44 Privacy panel         | M6        | Manual: text matches storage keys               |
| FR-45 Global off            | M6        | E2E: all tabs stop and resume applying          |
| NFR-01 Size                 | M1        | CI size budget check                            |
| NFR-05 Accessibility        | M7        | axe-core automated + manual screen reader       |
| NFR-06 Zero network         | M7        | Playwright request capture + lint bans          |
| NFR-10 Storage quota        | M6        | Code review: quota mapped to friendly message   |

---

## 19. Open Questions

| ID  | Question                                                       | Owner      | Needed by                                                                                                       |
| --- | -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| Q-1 | Should `m.` subdomains share settings with their parent?       | Maintainer | M2                                                                                                              |
| Q-2 | Is a public-suffix list worth adding for eTLD+1 site IDs?      | Maintainer | Post-1.0                                                                                                        |
| Q-3 | Which first real adapter (which lyrics site) is the reference? | Maintainer | **Decided (M4): Genius lyric pages** — `data-lyrics-container` and `data-testid="song-header"` are stable hooks |
| Q-4 | Do we want Firefox in 1.0 or as 1.1?                           | Maintainer | M7                                                                                                              |
