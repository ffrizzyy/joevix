import { useEffect, useRef, useState } from 'preact/hooks';
import { t, type MessageKey } from '../../core/i18n';
import type { ColorRole, Theme, ThemeColors, ThemeFont } from '../../core/model';
import { hslToRgb, normalizeColor, parseColor, rgbToHsl, toHex } from '../../core/theme/color';
import { auditTheme, fixThemeContrast } from '../../core/theme/contrast';
import { fontStack } from '../../core/theme/css';
import { COLOR_PRESETS } from '../../core/theme/presets';
import { COLOR_ROLES } from '../../core/theme/roles';
import { themeLabel } from '../../ui/theme-name';
import { ColorWheel } from './color-wheel';

export type Draft = {
  /** null means "not saved yet"; the id is generated on save. */
  id: string | null;
  name: string;
  colors: ThemeColors;
  font: ThemeFont;
};

const ROLE_LABELS: Record<ColorRole, MessageKey> = {
  background: 'roleBackground',
  surface: 'roleSurface',
  text: 'roleText',
  muted: 'roleMuted',
  accent: 'roleAccent',
  border: 'roleBorder',
};

const FAMILY_LABELS: Record<ThemeFont['family'], MessageKey> = {
  system: 'familySystem',
  serif: 'familySerif',
  mono: 'familyMono',
};

const PRESET_LABELS: Record<string, MessageKey> = {
  bone: 'presetBone',
  slate: 'presetSlate',
  forest: 'presetForest',
  plum: 'presetPlum',
  sand: 'presetSand',
  ink: 'presetInk',
};

function presetLabel(id: string, fallback: string): string {
  const key = PRESET_LABELS[id];
  return key ? t(key) : fallback;
}

/**
 * Builds an editor draft. `copy` forces a new id, so duplicating a custom
 * theme never overwrites the original on save.
 */
export function draftFromTheme(theme: Theme, copy = false): Draft {
  const asCopy = copy || theme.builtin;
  return {
    id: asCopy ? null : theme.id,
    name: asCopy ? `${themeLabel(theme)} ${t('duplicateSuffix')}` : themeLabel(theme),
    colors: { ...theme.colors },
    font: { ...theme.font },
  };
}

export function draftToTheme(draft: Draft, id?: string): Theme {
  return {
    schemaVersion: 1,
    id: id ?? draft.id ?? 'custom:draft',
    name: draft.name.trim() || t('untitledTheme'),
    mode: 'custom',
    builtin: false,
    colors: { ...draft.colors },
    font: { ...draft.font },
  };
}

