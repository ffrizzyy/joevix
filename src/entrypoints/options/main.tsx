import { render } from 'preact';
import '../../ui/base.css';
import './options.css';
import { App } from './app';

const root = document.getElementById('app');
if (root) render(<App />, root);
