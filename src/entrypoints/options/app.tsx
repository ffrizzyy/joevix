import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { t } from '../../core/i18n';
import type { Settings, SiteConfig, Theme } from '../../core/model';
import { downloadJson, send } from '../../ui/api';
import { ThemeEditor, draftFromTheme, draftToTheme, type Draft } from './theme-editor';

type TabKey = 'themes' | 'sites' | 'data' | 'about';
type Notice = { kind: 'info' | 'success' | 'error'; text: string };

const TABS: Array<{ key: TabKey; label: () => string }> = [
  { key: 'themes', label: () => t('tabThemes') },
  { key: 'sites', label: () => t('tabSites') },
  { key: 'data', label: () => t('tabData') },
  { key: 'about', label: () => t('tabAbout') },
];

function initialTab(): TabKey {
  const hash = location.hash.replace('#', '');
  if (hash === 'privacy' || hash === 'data') return 'data';
  if (hash === 'sites') return 'sites';
  if (hash === 'about') return 'about';
  return 'themes';
}

export function App() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState(0);

  const builtins = themes.filter((theme) => theme.builtin);
  const custom = themes.filter((theme) => !theme.builtin);

  async function load(): Promise<void> {
    const [themesResponse, sitesResponse, settingsResponse] = await Promise.all([
      send<{ themes: Theme[] }>({ type: 'get-themes' }),
      send<{ sites: SiteConfig[] }>({ type: 'get-sites' }),
      send<{ settings: Settings }>({ type: 'get-settings' }),
    ]);
    if (themesResponse.ok) setThemes(themesResponse.data.themes);
    if (sitesResponse.ok) setSites(sitesResponse.data.sites);
    if (settingsResponse.ok) setSettings(settingsResponse.data.settings);
  }

  useEffect(() => {
    void load();
    const onHash = () => setTab(initialTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Live preview: every draft change is pushed to open Joevix pages, debounced.
  // The draft is kept when another tab is opened, but the pages are restored.
  useEffect(() => {
    if (!draft || tab !== 'themes') return;
    const timer = setTimeout(() => {
      void send<{ previewed: number }>({
        type: 'preview-theme',
        theme: draftToTheme(draft),
      }).then((response) => {
        if (response.ok) setPreviewed(response.data.previewed);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [draft, tab]);

  useEffect(() => {
    if (tab === 'themes' || !draft) return;
    void send({ type: 'end-preview' });
  }, [tab, draft]);

  // Closing the options page must not leave a preview applied.
  useEffect(() => {
    const end = () => void send({ type: 'end-preview' });
    window.addEventListener('pagehide', end);
    return () => {
      window.removeEventListener('pagehide', end);
      end();
    };
  }, []);

  function startNew(base?: Theme): void {
    const source = base ?? themes.find((theme) => theme.id === 'builtin:light') ?? themes[0];
    if (!source) return;
    const next = draftFromTheme(source, base !== undefined);
    setDraft(base ? next : { ...next, name: t('newTheme') });
    setDraftError(null);
    setPreviewed(0);
  }

  function startEdit(theme: Theme): void {
    setDraft(draftFromTheme({ ...theme, builtin: false }));
    setDraftError(null);
    setPreviewed(0);
  }

  async function saveDraft(): Promise<void> {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setDraftError(t('nameRequired'));
      return;
    }

    setSavingDraft(true);
    setDraftError(null);
    const id = draft.id ?? `custom:${crypto.randomUUID()}`;
    const response = await send({ type: 'save-theme', theme: draftToTheme({ ...draft, name }, id) });
    setSavingDraft(false);

    if (!response.ok) {
      setDraftError(response.error);
      return;
    }

    setDraft(null);
    await send({ type: 'end-preview' });
    await load();
    setNotice({ kind: 'success', text: t('themeSaved') });
  }

  async function cancelDraft(): Promise<void> {
    setDraft(null);
    setDraftError(null);
    setPreviewed(0);
    await send({ type: 'end-preview' });
  }

  async function removeTheme(themeId: string): Promise<void> {
    if (!window.confirm(t('confirmDeleteTheme'))) return;
    setBusy(true);
    const response = await send({ type: 'delete-theme', themeId });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    await load();
    setNotice({ kind: 'success', text: t('deleted') });
  }

  async function toggleGlobal(): Promise<void> {
    if (!settings) return;
    setBusy(true);
    const response = await send({
      type: 'set-enabled-everywhere',
      enabled: !settings.enabledEverywhere,
    });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    setSettings({ ...settings, enabledEverywhere: !settings.enabledEverywhere });
  }

  async function deleteSite(siteId: string): Promise<void> {
    setBusy(true);
    const response = await send({ type: 'delete-site', siteId });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    setSites((current) => current.filter((site) => site.siteId !== siteId));
    setNotice({ kind: 'success', text: t('deleted') });
  }

  async function exportData(): Promise<void> {
    setBusy(true);
    const response = await send<{ json: string }>({ type: 'export-data' });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`joevix-backup-${stamp}.json`, response.data.json);
  }

  async function importData(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > 256 * 1024) {
      setNotice({ kind: 'error', text: t('importFailed') });
      return;
    }

    const text = await file.text();
    setBusy(true);
    const response = await send<{ themes: number; sites: number }>({
      type: 'import-data',
      json: text,
      mode: 'replace',
    });
    setBusy(false);

    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error || t('importFailed') });
      return;
    }

    setNotice({ kind: 'success', text: t('importDone') });
    await load();
  }

  async function deleteAll(): Promise<void> {
    if (!window.confirm(t('confirmDeleteAll'))) return;
    setBusy(true);
    const response = await send({ type: 'delete-all' });
    setBusy(false);
    if (!response.ok) {
      setNotice({ kind: 'error', text: response.error });
      return;
    }
    setNotice({ kind: 'success', text: t('deleted') });
    await load();
  }

  return (
    <main class="page">
      <header class="masthead">
        <h1>{t('optionsTitle')}</h1>
        <p class="muted">
          {themes.length} {t('themeCount')} · {sites.length} {t('siteCount')}
        </p>
      </header>

      <nav class="tabs" role="tablist" aria-label={t('optionsTitle')}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`panel-${item.key}`}
            class="tab"
            onClick={() => setTab(item.key)}
          >
            {item.label()}
          </button>
        ))}
      </nav>

      {notice ? (
        <p class={`notice notice-${notice.kind}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {tab === 'themes' ? (
        <section id="panel-themes" role="tabpanel" aria-labelledby="tab-themes" class="panel">
          {draft ? (
            <ThemeEditor
              draft={draft}
              isNew={draft.id === null}
              saving={savingDraft}
              error={draftError}
              previewed={previewed}
              onChange={setDraft}
              onSave={() => void saveDraft()}
              onCancel={() => void cancelDraft()}
            />
          ) : (
            <>
              <div class="row">
                <h2 class="section-title tight">{t('builtInThemes')}</h2>
                <button type="button" class="btn" onClick={() => startNew()}>
                  {t('newTheme')}
                </button>
              </div>

              <div class="theme-grid">
                {builtins.map((theme) => (
                  <article class="card theme-card" key={theme.id}>
                    <ThemeSwatch theme={theme} />
                    <h3 class="card-title">{theme.name}</h3>
                    <p class="meta">
                      {theme.mode} · {t('readOnlyTheme')}
                    </p>
                    <div class="card-actions">
                      <button
                        type="button"
                        class="btn btn-quiet"
                        onClick={() => startNew(theme)}
                      >
                        {t('duplicate')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <h2 class="section-title">{t('yourThemes')}</h2>
              {custom.length === 0 ? (
                <p class="muted">{t('noCustomThemes')}</p>
              ) : (
                <div class="theme-grid">
                  {custom.map((theme) => (
                    <article class="card theme-card" key={theme.id}>
                      <ThemeSwatch theme={theme} />
                      <h3 class="card-title">{theme.name}</h3>
                      <p class="meta">{theme.font.sizePx}px</p>
                      <div class="card-actions">
                        <button
                          type="button"
                          class="btn btn-quiet"
                          onClick={() => startEdit(theme)}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          class="btn btn-quiet"
                          onClick={() => startNew(theme)}
                        >
                          {t('duplicate')}
                        </button>
                        <button
                          type="button"
                          class="btn btn-quiet btn-danger"
                          disabled={busy}
                          onClick={() => void removeTheme(theme.id)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      {tab === 'sites' ? (
        <section id="panel-sites" role="tabpanel" aria-labelledby="tab-sites" class="panel">
          <div class="row">
            <div>
              <h2 class="section-title tight">{t('globalOff')}</h2>
              <p class="muted small-note">{t('globalOffHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              class="switch"
              aria-checked={settings?.enabledEverywhere ?? true}
              aria-label={t('globalOff')}
              disabled={busy || !settings}
              onClick={() => void toggleGlobal()}
            >
              <span class="switch-track" aria-hidden="true">
                <span class="switch-knob" />
              </span>
            </button>
          </div>

          <h2 class="section-title">{t('sitesTitle')}</h2>
          {sites.length === 0 ? <p class="muted">{t('sitesEmpty')}</p> : null}
          <ul class="list">
            {sites.map((site) => (
              <li class="list-row" key={site.siteId}>
                <span class="site-name">{site.siteId}</span>
                <span class={`tag ${site.enabled ? 'tag-on' : 'tag-off'}`}>
                  {site.enabled ? t('siteEnabled') : t('siteDisabled')}
                </span>
                <button
                  type="button"
                  class="btn btn-quiet"
                  disabled={busy}
                  onClick={() => void deleteSite(site.siteId)}
                >
                  {t('deleteData')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'data' ? (
        <section id="panel-data" role="tabpanel" aria-labelledby="tab-data" class="panel">
          <div class="card">
            <h2 class="section-title tight">{t('privacyTitle')}</h2>
            <p>{t('privacyBody')}</p>
            <p class="mono muted">{t('privacyKeys')}</p>
          </div>

          <div class="actions">
            <button type="button" class="btn" disabled={busy} onClick={() => void exportData()}>
              {t('exportData')}
            </button>

            <label class="btn file-btn">
              {t('importData')}
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(event) => void importData(event)}
              />
            </label>

            <button
              type="button"
              class="btn btn-danger"
              disabled={busy}
              onClick={() => void deleteAll()}
            >
              {t('deleteAll')}
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'about' ? (
        <section id="panel-about" role="tabpanel" aria-labelledby="tab-about" class="panel">
          <p>{t('aboutBody')}</p>
          <p class="muted">
            {t('version')} {browser.runtime.getManifest().version}
          </p>
        </section>
      ) : null}
    </main>
  );
}

function ThemeSwatch({ theme }: { theme: Theme }) {
  return (
    <div class="swatch" aria-hidden="true">
      <span style={{ background: theme.colors.background }} />
      <span style={{ background: theme.colors.surface }} />
      <span style={{ background: theme.colors.text }} />
      <span style={{ background: theme.colors.accent }} />
    </div>
  );
}
