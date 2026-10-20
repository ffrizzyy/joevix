import { z } from 'zod';
import { isSafeSelector } from './sections';

/**
 * An adapter is data we ship, not input we accept (ADR-7). It names the
 * sections of one site. Everything here is validated when the bundle loads
 * and again in the adapter tests.
 */

const MatchPatternSchema = z
  .string()
  .min(10)
  .max(300)
  .refine(
    (pattern) => /^https?:\/\/(\*\.)?[a-z0-9.-]+\/[^\s]*$/.test(pattern) && !pattern.includes('..'),
    'Use https://host/path with an optional *. subdomain.',
  );

export const AdapterSectionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  label: z.string().min(1).max(60),
  selector: z.string().min(1).max(300),
  defaultHidden: z.boolean().optional(),
});

export const AdapterSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    schemaVersion: z.number().int().min(1).max(1000),
    match: z.array(MatchPatternSchema).min(1).max(20),
    container: z.string().min(1).max(300),
    sections: z.array(AdapterSectionSchema).min(1).max(100),
  })
  .superRefine((adapter, context) => {
    if (!isSafeSelector(adapter.container)) {
      context.addIssue({
        code: 'custom',
        message: `Unsafe container selector: ${adapter.container}`,
        path: ['container'],
      });
    }

    const keys = new Set<string>();
    adapter.sections.forEach((section, index) => {
      if (keys.has(section.key)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate section key: ${section.key}`,
          path: ['sections', index, 'key'],
        });
      }
      keys.add(section.key);

      if (!isSafeSelector(section.selector)) {
        context.addIssue({
          code: 'custom',
          message: `Unsafe section selector: ${section.selector}`,
          path: ['sections', index, 'selector'],
        });
      }
    });
  });

export type Adapter = z.infer<typeof AdapterSchema>;
export type AdapterSection = z.infer<typeof AdapterSectionSchema>;

/** Parses a bundled adapter list, rejecting invalid or duplicate ids. */
export function parseAdapters(inputs: readonly unknown[]): Adapter[] {
  const seen = new Set<string>();
  return inputs.map((input, index) => {
    const parsed = AdapterSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`Adapter ${index} is invalid: ${issue?.path.join('.')} ${issue?.message}`);
    }
    if (seen.has(parsed.data.id)) {
      throw new Error(`Duplicate adapter id: ${parsed.data.id}`);
    }
    seen.add(parsed.data.id);
    return parsed.data;
  });
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Match patterns are the small subset documented in the adapter guide. */
export function matchesUrl(adapter: Adapter, url: string): boolean {
  return adapter.match.some((pattern) => patternToRegExp(pattern).test(url));
}

export function findAdapter(adapters: readonly Adapter[], url: string): Adapter | null {
  return adapters.find((adapter) => matchesUrl(adapter, url)) ?? null;
}
