import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const BANNED_SYNTAX = [
  {
    selector: "AssignmentExpression[left.property.name='innerHTML']",
    message: 'Use textContent or DOM APIs. innerHTML is banned (spec 8.2 A03).',
  },
  {
    selector: "AssignmentExpression[left.property.name='outerHTML']",
    message: 'outerHTML is banned (spec 8.2 A03).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML is banned (spec 8.2 A03).',
  },
  {
    selector: "CallExpression[callee.name='fetch']",
    message: 'Joevix makes no network requests (NFR-06).',
  },
  {
    selector: "NewExpression[callee.name='XMLHttpRequest']",
    message: 'Joevix makes no network requests (NFR-06).',
  },
  {
    selector: "NewExpression[callee.name='WebSocket']",
    message: 'Joevix makes no network requests (NFR-06).',
  },
  {
    selector: "NewExpression[callee.name='EventSource']",
    message: 'Joevix makes no network requests (NFR-06).',
  },
  {
    selector: "NewExpression[callee.name='Image']",
    message: 'Dynamic image loads are a network channel (NFR-06).',
  },
  {
    selector:
      "CallExpression[callee.object.name='navigator'][callee.property.name='sendBeacon']",
    message: 'Joevix makes no network requests (NFR-06).',
  },
  {
    selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']",
    message: 'Inline style attributes are blocked by our CSP. Set CSS custom properties instead.',
  },
  {
    selector: "CallExpression[callee.name='eval']",
    message: 'eval is banned (spec 8.2 A03).',
  },
];

export default tseslint.config(
  {
    ignores: ['.wxt/**', '.output/**', 'node_modules/**', 'coverage/**', 'tests/fixtures/**'],
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': ['error', ...BANNED_SYNTAX],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
