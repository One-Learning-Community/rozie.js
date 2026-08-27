/**
 * Phase 85 Task 1 — TypeScript self-resolution (REQ-V16).
 *
 * VS Code's LSP client supplies `initializationOptions.typescript.tsdk`.
 * IntelliJ's native platform LSP client sends NONE — the server must resolve
 * its own copy of TypeScript, or IntelliJ gets no type intelligence with no
 * error at all (a silent failure, not a loud one).
 *
 * Layered resolution chain, first hit wins:
 *   1. the client-supplied `initializationOptions.typescript.tsdk`
 *   2. the `ROZIE_TSDK` environment variable
 *   3. a `typescript/lib` directory staged beside the running server module
 *      (the layout both editor packagers stage TypeScript into)
 *   4. `typescript/lib/typescript.js` resolved from the first workspace
 *      folder's own `node_modules`
 *   5. a resolution from the server module itself — what makes monorepo
 *      development work (the hoisted `typescript` in the repo root)
 *
 * `typescript` MUST stay an external dependency in both tsdown configs:
 * `loadTsdkByPath` needs a real directory on disk, because TypeScript reads
 * its own `lib.*.d.ts` files from disk at that path, not from an inlined
 * bundle. Because the standalone artifact is CJS, module resolution goes
 * through a helper that prefers the ambient `require` (present in the CJS
 * bundle) and falls back to `createRequire` (present when this module runs
 * as ESM, e.g. under `pnpm --filter @rozie/language-server test`).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TsdkResolveParams {
  initializationOptions?: {
    typescript?: {
      tsdk?: string;
    };
  };
}

export interface WorkspaceFolderLike {
  uri: string;
}

/** Ambient `require` when one exists (the CJS standalone bundle); `createRequire` otherwise (ESM dev/test). */
function resolveRequire(): NodeJS.Require {
  // biome-ignore lint/suspicious/noExplicitAny: probing for the ambient CJS global, which does not exist in ESM's type surface.
  const ambient = (globalThis as any).require as NodeJS.Require | undefined;
  if (typeof ambient === 'function') return ambient;
  return createRequire(import.meta.url);
}

function tryResolve(req: NodeJS.Require, id: string, opts?: { paths?: string[] }): string | undefined {
  try {
    return req.resolve(id, opts);
  } catch {
    return undefined;
  }
}

function workspaceFolderPath(folder: WorkspaceFolderLike): string | undefined {
  try {
    return fileURLToPath(folder.uri);
  } catch {
    return undefined;
  }
}

/**
 * Resolve the directory `loadTsdkByPath` should be given (a `typescript/lib`
 * style path containing `typescript.js`), or `undefined` when every layer of
 * the chain misses. A miss is NOT an error — the caller logs and continues
 * serving ROZ-only (T-85-02); a dead server is worse than one with no types.
 */
export function resolveTsdkPath(
  params: TsdkResolveParams,
  workspaceFolders: readonly WorkspaceFolderLike[] = [],
): string | undefined {
  // 1. client-supplied (VS Code sends this; IntelliJ does not — REQ-V16).
  const supplied = params.initializationOptions?.typescript?.tsdk;
  if (supplied) return supplied;

  // 2. explicit escape hatch for monorepo dev / CI.
  const envTsdk = process.env.ROZIE_TSDK;
  if (envTsdk) return envTsdk;

  const req = resolveRequire();
  const here = path.dirname(fileURLToPath(import.meta.url));

  // 3. staged beside the running server module (both editor packagers do this).
  const bundledLibDir = path.join(here, 'typescript', 'lib');
  if (existsSync(path.join(bundledLibDir, 'typescript.js'))) return bundledLibDir;

  // 4. resolved from the first workspace folder's own node_modules.
  const firstFolder = workspaceFolders[0];
  if (firstFolder) {
    const folderPath = workspaceFolderPath(firstFolder);
    if (folderPath) {
      const resolved = tryResolve(req, 'typescript/lib/typescript.js', { paths: [folderPath] });
      if (resolved) return path.dirname(resolved);
    }
  }

  // 5. resolved from the server module itself — monorepo dev.
  const fromServerModule = tryResolve(req, 'typescript/lib/typescript.js');
  if (fromServerModule) return path.dirname(fromServerModule);

  return undefined;
}
