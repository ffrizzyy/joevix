import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packages = [
  { browser: 'chrome', dir: '.output/chrome-mv3' },
  { browser: 'firefox', dir: '.output/firefox-mv3' },
];

const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;
const expectedCsp =
  "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types 'none'";
const expectedPermissions = ['activeTab', 'scripting', 'storage'];
const expectedOrigins = ['http://*/*', 'https://*/*'];

let failed = false;

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed = true;
  }
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === expected[index])
  );
}

for (const pkg of packages) {
  const manifest = JSON.parse(readFileSync(resolve(pkg.dir, 'manifest.json'), 'utf8'));
  const label = pkg.browser;

  check(manifest.manifest_version === 3, `${label}: manifest_version must be 3`);
  check(manifest.name === 'Joevix', `${label}: name must be Joevix`);
  check(manifest.version === version, `${label}: version ${manifest.version} != ${version}`);
  check(
    sameSet(manifest.permissions, expectedPermissions),
    `${label}: permissions must be exactly ${expectedPermissions.join(', ')}`,
  );
  check(manifest.host_permissions === undefined, `${label}: host_permissions must not be declared`);
  check(
    manifest.content_scripts?.length === 0,
    `${label}: content_scripts must stay empty (runtime registration only)`,
  );
  check(
    Array.isArray(manifest.web_accessible_resources) &&
      manifest.web_accessible_resources.length === 0,
    `${label}: web_accessible_resources must stay empty`,
  );
  check(
    manifest.content_security_policy?.extension_pages === expectedCsp,
    `${label}: extension_pages CSP does not match spec 8.3`,
  );
  check(
    manifest.externally_connectable === undefined,
    `${label}: externally_connectable must not be declared`,
  );
  check(manifest.action?.default_popup === 'popup.html', `${label}: action popup is missing`);
  check(
    sameSet(manifest.commands ? Object.keys(manifest.commands) : [], [
      '_execute_action',
      'cycle-theme',
      'toggle-edit',
    ]),
    `${label}: the three FR-47 commands must be registered`,
  );

  if (pkg.browser === 'chrome') {
    check(
      sameSet(manifest.optional_host_permissions, expectedOrigins),
      `${label}: optional_host_permissions must be exactly ${expectedOrigins.join(', ')}`,
    );
    check(
      manifest.background?.service_worker === 'background.js',
      `${label}: service worker entry is missing`,
    );
    check(
      manifest.optional_permissions === undefined,
      `${label}: optional_permissions is the Firefox key`,
    );
  } else {
    check(
      sameSet(manifest.optional_permissions, expectedOrigins),
      `${label}: optional_permissions must be exactly ${expectedOrigins.join(', ')}`,
    );
    check(
      sameSet(manifest.background?.scripts, ['background.js']),
      `${label}: background event page is missing`,
    );
    check(
      manifest.optional_host_permissions === undefined,
      `${label}: optional_host_permissions is the Chrome key`,
    );
    check(
      manifest.browser_specific_settings?.gecko?.strict_min_version === '128.0',
      `${label}: gecko strict_min_version must be 128.0`,
    );
  }

  const serialized = JSON.stringify(manifest);
  check(!serialized.includes('<all_urls>'), `${label}: <all_urls> is banned`);
  check(!serialized.includes('*://*/*'), `${label}: wildcard scheme origins are banned`);

  if (!failed) console.log(`${label}: manifest OK (v${manifest.version})`);
}

if (failed) process.exit(1);
