import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';

const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;
const releaseDir = resolve('releases', `v${version}`);
const wxtBin = resolve('node_modules', 'wxt', 'bin', 'wxt.mjs');

function runNode(args) {
  execFileSync(process.execPath, args, { stdio: 'inherit' });
}

function hash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// `wxt zip` builds the extension before archiving it, so each zip is produced
// from the current source tree. The manifest and size checks gate the copy.
runNode([wxtBin, 'zip']);
runNode([wxtBin, 'zip', '-b', 'firefox']);
runNode([resolve('scripts', 'check-manifest.mjs')]);
runNode([resolve('scripts', 'check-size.mjs'), '.output/chrome-mv3', '.output/firefox-mv3']);

const zips = [
  resolve('.output', `joevix-${version}-chrome.zip`),
  resolve('.output', `joevix-${version}-firefox.zip`),
];

for (const zip of zips) {
  if (!existsSync(zip)) {
    console.error(`FAIL: expected release artifact is missing: ${zip}`);
    process.exit(1);
  }
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

const files = [];
for (const zip of zips) {
  const target = resolve(releaseDir, basename(zip));
  copyFileSync(zip, target);
  files.push({
    name: basename(zip),
    bytes: statSync(target).size,
    sha256: hash(target),
  });
}

const checksumLines = files.map((file) => `${file.sha256}  ${file.name}`).join('\n');
writeFileSync(resolve(releaseDir, 'SHA256SUMS.txt'), `${checksumLines}\n`);
writeFileSync(
  resolve(releaseDir, 'release.json'),
  `${JSON.stringify(
    {
      name: 'Joevix',
      version,
      builtAt: new Date().toISOString(),
      files,
    },
    null,
    2,
  )}\n`,
);

console.log(`\nRelease v${version} written to ${releaseDir}`);
console.log(checksumLines);
