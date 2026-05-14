// Ambient module declaration for .rozie imports. The @rozie/unplugin transform
// resolves these at build time; this shim lets consumer .tsx files
// `import Foo from './Foo.rozie'` without a TS error during typecheck.
declare module '*.rozie' {
  import type { Component } from 'solid-js';
  const component: Component<Record<string, unknown>>;
  export default component;
}
