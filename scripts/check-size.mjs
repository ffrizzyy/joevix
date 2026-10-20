import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const TOTAL_BUDGET = 250 * 1024;
const CONTENT_BUDGET = 40 * 1024;
const dirs = process.argv.slice(2);
if (dirs.length === 0) dirs.push('.output/chrome-mv3');

let failed = false;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

for (const dir of dirs) {
  let total = 0;
  let content = null;
  for (const file of walk(dir)) {
    const bytes = statSync(file).size;
    total += bytes;
    if (file.endsWith('inject.js')) content = readFileSync(file);
  }

  console.log(`${dir}: ${(total / 1024).toFixed(1)} KB total (budget ${TOTAL_BUDGET / 1024} KB)`);
  if (total > TOTAL_BUDGET) {
    console.error('FAIL: package exceeds the size budget (NFR-01).');
    failed = true;
  }

  if (content) {
    const gzip = gzipSync(content).length;
    console.log(
      `${dir}/inject.js: ${(content.length / 1024).toFixed(1)} KB raw, ${(gzip / 1024).toFixed(
        1,
      )} KB gzip (budget ${CONTENT_BUDGET / 1024} KB gzip)`,
    );
    if (gzip > CONTENT_BUDGET) {
      console.error('FAIL: content script exceeds the size budget (NFR-01).');
      failed = true;
    }
  } else {
    console.error(`FAIL: ${dir}/inject.js is missing.`);
    failed = true;
  }
}

if (failed) process.exit(1);
