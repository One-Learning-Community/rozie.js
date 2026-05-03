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
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': ['error', {
        additionalHooks: '(useDebouncedCallback|useThrottledCallback|useOutsideClick)'
      }]
    }
  }
];
