import { describe, expect, it } from 'vitest';
import { isSupportedUrl, parseSiteUrl, siteIdFromHostname } from '../../src/core/site';

describe('siteIdFromHostname', () => {
  it('lowercases and strips one www', () => {
    expect(siteIdFromHostname('WWW.Example.COM')).toBe('example.com');
    expect(siteIdFromHostname('www.www.example.com')).toBe('www.example.com');
  });
});

describe('parseSiteUrl', () => {
  it('accepts https and strips www from the site id but not the origin', () => {
    const parsed = parseSiteUrl('https://www.example.com/song/1?x=1');
    expect(parsed).not.toBeNull();
    expect(parsed!.siteId).toBe('example.com');
    expect(parsed!.originPattern).toBe('https://www.example.com/*');
  });

  it('keeps subdomains separate (ADR-5)', () => {
    const sub = parseSiteUrl('https://m.example.com/a');
    const root = parseSiteUrl('https://example.com/a');
    expect(sub!.siteId).toBe('m.example.com');
    expect(root!.siteId).toBe('example.com');
  });

  it('drops the port from the match pattern', () => {
    const parsed = parseSiteUrl('http://localhost:3000/app');
    expect(parsed!.originPattern).toBe('http://localhost/*');
    expect(parsed!.siteId).toBe('localhost');
  });

  it('rejects non-http schemes', () => {
    expect(parseSiteUrl('chrome://settings')).toBeNull();
    expect(parseSiteUrl('about:blank')).toBeNull();
    expect(parseSiteUrl('file:///C:/secret.html')).toBeNull();
    expect(parseSiteUrl('chrome-extension://abc/popup.html')).toBeNull();
    expect(parseSiteUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects junk', () => {
    expect(parseSiteUrl(undefined)).toBeNull();
    expect(parseSiteUrl('')).toBeNull();
    expect(parseSiteUrl('not a url')).toBeNull();
  });

  it('answers isSupportedUrl', () => {
    expect(isSupportedUrl('https://example.com')).toBe(true);
    expect(isSupportedUrl('about:blank')).toBe(false);
  });
});
