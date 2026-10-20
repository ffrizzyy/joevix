export type ParsedSiteUrl = {
  url: URL;
  siteId: string;
  origin: string;
  /** Match pattern for permissions.request and registerContentScripts. */
  originPattern: string;
};

/** Lowercased hostname with a single leading "www." removed (ADR-5). */
export function siteIdFromHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

export function parseSiteUrl(raw: string | undefined | null): ParsedSiteUrl | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname) return null;

  return {
    url,
    siteId: siteIdFromHostname(url.hostname),
    origin: `${url.protocol}//${url.hostname}`,
    // Match patterns do not allow ports.
    originPattern: `${url.protocol}//${url.hostname}/*`,
  };
}

export function isSupportedUrl(raw: string | undefined | null): boolean {
  return parseSiteUrl(raw) !== null;
}
