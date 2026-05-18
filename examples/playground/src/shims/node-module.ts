// Browser shim for `node:module`. Covers `createRequire`. The returned
// require() throws on any actual call — @rozie/core only needs createRequire
// to be importable; under the single-buffer playground path the returned
// function is never invoked.

export function createRequire(): (id: string) => never {
  return (id: string) => {
    throw new Error(`[playground shim] require('${id}') called in browser`);
  };
}

export default { createRequire };
