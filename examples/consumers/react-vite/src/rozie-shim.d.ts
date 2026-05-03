// Ambient module declaration for .rozie imports — Plan 04-05 wires real types
// via emitReact's inline `interface FooProps { ... }`. For now, type as a
// generic React component so consumer .tsx can `import Foo from './Foo.rozie'`
// without a TS error before Plan 04-05 lands.
declare module '*.rozie' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<Record<string, unknown>>;
  export default Component;
}
