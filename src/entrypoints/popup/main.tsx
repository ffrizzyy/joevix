import { render } from 'preact';
import '../../ui/base.css';
import './popup.css';
import { App } from './app';

const root = document.getElementById('app');
if (root) render(<App />, root);
