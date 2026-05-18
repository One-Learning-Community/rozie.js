// Browser shim for `node:fs`. Covers both
//   import { readFileSync } from 'node:fs'
//   import * as fs           from 'node:fs'
// The single-buffer playground never actually hits the filesystem inside
// @rozie/core, so throw-on-call bodies make any accidental invocation surface
// a loud, traceable error instead of silent corruption.

export function readFileSync(): never {
  throw new Error('[playground shim] fs.readFileSync called in browser');
}

export function existsSync(): false {
  return false;
}

export function statSync(): never {
  throw new Error('[playground shim] fs.statSync called in browser');
}

// Default export keeps the `import * as fs` namespace-object pattern working
// under both ESM and interop paths.
export default { readFileSync, existsSync, statSync };
