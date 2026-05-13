// Phase 06.4 Plan 03 — Lit fixture side-effect imports.
//
// The compiled Lit class output emits `import './Foo.rozie';` for cross-rozie
// composition (D-LIT-18). The imported module's @customElement decorator runs
// at module load and registers the custom element via customElements.define.
//
// In the lit-ts type-check workspace, those `.rozie` files don't exist —
// they're declared here as ambient modules so tsc --strict --noEmit can resolve
// them. The fixtures are co-located beside this shim; e.g. CardHeader.lit.ts is
// what would be compiled from CardHeader.rozie in a real build.
declare module './CardHeader.rozie';
declare module './Counter.rozie';
declare module './TreeNode.rozie';
