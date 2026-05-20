// Browser shim for `enhanced-resolve`. Backed by `globalThis.__rozieVfs`
// (a Map<absolutePath, source>) populated by the playground's compileBundle
// before each compile pass. Resolves `./X.rozie` style specifiers against the
// consumer file's directory in the virtual filesystem.
//
// On failure: throws. @rozie/core's `tryResolveSync` wrapper catches and
// returns null, which surfaces upstream as `ROZ945` ("Cannot resolve
// <components> import") in the Output pane — the right user-facing signal.

declare global {
  // eslint-disable-next-line no-var
  var __rozieVfs: Map<string, string> | undefined;
}

function joinPath(fromDir: string, specifier: string): string {
  // enhanced-resolve handles `./`, `../`, absolute, and bare specifiers. The
  // playground's VFS only ever serves relative or absolute `.rozie` paths
  // under `/vfs/...`, so we implement just those two forms.
  if (specifier.startsWith('/')) return specifier;
  const segments = fromDir.split('/').filter(Boolean);
  const parts = specifier.split('/');
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return '/' + segments.join('/');
}

function tryCandidates(absPath: string): string | null {
  const v = globalThis.__rozieVfs;
  if (!v) return null;
  // Try the literal path first, then progressively common extensions. Most
  // `<components>` imports already include the `.rozie` extension explicitly
  // (the conventional form), so the literal hit is the hot path.
  if (v.has(absPath)) return absPath;
  if (v.has(absPath + '.rozie')) return absPath + '.rozie';
  if (v.has(absPath + '/index.rozie')) return absPath + '/index.rozie';
  // Basename fallback. The playground VFS is FLAT — every bundle file is
  // keyed `/vfs/<basename>` (snippets.ts `filenameFromGlob` strips any
  // directory prefix), so a `<components>` import that climbs out of `/vfs`
  // via `../` (e.g. `examples/demos/FooDemo.rozie` importing
  // `../Foo.rozie`) computes an absPath like `/Foo.rozie` that never
  // literally exists. Resolve such imports by basename instead: bundle
  // siblings always have distinct basenames, so this is unambiguous for the
  // flat-VFS model and makes every relative form (`./`, `../`, `../../`)
  // resolve uniformly.
  const base = absPath.split('/').pop() ?? absPath;
  if (base) {
    if (v.has('/vfs/' + base)) return '/vfs/' + base;
    if (v.has('/vfs/' + base + '.rozie')) return '/vfs/' + base + '.rozie';
  }
  return null;
}

function resolveSync(_ctx: object, fromDir: string, specifier: string): string {
  const absPath = joinPath(fromDir, specifier);
  const hit = tryCandidates(absPath);
  if (hit !== null) return hit;
  throw new Error(
    `[playground shim] enhanced-resolve: ${specifier} not found from ${fromDir} (tried ${absPath})`,
  );
}

const vfsResolver = { resolveSync };

export const ResolverFactory = {
  createResolver(): typeof vfsResolver {
    return vfsResolver;
  },
};

export default { ResolverFactory };
