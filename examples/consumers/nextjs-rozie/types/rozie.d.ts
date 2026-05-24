// Sibling .d.ts for `.rozie` modules — declared so TypeScript sees
// `import Counter from './Counter.rozie'` as a React component module.
//
// This file lives outside `next-env.d.ts` because Next regenerates
// `next-env.d.ts` on every build (any custom declarations placed there
// get stripped).
declare module '*.rozie' {
  import type { ComponentType } from 'react';
  const component: ComponentType<Record<string, unknown>>;
  export default component;
}
