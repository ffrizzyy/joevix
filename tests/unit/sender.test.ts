import { describe, expect, it } from 'vitest';
import { isExtensionPageSender } from '../../src/core/sender';

const ID = 'abcdefghijklmnop';
const BASE = `chrome-extension://${ID}/`;

describe('sender classification', () => {
  it('accepts options and popup pages, including options in a tab', () => {
    expect(isExtensionPageSender({ id: ID, url: `${BASE}options.html` }, ID, BASE)).toBe(true);
    expect(isExtensionPageSender({ id: ID, url: `${BASE}popup.html` }, ID, BASE)).toBe(true);
    expect(
      isExtensionPageSender(
        { id: ID, url: `${BASE}options.html`, tab: { id: 4 } } as never,
        ID,
        BASE,
      ),
    ).toBe(true);
  });

  it('rejects content scripts, other extensions, and missing ids', () => {
    expect(isExtensionPageSender({ id: ID, url: 'https://genius.com/a-lyrics' }, ID, BASE)).toBe(
      false,
    );
    expect(isExtensionPageSender({ id: 'other', url: `${BASE}options.html` }, ID, BASE)).toBe(
      false,
    );
    expect(isExtensionPageSender({ url: `${BASE}options.html` }, ID, BASE)).toBe(false);
    expect(isExtensionPageSender({ id: ID, url: BASE }, ID, '')).toBe(false);
  });
});
