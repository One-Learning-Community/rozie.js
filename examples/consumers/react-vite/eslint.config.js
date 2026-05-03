// Phase 4 D-62 — eslint flat config for react-vite-demo consumer code.
// Mirrors packages/targets/react/eslint.config.js so the same custom-hook
// regex applies when consumers author against the @rozie/runtime-react
// hook surface.
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': ['error', {
        additionalHooks: '(useDebouncedCallback|useThrottledCallback|useOutsideClick)'
      }]
    }
  }
];
