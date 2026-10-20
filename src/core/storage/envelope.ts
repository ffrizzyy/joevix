import { z } from 'zod';
import { t } from '../i18n';
import {
  LIMITS,
  SCHEMA_VERSION,
  SettingsSchema,
  SitesRecordSchema,
  ThemesArraySchema,
  type Settings,
  type SitesRecord,
  type Theme,
} from '../model';

export const EXPORT_KIND = 'joevix-export';

export const EnvelopeSchema = z.object({
  kind: z.literal(EXPORT_KIND),
  schemaVersion: z.number().int().min(1).max(1000),
  exportedAt: z.number().int().nonnegative(),
  themes: ThemesArraySchema,
  sites: SitesRecordSchema,
  settings: SettingsSchema.optional(),
});

export type ExportEnvelope = z.infer<typeof EnvelopeSchema>;

export function makeEnvelope(input: {
  themes: Theme[];
  sites: SitesRecord;
  settings?: Settings;
}): ExportEnvelope {
  return {
    kind: EXPORT_KIND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    themes: input.themes,
    sites: input.sites,
    ...(input.settings ? { settings: input.settings } : {}),
  };
}

export type ParseResult =
  | { ok: true; value: ExportEnvelope }
  | { ok: false; error: string };

/** Validates size first, then shape, then caps (spec 8.4). */
export function parseEnvelope(text: string): ParseResult {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > LIMITS.importBytes) {
    return { ok: false, error: t('importTooLarge') };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: t('importInvalidJson') };
  }

  const parsed = EnvelopeSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: t('importInvalidBackup') };
  }

  if (Object.keys(parsed.data.sites).length > LIMITS.sites) {
    return { ok: false, error: t('importTooManySites') };
  }

  return { ok: true, value: parsed.data };
}
