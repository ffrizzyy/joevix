import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';
import { ADAPTERS } from './src/adapters';

// Importing the registry runs every bundled adapter through AdapterSchema, so a
// malformed selector or match pattern fails the build before it can ship.
void ADAPTERS;

const EXTENSION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
].join('; ');

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.options_ui) manifest.options_ui.open_in_tab = true;
    },
  },
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: ({ browser, mode }) => ({
    name: 'Joevix',
    description: 'Restyle and rearrange pages on your own screen. Nothing leaves your device.',
    permissions: ['storage', 'activeTab', 'scripting'],
    // Content scripts are registered per origin at runtime, never declared here.
    content_scripts: [],
    web_accessible_resources: [],
    content_security_policy: {
      extension_pages:
        // Vite injects <style> during development; production stays strict.
        mode === 'development'
          ? EXTENSION_CSP.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          : EXTENSION_CSP,
    },
    options_ui: {
      open_in_tab: true,
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+J' },
      },
      'toggle-edit': {
        suggested_key: { default: 'Alt+Shift+E' },
        description: 'Start or cancel layout editing',
      },
      'cycle-theme': {
        suggested_key: { default: 'Alt+Shift+T' },
        description: 'Switch to the next theme on this site',
      },
    },
    ...(browser === 'firefox'
      ? {
          optional_permissions: ['https://*/*', 'http://*/*'],
          browser_specific_settings: {
            gecko: { id: 'joevix@local', strict_min_version: '128.0' },
          },
        }
      : {
          optional_host_permissions: ['https://*/*', 'http://*/*'],
        }),
  }),
});
