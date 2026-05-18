// Browser shim for `node:module`. Provides `createRequire` returning a require
// function that handles the small set of modules @rozie/core's bundled CJS
// deps reach for at module-load time. Anything else throws loudly.
//
// Known reachable requires (from `grep -oE '__require\("[^"]+"\)' packages/core/dist/index.mjs`):
//   - util — pulled in by util-deprecate via postcss-selector-parser. Needs
//     a `deprecate(fn) -> fn` identity wrapper.
// Any other id surfaces a traceable error so future drift is loud.

const utilShim = {
  deprecate<T>(fn: T): T {
    return fn;
  },
  inspect(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  },
  types: {
    isRegExp: (v: unknown): boolean => v instanceof RegExp,
    isDate: (v: unknown): boolean => v instanceof Date,
  },
};

export function createRequire(): (id: string) => unknown {
  return (id: string) => {
    if (id === 'util') return utilShim;
    throw new Error(`[playground shim] require('${id}') called in browser`);
  };
}

export default { createRequire };
