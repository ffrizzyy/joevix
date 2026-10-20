import { render } from 'preact';
import { currentLocale, t } from '../../core/i18n';
import '../../ui/base.css';
import './options.css';
import { App } from './app';

document.documentElement.lang = currentLocale();
document.title = `${t('appName')} ${t('settings')}`;
const root = document.getElementById('app');
if (root) render(<App />, root);
