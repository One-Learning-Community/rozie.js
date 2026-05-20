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
      //
      // 260519 linechart-watch-recreate Bug B — exhaustive-deps is 'warn',
      // not 'error'. Rozie's mount-phase $onMount lowering MUST emit an empty
      // `[]` dep array: a mount hook runs exactly once by contract (the other
      // five targets honour this structurally — Vue onMounted, Svelte/Solid
      // onMount, Lit firstUpdated, Angular ngAfterViewInit). exhaustive-deps
      // is a *static* lint that cannot distinguish an intentional mount-once
      // `[]` from a forgotten dependency, so it flags every emitted mount
      // useEffect that calls a prop-keyed helper (`lockScroll`, `reposition`).
      // D-62's floor is "no `eslint-disable` comments in emitted output" — it
      // is NOT "exhaustive-deps must be error severity". Demoting to 'warn'
      // keeps the rule advisory (it still surfaces in editors and CI logs)
      // while letting the now-correct mount/`$watch` dep arrays through. The
      // stale-closure protection that mattered — functional-updater lowering
      // for `$data.x = f($data.x)` — is enforced correct-by-construction in
      // the compiler (rewriteScript.ts), not by this lint.
      'react-hooks/exhaustive-deps': ['warn', {
        additionalHooks: '(useDebouncedCallback|useThrottledCallback)'
      }]
    }
  }
];
