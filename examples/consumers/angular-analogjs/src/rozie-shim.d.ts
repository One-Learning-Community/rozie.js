// TypeScript shim for `.rozie` imports — informs tsc / Angular's strict
// templates that a `.rozie` import resolves to an Angular standalone
// component class. The actual compiled .ts type-checks via @analogjs's
// transform pipeline against the synthesized `.rozie.ts` virtual module
// produced by @rozie/unplugin's resolveId. This shim exists for the
// consumer-side `import Counter from '../../../../Counter.rozie'` syntax
// to type-check.
//
// Plan 05-04 finalises this to a more useful Type<unknown> shape via Phase 6
// TYPES-01..03.
declare module '*.rozie' {
  const component: unknown;
  export default component;
}
