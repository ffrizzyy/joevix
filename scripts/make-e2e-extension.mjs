import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('.output/chrome-mv3');
const destination = resolve('.output/e2e-chrome');

rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

const manifestPath = resolve(destination, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// The E2E build skips the native permission dialog, which Playwright cannot
// click. Everything else (background, content script, schemas) is unchanged.
manifest.host_permissions = ['https://genius.com/*'];
manifest.content_scripts = [
  {
    matches: ['https://genius.com/*'],
    js: ['inject.js'],
    run_at: 'document_start',
  },
];

writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`E2E extension written to ${destination}`);
