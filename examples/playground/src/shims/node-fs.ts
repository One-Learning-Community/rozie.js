// Browser shim for `node:fs`. Backed by a virtual filesystem stashed on
// `globalThis.__rozieVfs` (a Map<absolutePath, source>) so multi-file
// snippet bundles can satisfy `<components>` cross-file imports without
// touching the real disk (which the browser doesn't have anyway).
//
// The playground's `compileBundle` is responsible for populating __rozieVfs
// before invoking `@rozie/core.compile()` and clearing it afterward. If the
// VFS is empty or the requested path is not present, the shim throws — that
// surfaces as a `ROZ945` diagnostic in the Output pane (which is what we
// want; a missing dependency should be loud).

declare global {
  // eslint-disable-next-line no-var
  var __rozieVfs: Map<string, string> | undefined;
}

function vfs(): Map<string, string> {
  const v = globalThis.__rozieVfs;
  if (v === undefined) {
    throw new Error(
      '[playground shim] fs called before __rozieVfs was set up (compileBundle must populate it)',
    );
  }
  return v;
}

export function readFileSync(path: string): string {
  const v = vfs();
  if (v.has(path)) return v.get(path)!;
  throw new Error(`[playground shim] fs.readFileSync: no VFS entry for ${path}`);
}

export function existsSync(path: string): boolean {
  return globalThis.__rozieVfs?.has(path) ?? false;
}

export function statSync(): never {
  throw new Error('[playground shim] fs.statSync called in browser');
}

// Default export keeps the `import * as fs` namespace-object pattern working
// under both ESM and interop paths.
export default { readFileSync, existsSync, statSync };
