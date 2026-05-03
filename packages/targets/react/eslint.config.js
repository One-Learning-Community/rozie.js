// Phase 4 D-62 — eslint flat config for @rozie/target-react.
//
// The `additionalHooks` regex tells eslint-plugin-react-hooks to run the
// exhaustive-deps lint rule on our custom hooks (useDebouncedCallback,
// useThrottledCallback, useOutsideClick) the same way it does on
// React's built-in useEffect/useMemo/useCallback. Per RESEARCH.md A2,
// eslint-plugin-react-hooks v5 supports this regex config; per Pattern 10
// line 853, this is the verbatim regex shape.
//
// Note: useOutsideClick takes refs (NOT a deps-array argument); the lint rule
// no-ops on hooks lacking a deps-array. Including it documents the surface.
//
// Plan 04-04 — added TS parser and fixture-lint glob for *.tsx.snap so the
// programmatic ESLint API in __tests__/fixturesLintCheck.test.ts can validate
// emitted output without copying snap files to .tsx.
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'fixtures/**/*.tsx', 'fixtures/**/*.tsx.snap'],
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
      // Plan 04-04 — useOutsideClick removed from additionalHooks: its
      // signature is (refs, callback, when?) with NO deps-array argument, so
      // exhaustive-deps mis-fires when applied. The runtime helper itself
      // manages its dep set internally via ref-storage (D-61 stale-closure
      // defense), so consumer call-sites are safe by construction.
      'react-hooks/exhaustive-deps': ['error', {
        additionalHooks: '(useDebouncedCallback|useThrottledCallback)'
      }]
    }
  }
];
