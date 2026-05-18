// Shared empty stub for the userland packages whose APIs are never invoked
// under the single-buffer playground path — enhanced-resolve + get-tsconfig.
// They are imported statically by @rozie/core but only fire when the IR
// contains cross-file imports, which the playground does not produce.

const noop = (): never => {
  throw new Error('[playground shim] userland resolver called in browser');
};

export default noop;

// Named exports consumed by get-tsconfig (createPathsMatcher, getTsconfig)
// — return null so any defensive `?? <fallback>` pattern in @rozie/core
// stays on the no-op path.
export const createPathsMatcher = () => null;
export const getTsconfig = () => null;
