import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'work/**'] },
  js.configs.recommended,
  { files: ['scripts/*.mjs', 'emulator/**/*.{mjs,ts}'], languageOptions: { globals: { process: 'readonly', URL: 'readonly', fetch: 'readonly', structuredClone: 'readonly' } } },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
);
