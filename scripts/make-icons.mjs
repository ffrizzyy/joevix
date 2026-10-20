import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const sizes = [16, 32, 48, 128];
const svg = readFileSync(resolve('public', 'favicon.svg'), 'utf8');
const outputDir = resolve('public', 'icon');
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
await page.setContent(
  `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
);

for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.evaluate((nextSize) => {
    const icon = document.querySelector('svg');
    if (!icon) throw new Error('Icon SVG is missing.');
    icon.setAttribute('width', String(nextSize));
    icon.setAttribute('height', String(nextSize));
  }, size);
  const png = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  writeFileSync(resolve(outputDir, `${size}.png`), png);
  console.log(`public/icon/${size}.png`);
}

await browser.close();
