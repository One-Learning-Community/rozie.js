/**
 * Phase 85 (D1) — the Rozie language server, rebuilt on Volar's
 * `createServer`.
 *
 * One binary, one process, one client config, hosting BOTH:
 *   - `volar-service-typescript` — real TypeScript type intelligence for
 *     `.rozie` files via the generated virtual code (`volar/languagePlugin.ts`).
 *   - the ROZ service plugins (`volar/plugins/index.js`) — `@rozie/core`
 *     diagnostics, ported in place. This is the existing capability from the
 *     hand-rolled server this file replaces; Plan 85-02 ports the remaining
 *     six providers (hover, definition, completion, references, rename,
 *     document symbols) behind the same plugin composition.
 *
 * `createTypeScriptProject` discovers and honors the CONSUMER project's own
 * `tsconfig` — this file never constructs `compilerOptions` and, above all,
 * never injects a `strict` flag anywhere (REQ-V10). Imposing it measured a
 * 7.3-fold diagnostic inflation on the same corpus.
 *
 * When TypeScript cannot be resolved through ANY layer of `resolveTsdkPath`'s
 * chain (T-85-02 — the total-miss case, expected under some IntelliJ
 * configurations per REQ-V16), the server degrades to `createSimpleProject`
 * and serves ROZ diagnostics only, logging the miss rather than throwing. A
 * dead server is worse than a server with no types.
 */
import {
  createConnection,
  createServer,
  createSimpleProject,
  createTypeScriptProject,
  loadTsdkByPath,
} from '@volar/language-server/node.js';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import { rozieLanguagePlugin } from './volar/languagePlugin.js';
import { createRozieServicePlugins } from './volar/plugins/index.js';
import { resolveTsdkPath, type WorkspaceFolderLike } from './volar/tsdk.js';

export function startServer(): void {
  const connection = createConnection();
  const server = createServer(connection);

  connection.onInitialize((params) => {
    const workspaceFolders: WorkspaceFolderLike[] =
      params.workspaceFolders?.map((folder) => ({ uri: folder.uri })) ??
      (params.rootUri ? [{ uri: params.rootUri }] : []);

    const tsdkPath = resolveTsdkPath(params, workspaceFolders);

    if (!tsdkPath) {
      connection.console.error(
        '[rozie] TypeScript could not be resolved through any layer of the tsdk chain ' +
          '(client-supplied, ROZIE_TSDK, bundled, workspace, or server-module resolution). ' +
          'Serving ROZ diagnostics only — no TypeScript type intelligence this session.',
      );
      return server.initialize(params, createSimpleProject([rozieLanguagePlugin]), createRozieServicePlugins());
    }

    const tsdk = loadTsdkByPath(tsdkPath, params.locale);
    connection.console.log(`[rozie] language server up — tsdk: ${tsdkPath}`);

    return server.initialize(
      params,
      createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
        languagePlugins: [rozieLanguagePlugin],
      })),
      [...createTypeScriptServices(tsdk.typescript), ...createRozieServicePlugins()],
    );
  });

  connection.onInitialized(server.initialized);
  connection.onShutdown(server.shutdown);
  connection.listen();
}
