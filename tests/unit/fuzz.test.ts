import { describe, expect, it } from 'vitest';
import { AdapterSchema } from '../../src/core/layout/adapter';
import { isSafeSelector } from '../../src/core/layout/sections';
import { LayoutSaveSchema, UiCommandSchema } from '../../src/core/messaging';
import { parseSiteUrl } from '../../src/core/site';
import { parseEnvelope } from '../../src/core/storage/envelope';
import { normalizeColor, parseColor } from '../../src/core/theme/color';

/** Deterministic LCG so a failure is reproducible from the seed. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const STRINGS = [
  '',
  'system',
  'builtin:light',
  '#fff',
  '#123456',
  'https://genius.com/a-lyrics',
  'javascript:alert(1)',
  '\u0000\n\t',
  '<script>alert(1)</script>',
  'a'.repeat(400),
];

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)] as T;
}

function value(random: () => number, depth = 0): unknown {
  const choice = Math.floor(random() * 8);
  if (choice === 0) return pick(random, STRINGS);
  if (choice === 1) return random() * 2000 - 1000;
  if (choice === 2) return random() > 0.5;
  if (choice === 3) return null;
  if (choice === 4 || depth >= 3) return { random: pick(random, STRINGS) };

  if (choice === 5) {
    return Array.from({ length: Math.floor(random() * 5) }, () => value(random, depth + 1));
  }

  const object: Record<string, unknown> = {};
  for (let index = 0; index < Math.floor(random() * 5); index += 1) {
    object[pick(random, STRINGS).slice(0, 20) || `k${index}`] = value(random, depth + 1);
  }
  return object;
}

describe('fuzzing untrusted input', () => {
  it('never throws while validating random values', () => {
    const random = rng(0x5eed);
    for (let index = 0; index < 300; index += 1) {
      const input = value(random);
      expect(() => parseEnvelope(JSON.stringify(input))).not.toThrow();
      expect(() => parseEnvelope(pick(random, STRINGS))).not.toThrow();
      expect(() => AdapterSchema.safeParse(input)).not.toThrow();
      expect(() => LayoutSaveSchema.safeParse(input)).not.toThrow();
      expect(() => UiCommandSchema.safeParse(input)).not.toThrow();
      expect(() => normalizeColor(pick(random, STRINGS))).not.toThrow();
      expect(() => parseColor(pick(random, STRINGS))).not.toThrow();
      expect(() => isSafeSelector(pick(random, STRINGS))).not.toThrow();
      expect(() => parseSiteUrl(pick(random, STRINGS))).not.toThrow();
    }
  });

  it('rejects random envelopes without replacing anything', () => {
    const random = rng(42);
    for (let index = 0; index < 100; index += 1) {
      const result = parseEnvelope(JSON.stringify(value(random)));
      if (result.ok) {
        // A random object is allowed only if it exactly matches the schema.
        expect(result.value.kind).toBe('joevix-export');
        expect(Object.keys(result.value.sites).length).toBeLessThanOrEqual(500);
      } else {
        expect(typeof result.error).toBe('string');
      }
    }
  });
});
