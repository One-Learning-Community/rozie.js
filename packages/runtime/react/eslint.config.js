// Phase 4 Plan 04 — eslint flat config for @rozie/runtime-react.
//
// Mirrors @rozie/target-react's config so the runtime helpers themselves
// pass the same exhaustive-deps + rules-of-hooks lint that compiler-emitted
// .tsx must pass (D-62 floor: NO eslint-disable anywhere).
//
// Lint runtime-react via:
//   pnpm exec eslint src/*.ts --config ./eslint.config.js --max-warnings 0
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useDebouncedCallback|useThrottledCallback|useOutsideClick)',
        },
      ],
    },
  },
];
