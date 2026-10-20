import { z } from 'zod';
import {
  SettingsSchema,
  SiteConfigSchema,
  ThemeIdSchema,
  ThemeSchema,
  type Settings,
  type SiteConfig,
  type Theme,
} from './model';

/* ------------------------------------------------------------------ */
/* UI -> service worker                                                */
/* ------------------------------------------------------------------ */

const UrlSchema = z.string().min(1).max(2048);
const TabIdSchema = z.number().int().nonnegative().optional();
const AnyThemeIdSchema = z.union([z.literal('system'), ThemeIdSchema]);

export const UiCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('get-site-state'), url: UrlSchema, tabId: TabIdSchema }),
  z.object({ type: z.literal('set-theme'), url: UrlSchema, themeId: AnyThemeIdSchema, tabId: TabIdSchema }),
  z.object({
    type: z.literal('set-font-size'),
    url: UrlSchema,
    sizePx: z.number().int().min(12).max(40),
    tabId: TabIdSchema,
  }),
  z.object({ type: z.literal('set-enabled'), url: UrlSchema, enabled: z.boolean(), tabId: TabIdSchema }),
  z.object({ type: z.literal('reset-site'), url: UrlSchema, tabId: TabIdSchema }),
  z.object({ type: z.literal('set-enabled-everywhere'), enabled: z.boolean() }),
  z.object({ type: z.literal('get-themes') }),
  z.object({ type: z.literal('get-sites') }),
  z.object({ type: z.literal('get-settings') }),
  z.object({ type: z.literal('save-theme'), theme: ThemeSchema }),
  z.object({ type: z.literal('delete-theme'), themeId: ThemeIdSchema }),
  z.object({ type: z.literal('preview-theme'), theme: ThemeSchema }),
  z.object({ type: z.literal('end-preview') }),
  z.object({ type: z.literal('delete-site'), siteId: z.string().min(1).max(253) }),
  z.object({ type: z.literal('export-data') }),
  z.object({ type: z.literal('import-data'), json: z.string().max(300_000), mode: z.enum(['replace', 'merge']) }),
  z.object({ type: z.literal('delete-all') }),
  z.object({ type: z.literal('get-diagnostics') }),
]);

export type UiCommand = z.infer<typeof UiCommandSchema>;

/* ------------------------------------------------------------------ */
/* service worker -> content script                                    */
/* ------------------------------------------------------------------ */

export const ApplyPayloadSchema = z.object({
  config: SiteConfigSchema,
  /** null means "follow the system scheme" and use `system`. */
  theme: ThemeSchema.nullable(),
  system: z.object({ light: ThemeSchema, dark: ThemeSchema }).nullable(),
});

export type ApplyPayload = z.infer<typeof ApplyPayloadSchema>;

export const ContentCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('apply'), payload: ApplyPayloadSchema }),
  z.object({ type: z.literal('reset') }),
]);

export type ContentCommand = z.infer<typeof ContentCommandSchema>;

/* ------------------------------------------------------------------ */
/* content script -> service worker                                    */
/* ------------------------------------------------------------------ */

export const ContentHelloSchema = z.object({
  type: z.literal('content-hello'),
  url: UrlSchema,
});

export type ContentHello = z.infer<typeof ContentHelloSchema>;

/* ------------------------------------------------------------------ */
/* responses                                                           */
/* ------------------------------------------------------------------ */

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: string };
export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function fail(error: string): Err {
  return { ok: false, error };
}

export type SiteState = {
  siteId: string;
  originPattern: string;
  supported: boolean;
  hasPermission: boolean;
  config: SiteConfig;
  themes: Theme[];
  settings: Settings;
  /** The site pointed at a theme that no longer exists. */
  missingTheme: boolean;
  adapterAvailable: boolean;
};

export type Diagnostics = {
  version: string;
  siteId: string | null;
  adapterId: string | null;
  createdAt: number;
};

export type ExportPayload = {
  json: string;
};

export type ImportSummary = {
  themes: number;
  sites: number;
};

export const DEFAULT_SETTINGS_FALLBACK: Settings = SettingsSchema.parse({});
