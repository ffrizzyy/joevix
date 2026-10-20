import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { t } from '../../core/i18n';
import type { Diagnostics, SiteState } from '../../core/messaging';
import { activeTab, copyText, openOptions, send } from '../../ui/api';
import { themeLabel } from '../../ui/theme-name';

type Phase = 'loading' | 'unsupported' | 'ready';
type Notice = { kind: 'info' | 'warning' | 'error'; text: string };

const MIN_SIZE = 12;
const MAX_SIZE = 40;

function clampSize(value: number): number {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, value));
}

export function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [state, setState] = useState<SiteState | null>(null);
  const [url, setUrl] = useState('');
  const [tabId, setTabId] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(): Promise<void> {
    const tab = await activeTab();
    setTabId(tab.id);
    if (!tab.url) {
      setPhase('unsupported');
      return;
    }

    const response = await send<SiteState>({
      type: 'get-site-state',
      url: tab.url,
      tabId: tab.id,
    });

    if (!response.ok) {
      setPhase('unsupported');
      return;
    }

    setUrl(tab.url);
    setState(response.data);
    setPhase('ready');

    if (response.data.missingTheme) {
      setNotice({ kind: 'warning', text: t('missingTheme') });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function chooseTheme(themeId: string): Promise<void> {
    if (!state || !url) return;
    setBusy(true);
    setState({ ...state, config: { ...state.config, themeId } });
    const response = await send({
      type: 'set-theme',
      url,
      themeId,
      tabId,
    });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      await load();
    }
  }

  async function toggleSite(): Promise<void> {
    if (!state || !url) return;
    const nextEnabled = !state.config.enabled;

    if (nextEnabled) {
      // Must be the first await in the click handler: the gesture cannot survive one.
      let granted = false;
      try {
        granted = await browser.permissions.request({ origins: [state.originPattern] });
      } catch {
        granted = false;
      }
      if (!granted) {
        setNotice({ kind: 'error', text: t('permissionDenied') });
        return;
      }
    }

    setBusy(true);
    const response = await send({
      type: 'set-enabled',
      url,
      enabled: nextEnabled,
      tabId,
    });
    setBusy(false);

    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    await load();
    setNotice(null);
  }

  async function changeSize(delta: number): Promise<void> {
    if (!state || !url) return;
    const current = state.config.fontSizePx ?? 18;
    const next = clampSize(current + delta);
    if (next === current) return;

    setState({ ...state, config: { ...state.config, fontSizePx: next } });
    const response = await send({ type: 'set-font-size', url, sizePx: next, tabId });
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
    }
  }

  async function resetSite(): Promise<void> {
    if (!url) return;
    setBusy(true);
    const response = await send({ type: 'reset-site', url, tabId });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    setNotice(null);
    await load();
  }

  async function startEdit(): Promise<void> {
    if (!url) return;
    setBusy(true);
    const response = await send({ type: 'start-edit', url, tabId });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    window.close();
  }

  async function completeWelcome(themeId: string | null): Promise<void> {
    setBusy(true);
    const response = await send({ type: 'complete-welcome', themeId });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    setNotice(null);
    await load();
  }

  async function copyDiagnostics(): Promise<void> {
    const response = await send<Diagnostics>({ type: 'get-diagnostics' });
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }

    const data = response.data;
    const adapter = data.adapterId
      ? `${data.adapterId}${data.adapterVersion ? ` v${data.adapterVersion}` : ''}`
      : t('diagNone');
    const lines = [
      `Joevix ${data.version}`,
      `${t('diagSite')}: ${data.siteId ?? t('diagNone')}`,
      `${t('diagAdapter')}: ${adapter}`,
      `${t('diagSections')}: ${data.sectionsFound}`,
      data.sectionsMissing.length > 0
        ? `${t('diagMissing')}: ${data.sectionsMissing.join(', ')}`
        : null,
      data.adapterId && !data.hasReport ? t('diagNoReport') : null,
      new Date(data.createdAt).toISOString(),
    ].filter((line): line is string => line !== null);

    const copied = await copyText(lines.join('\n'));
    setNotice({
      kind: copied ? 'info' : 'error',
      text: copied ? t('diagnosticsCopied') : t('copyFailed'),
    });
  }

  const onboarding = phase === 'ready' && state !== null && !state.settings.onboarded;
  const welcomeThemes = state ? state.themes.filter((theme) => theme.builtin).slice(0, 3) : [];

  return (
    <main class="app">
      <header class="header">
        <div>
          <h1 class="brand">{t('appName')}</h1>
          <p class="host">{hostLabel(url)}</p>
        </div>
        {phase === 'ready' && state ? (
          <button
            type="button"
            role="switch"
            class="switch"
            aria-checked={state.config.enabled}
            aria-label={t('onThisSite')}
            title={t('onThisSite')}
            disabled={busy}
            onClick={() => void toggleSite()}
          >
            <span class="switch-track" aria-hidden="true">
              <span class="switch-knob" />
            </span>
          </button>
        ) : null}
      </header>

      {phase === 'loading' ? <p class="muted pad">{t('loading')}</p> : null}

      {phase === 'unsupported' ? (
        <section class="section">
          <h2 class="heading">{t('unsupportedTitle')}</h2>
          <p class="muted">{t('unsupportedBody')}</p>
        </section>
      ) : null}

      {phase === 'ready' && state ? (
        <>
          {notice ? (
            <p class={`notice notice-${notice.kind}`} role="status">
              {notice.text}
            </p>
          ) : null}

          {!state.config.enabled ? (
            <section class="section enable">
              <p class="enable-text">{t('offOnThisSite')}</p>
              <button
                type="button"
                class="btn btn-primary"
                disabled={busy}
                onClick={() => void toggleSite()}
              >
                {t('enableSite')}
              </button>
            </section>
          ) : null}

          {onboarding ? (
            <section class="section welcome" aria-labelledby="welcome-title">
              <h2 id="welcome-title" class="heading">
                {t('welcomeTitle')}
              </h2>
              <p class="hint">{t('welcomeBody')}</p>
              <div class="themes">
                {welcomeThemes.map((theme) => (
                  <ThemeTile
                    key={theme.id}
                    name={themeLabel(theme)}
                    colors={[theme.colors.background, theme.colors.text, theme.colors.accent]}
                    selected={state?.settings.defaultThemeId === theme.id}
                    disabled={busy}
                    onSelect={() => void completeWelcome(theme.id)}
                  />
                ))}
              </div>
              <button
                type="button"
                class="link small"
                disabled={busy}
                onClick={() => void completeWelcome(null)}
              >
                {t('welcomeSkip')}
              </button>
            </section>
          ) : (
            <section class="section" aria-labelledby="theme-label">
              <h2 id="theme-label" class="label">
                {t('theme')}
              </h2>
              <div class="themes">
                <ThemeTile
                  name={t('systemTheme')}
                  colors={systemColors(state)}
                  selected={state.config.themeId === 'system'}
                  disabled={busy || !state.config.enabled}
                  onSelect={() => void chooseTheme('system')}
                />
                {state.themes.map((theme) => (
                  <ThemeTile
                    key={theme.id}
                    name={themeLabel(theme)}
                    colors={[theme.colors.background, theme.colors.text, theme.colors.accent]}
                    selected={state.config.themeId === theme.id}
                    disabled={busy || !state.config.enabled}
                    onSelect={() => void chooseTheme(theme.id)}
                  />
                ))}
                <button type="button" class="theme" onClick={() => void openOptions('themes')}>
                  <span class="swatch swatch-add" aria-hidden="true">
                    +
                  </span>
                  <span class="theme-name">{t('customTheme')}</span>
                </button>
              </div>
              <button type="button" class="link small" onClick={() => void openOptions('themes')}>
                {t('manageThemes')}
              </button>
            </section>
          )}

          <section class="section" aria-labelledby="size-label">
            <h2 id="size-label" class="label">
              {t('textSize')}
            </h2>
            <div class="size-row">
              <button
                type="button"
                class="btn btn-icon"
                aria-label={`${t('decreaseText')}: A−`}
                disabled={busy || !state.config.enabled}
                onClick={() => void changeSize(-1)}
              >
                A−
              </button>
              <span class="size-value" aria-live="polite">
                {state.config.fontSizePx ?? 18}px
              </span>
              <button
                type="button"
                class="btn btn-icon"
                aria-label={`${t('increaseText')}: A+`}
                disabled={busy || !state.config.enabled}
                onClick={() => void changeSize(1)}
              >
                A+
              </button>
            </div>
          </section>

          <section class="section actions">
            <button
              type="button"
              class="btn"
              disabled={busy || !state.config.enabled || !state.adapterAvailable}
              title={
                !state.config.enabled
                  ? t('editNeedsEnabled')
                  : state.adapterAvailable
                    ? t('editLayout')
                    : t('editUnavailable')
              }
              aria-describedby="edit-hint"
              onClick={() => void startEdit()}
            >
              {t('editLayout')}
            </button>
            <button type="button" class="btn" disabled={busy} onClick={() => void resetSite()}>
              {t('resetSite')}
            </button>
            <p id="edit-hint" class="hint">
              {!state.config.enabled
                ? t('editNeedsEnabled')
                : state.adapterAvailable
                  ? state.sections
                    ? `${state.sections.found} of ${
                        state.sections.found + state.sections.missing
                      } ${t('sectionsFound')}`
                    : t('adapterReload')
                  : t('editUnavailable')}
            </p>
            {state.adapterAvailable && state.sections && state.sections.missing > 0 ? (
              <p class="hint hint-warn">{t('sectionsMissing')}</p>
            ) : null}
          </section>

          <footer class="footer">
            <button type="button" class="link" onClick={() => void openOptions()}>
              {t('settings')}
            </button>
            <button type="button" class="link" onClick={() => void openOptions('privacy')}>
              {t('privacy')}
            </button>
            <button type="button" class="link" onClick={() => void copyDiagnostics()}>
              {t('copyDiagnostics')}
            </button>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function systemColors(state: SiteState): string[] {
  const light = state.themes.find((theme) => theme.id === 'builtin:light');
  const dark = state.themes.find((theme) => theme.id === 'builtin:dark');
  return [light?.colors.background ?? '#ffffff', dark?.colors.background ?? '#111111'];
}

function ThemeTile(props: {
  name: string;
  colors: string[];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      class="theme"
      aria-pressed={props.selected}
      disabled={props.disabled}
      onClick={props.onSelect}
    >
      <span class="swatch" aria-hidden="true">
        {props.colors.map((color, index) => (
          <span key={index} style={{ background: color }} />
        ))}
      </span>
      <span class="theme-name">{props.name}</span>
    </button>
  );
}
