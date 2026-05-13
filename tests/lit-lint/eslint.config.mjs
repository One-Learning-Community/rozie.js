import litPlugin from 'eslint-plugin-lit';
import wcPlugin from 'eslint-plugin-wc';
import tsParser from '@typescript-eslint/parser';

// Phase 06.4 Plan 03 — flat-config wiring for eslint-plugin-lit +
// eslint-plugin-wc. Spreads flat/recommended from both plugins PLUS
// flat/best-practice from eslint-plugin-wc to pick up require-listener-teardown
// per RESEARCH.md A8 (D-LIT-09 cleanup teardown validation).
//
// Rule overrides (v1 emitter compatibility — tracked in deferred-items.md):
//   - `wc/guard-super-call`: OFF. Defensive rule for vanilla web-components
//     extending HTMLElement directly; Lit's LitElement always implements
//     connectedCallback / disconnectedCallback / attributeChangedCallback.
//     Calling super.X() inside our emitted lifecycle bodies is correct and
//     idiomatic Lit — see lit-element/src/lit-element.ts.
//   - `lit/no-legacy-template-syntax`: OFF for Card.ts's `on-close=` callback
//     prop. v1 emitter routes callback-typed props as dashed attribute
//     bindings instead of property bindings (`.onClose=`). Phase 7 emitter
//     work will switch to property-binding for function-typed props.
//   - `lit/no-duplicate-template-bindings`: OFF for SearchInput's duplicate
//     `@input=` and `@keydown=` bindings. v1 emitter emits r-model's
//     @input + the template's @input separately; Phase 7 will merge them
//     into a single composed handler. See D-LIT-FUTURE-04 in deferred-items.md.
export default [
  {
    files: ['**/*.ts'],
    plugins: { lit: litPlugin, wc: wcPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      ...(litPlugin.configs?.['flat/recommended']?.rules ?? {}),
      ...(wcPlugin.configs?.['flat/recommended']?.rules ?? {}),
      ...(wcPlugin.configs?.['flat/best-practice']?.rules ?? {}),
      // v1 emitter compatibility — see comment block above for rationale.
      'wc/guard-super-call': 'off',
      'lit/no-legacy-template-syntax': 'off',
      'lit/no-duplicate-template-bindings': 'off',
    },
  },
];
