// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdapterSchema } from '../../src/core/layout/adapter';
import {
  containerSupportsOrder,
  detectSections,
  summarizeDetection,
} from '../../src/core/layout/detect';

const genius = AdapterSchema.parse({
  id: 'genius',
  schemaVersion: 1,
  match: ['https://genius.com/*-lyrics*'],
  container: 'main',
  sections: [
    { key: 'info', label: 'Song info', selector: '[data-testid="song-header"]' },
    { key: 'lyrics', label: 'Lyrics', selector: '[data-lyrics-container="true"]' },
    { key: 'related', label: 'Recommended', selector: '[class*="RecommendedSongs__Container"]' },
    { key: 'comments', label: 'Comments', selector: '[class*="SongCommentsWithAds__Container"]' },
  ],
});

function element(tag: string, attributes: Record<string, string>, text: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.textContent = text;
  return node;
}

function fixture(): Document {
  const main = document.createElement('main');
  const root = element('div', { id: 'lyrics-root' }, '');
  root.style.display = 'flex';
  root.style.flexDirection = 'column';

  root.append(
    element('div', { 'data-lyrics-container': 'true' }, 'One'),
    element('div', { 'data-lyrics-container': 'true' }, 'Two'),
    element('aside', { class: 'RecommendedSongs__Container' }, 'Related'),
  );

  main.append(element('div', { 'data-testid': 'song-header' }, 'Header'), root);
  document.body.replaceChildren(main);
  return document;
}

describe('detectSections', () => {
  it('finds every declared section, including repeated ones', () => {
    const detection = detectSections(genius, fixture());
    const lyrics = detection.sections.find((section) => section.key === 'lyrics')!;
    expect(lyrics.elements).toHaveLength(2);
    expect(detection.missing).toEqual(['comments']);
    expect(detection.container?.tagName).toBe('MAIN');
  });

  it('summarizes found and missing sections', () => {
    const summary = summarizeDetection(detectSections(genius, fixture()));
    expect(summary).toEqual({ found: 3, missing: 1, reorderable: 1 });
  });

  it('marks only single direct children as reorderable', () => {
    const detection = detectSections(genius, fixture());
    expect(detection.reorderable).toEqual(['info']);
  });

  it('returns an empty result when the container is missing', () => {
    document.body.replaceChildren(element('div', {}, 'Nothing here'));
    const detection = detectSections(genius, document);
    expect(detection.container).toBeNull();
    expect(detection.missing).toEqual(['info', 'lyrics', 'related', 'comments']);
    expect(summarizeDetection(detection)).toEqual({ found: 0, missing: 4, reorderable: 0 });
  });

  it('never throws on an unsafe container', () => {
    const detection = detectSections(genius, document, 'main { color: red }');
    expect(detection.container).toBeNull();
    expect(detection.missing).toHaveLength(4);
  });

  it('skips a broken selector without losing the other sections', () => {
    const broken = {
      ...genius,
      sections: [
        genius.sections[0]!,
        { key: 'gone', label: 'Gone', selector: '.does-not-exist', defaultHidden: false },
      ],
    };
    const detection = detectSections(broken, fixture());
    expect(detection.missing).toEqual(['gone']);
    expect(detection.sections[0]?.elements).toHaveLength(1);
  });
});

describe('Genius fixture', () => {
  it('detects the shipped selectors against trimmed live markup', () => {
    const html = readFileSync(join(process.cwd(), 'tests/fixtures/genius-lyrics.html'), 'utf8');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const detection = detectSections(genius, parsed);

    expect(detection.container?.tagName).toBe('MAIN');
    expect(detection.missing).toEqual([]);
    expect(detection.sections.find((section) => section.key === 'lyrics')?.elements).toHaveLength(
      3,
    );
    expect(detection.sections.find((section) => section.key === 'related')?.elements).toHaveLength(
      1,
    );
    expect(detection.reorderable).toEqual(['info']);
  });
});

describe('containerSupportsOrder', () => {
  it('accepts flex and grid containers', () => {
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    expect(containerSupportsOrder(flex)).toBe(true);
    expect(containerSupportsOrder(grid)).toBe(true);
  });

  it('rejects block containers and null', () => {
    const block = document.createElement('div');
    block.style.display = 'block';
    expect(containerSupportsOrder(block)).toBe(false);
    expect(containerSupportsOrder(null)).toBe(false);
  });
});
