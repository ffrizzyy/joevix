import { render } from 'preact';
import { currentLocale, t } from '../../core/i18n';
import '../../ui/base.css';
import './popup.css';
import { App } from './app';

document.documentElement.lang = currentLocale();
document.title = t('appName');
const root = document.getElementById('app');
if (root) render(<App />, root);