type Props = {
  draft: Draft;
  isNew: boolean;
  saving: boolean;
  error: string | null;
  previewed: number;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ThemeEditor(props: Props) {
  const [role, setRole] = useState<ColorRole>('background');
  const { draft } = props;

  const selected = draft.colors[role];
  const [hexText, setHexText] = useState(selected);
  const hexFocused = useRef(false);
  const rgb = parseColor(selected) ?? { r: 0, g: 0, b: 0 };
  const hsl = rgbToHsl(rgb);
  const hexInvalid = hexText.trim().length > 0 && normalizeColor(hexText) === null;

  useEffect(() => {
    // Never rewrite the field under the caret: it would turn "#abc" into
    // "#aabbcc" mid-typing. The blur handler normalizes once editing ends.
    if (!hexFocused.current) setHexText(selected);
  }, [selected]);

  function setColor(next: string): void {
    const normalized = normalizeColor(next);
    if (!normalized) return;
    props.onChange({ ...draft, colors: { ...draft.colors, [role]: normalized } });
  }

  function setFont(patch: Partial<ThemeFont>): void {
    props.onChange({ ...draft, font: { ...draft.font, ...patch } });
  }

  const preview = draftToTheme(draft);
  const checks = auditTheme(preview);
  const failing = checks.filter((check) => !check.passes);

  return (
    <div class="editor">
      <header class="editor-head">
        <div>
          <h2 class="section-title tight">
            {props.isNew ? t('newThemeTitle') : t('editingTheme')}
          </h2>
          <p class="muted small-note">
            {props.previewed > 0 ? t('previewOnPages') : t('previewNone')}
          </p>
        </div>
        <div class="editor-actions">
          <button type="button" class="btn" disabled={props.saving} onClick={props.onCancel}>
            {t('cancel')}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={props.saving || draft.name.trim().length === 0}
            onClick={props.onSave}
          >
            {t('saveTheme')}
          </button>
        </div>
      </header>

      {props.error ? (
        <p class="notice notice-error" role="alert">
          {props.error}
        </p>
      ) : null}

      <div class="field-row">
        <label class="field-label" for="theme-name">
          {t('themeName')}
        </label>
        <input
          id="theme-name"
          class="input"
          type="text"
          maxLength={40}
          value={draft.name}
          onInput={(event) => props.onChange({ ...draft, name: event.currentTarget.value })}
        />
      </div>

      <div class="preset-row" role="group" aria-label={t('presets')}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            class="preset"
            onClick={() => props.onChange({ ...draft, colors: { ...preset.colors } })}
          >
            <span class="preset-chips" aria-hidden="true">
              {(['background', 'surface', 'text', 'accent'] as const).map((role) => (
                <span key={role} style={{ background: preset.colors[role] }} />
              ))}
            </span>
            <span>{presetLabel(preset.id, preset.name)}</span>
          </button>
        ))}
      </div>

      <div class="editor-grid">
        <div>
          <h3 class="label">{t('colors')}</h3>
          <ColorWheel
            hue={hsl.h}
            saturation={hsl.s}
            lightness={hsl.l}
            onChange={(hue, saturation) =>
              setColor(toHex(hslToRgb({ h: hue, s: saturation, l: hsl.l })))
            }
          />

          <div class="wheel-slider-row">
            <label class="label" for="lightness">
              {t('lightness')}
            </label>
            <input
              id="lightness"
              class="range"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(hsl.l * 100)}
              style={{
                background: `linear-gradient(to right, #000000, hsl(${hsl.h} ${Math.round(
                  hsl.s * 100,
                )}% 50%), #ffffff)`,
              }}
              onInput={(event) =>
                setColor(
                  toHex(
                    hslToRgb({ h: hsl.h, s: hsl.s, l: Number(event.currentTarget.value) / 100 }),
                  ),
                )
              }
            />
          </div>

          <div class="role-grid" role="group" aria-label={t('colors')}>
            {COLOR_ROLES.map((item) => (
              <button
                key={item}
                type="button"
                class="role"
                aria-pressed={role === item}
                onClick={() => setRole(item)}
              >
                <span
                  class="role-dot"
                  aria-hidden="true"
                  style={{ background: draft.colors[item] }}
                />
                {t(ROLE_LABELS[item])}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 class="label">{t('hexValue')}</h3>
          <div class="field-row">
            <input
              class="input mono"
              type="text"
              spellcheck={false}
              value={hexText}
              aria-label={t('hexValue')}
              aria-invalid={hexInvalid}
              onInput={(event) => {
                const value = event.currentTarget.value;
                setHexText(value);
                if (normalizeColor(value)) setColor(value);
              }}
              onFocus={() => {
                hexFocused.current = true;
              }}
              onBlur={() => {
                hexFocused.current = false;
                setHexText(selected);
              }}
            />
          </div>
          {hexInvalid ? <p class="field-error">{t('invalidColor')}</p> : null}

          <h3 class="label">{t('rgbValue')}</h3>
          <div class="field-row">
            <div class="triple">
              {(['r', 'g', 'b'] as const).map((channel) => (
                <input
                  key={channel}
                  class="input mono"
                  type="number"
                  min={0}
                  max={255}
                  step={1}
                  aria-label={channel.toUpperCase()}
                  value={rgb[channel]}
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    if (!Number.isFinite(value)) return;
                    setColor(
                      toHex({
                        ...rgb,
                        [channel]: Math.min(255, Math.max(0, Math.round(value))),
                      }),
                    );
                  }}
                />
              ))}
            </div>
          </div>

          <h3 class="label">{t('hslValue')}</h3>
          <div class="field-row">
            <div class="triple">
              <input
                class="input mono"
                type="number"
                min={0}
                max={360}
                step={1}
                aria-label={t('hslHue')}
                value={Math.round(hsl.h)}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (!Number.isFinite(value)) return;
                  setColor(toHex(hslToRgb({ ...hsl, h: ((value % 360) + 360) % 360 })));
                }}
              />
              <input
                class="input mono"
                type="number"
                min={0}
                max={100}
                step={1}
                aria-label={t('hslSaturation')}
                value={Math.round(hsl.s * 100)}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (!Number.isFinite(value)) return;
                  setColor(toHex(hslToRgb({ ...hsl, s: Math.min(1, Math.max(0, value / 100)) })));
                }}
              />
              <input
                class="input mono"
                type="number"
                min={0}
                max={100}
                step={1}
                aria-label={t('hslLightness')}
                value={Math.round(hsl.l * 100)}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (!Number.isFinite(value)) return;
                  setColor(toHex(hslToRgb({ ...hsl, l: Math.min(1, Math.max(0, value / 100)) })));
                }}
              />
            </div>
          </div>

          <div class="contrast-head">
            <h3 class="label">{t('contrastTitle')}</h3>
            {failing.length > 0 ? (
              <button
                type="button"
                class="btn btn-quiet"
                onClick={() =>
                  props.onChange({
                    ...draft,
                    colors: fixThemeContrast(preview).colors,
                  })
                }
              >
                {t('fixContrast')}
              </button>
            ) : null}
          </div>

          <ul class="contrast-list">
            {checks.map((check) => (
              <li class="contrast-row" key={check.id}>
                <span>{check.label}</span>
                <span class="contrast-ratio">{check.display}</span>
                <span class={`tag ${check.passes ? 'tag-pass' : 'tag-fail'}`}>
                  {check.passes ? t('contrastPass') : t('contrastFail')}
                </span>
              </li>
            ))}
          </ul>

          <section class="preview-block">
            <h3 class="label">{t('previewTitle')}</h3>
            <div
              class="preview"
              style={{
                background: draft.colors.background,
                color: draft.colors.text,
                fontFamily: fontStack(draft.font.family),
              }}
            >
              <h4 style={{ color: draft.colors.text }}>{t('previewLyrics')}</h4>
              <p style={{ color: draft.colors.muted }}>
                <span style={{ color: draft.colors.accent }}>{t('previewLine')}</span>
              </p>
              <p
                style={{
                  color: draft.colors.text,
                  fontSize: `${draft.font.sizePx}px`,
                  lineHeight: String(draft.font.lineHeight),
                  letterSpacing: `${draft.font.letterSpacingEm}em`,
                  textAlign: draft.font.align === 'center' ? 'center' : 'start',
                  margin: 0,
                }}
              >
                {t('previewLyrics')}
              </p>
              <div
                class="preview-surface"
                style={{ borderColor: draft.colors.border, color: draft.colors.text }}
              >
                {t('previewLine')}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section class="font-block">
        <h3 class="label">{t('typography')}</h3>
        <div class="font-grid">
          <div class="field-row">
            <label class="field-label" for="font-family">
              {t('family')}
            </label>
            <select
              id="font-family"
              class="input"
              value={draft.font.family}
              onChange={(event) =>
                setFont({ family: event.currentTarget.value as ThemeFont['family'] })
              }
            >
              {(['system', 'serif', 'mono'] as const).map((family) => (
                <option key={family} value={family}>
                  {t(FAMILY_LABELS[family])}
                </option>
              ))}
            </select>
          </div>

          <div class="field-row">
            <label class="field-label" for="font-size">
              {t('fontSize')}
            </label>
            <input
              id="font-size"
              class="range"
              type="range"
              min={12}
              max={40}
              step={1}
              value={draft.font.sizePx}
              onInput={(event) => setFont({ sizePx: Number(event.currentTarget.value) })}
            />
            <output class="mono value-out">{draft.font.sizePx}px</output>
          </div>

          <div class="field-row">
            <label class="field-label" for="line-height">
              {t('lineHeight')}
            </label>
            <input
              id="line-height"
              class="range"
              type="range"
              min={1.2}
              max={2.2}
              step={0.05}
              value={draft.font.lineHeight}
              onInput={(event) => setFont({ lineHeight: Number(event.currentTarget.value) })}
            />
            <output class="mono value-out">{draft.font.lineHeight.toFixed(2)}</output>
          </div>

          <div class="field-row">
            <label class="field-label" for="letter-spacing">
              {t('letterSpacing')}
            </label>
            <input
              id="letter-spacing"
              class="range"
              type="range"
              min={-0.02}
              max={0.1}
              step={0.005}
              value={draft.font.letterSpacingEm}
              onInput={(event) => setFont({ letterSpacingEm: Number(event.currentTarget.value) })}
            />
            <output class="mono value-out">{draft.font.letterSpacingEm.toFixed(3)}em</output>
          </div>

          <div class="field-row">
            <span class="field-label">{t('align')}</span>
            <div class="segmented" role="group" aria-label={t('align')}>
              <button
                type="button"
                class="segment"
                aria-pressed={draft.font.align === 'start'}
                onClick={() => setFont({ align: 'start' })}
              >
                {t('alignStart')}
              </button>
              <button
                type="button"
                class="segment"
                aria-pressed={draft.font.align === 'center'}
                onClick={() => setFont({ align: 'center' })}
              >
                {t('alignCenter')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
