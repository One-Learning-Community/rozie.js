// Spike 019 — a real Volar-based LSP server for .rozie.
//
// Spike 018 proved the virtual TypeScript. This wraps it in an actual language
// server that speaks LSP over stdio, so the IntelliJ native platform LSP API
// (Spike 017's winner) has something to talk to.
//
// Deliberately self-contained: it resolves its own TypeScript instead of
// requiring `initializationOptions.typescript.tsdk`, because IntelliJ's LSP API
// will not hand us a tsdk path the way the VS Code client does.

import {
  createConnection,
  createServer,
  createTypeScriptProject,
  loadTsdkByPath,
} from '@volar/language-server/node.js';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { generateVirtualTs } from './rozie-virtual-code.mjs';

const require = createRequire(import.meta.url);

const connection = createConnection();
const server = createServer(connection);

const snap = (t) => ({
  getText: (s, e) => t.slice(s, e),
  getLength: () => t.length,
  getChangeRange: () => undefined,
});

/** scriptId is a URI here (not a string) — normalise before testing the suffix. */
const idToPath = (scriptId) =>
  typeof scriptId === 'string' ? scriptId : (scriptId.fsPath ?? scriptId.path ?? String(scriptId));

const rozieLanguagePlugin = {
  getLanguageId(scriptId) {
    return idToPath(scriptId).endsWith('.rozie') ? 'rozie' : undefined;
  },
  createVirtualCode(scriptId, languageId, snapshot) {
    if (languageId !== 'rozie') return undefined;
    let code = 'export {};\n';
    let mappings = [{ sourceOffsets: [], generatedOffsets: [], lengths: [], data: {} }];
    try {
      ({ code, mappings } = generateVirtualTs(
        snapshot.getText(0, snapshot.getLength()),
        path.basename(idToPath(scriptId)),
      ));
    } catch (e) {
      // A generator crash must degrade to "no intelligence", never to a dead server.
      connection.console.error(`[rozie] virtual-code generation failed: ${e?.message}`);
    }
    return {
      id: 'root',
      languageId: 'typescript',
      snapshot: snap(code),
      mappings,
      embeddedCodes: [],
    };
  },
  typescript: {
    extraFileExtensions: [{ extension: 'rozie', isMixedContent: true, scriptKind: 7 /* Deferred */ }],
    getServiceScript(root) {
      return { code: root, extension: '.ts', scriptKind: 3 /* TS */ };
    },
  },
};

connection.onInitialize((params) => {
  // Prefer a client-supplied tsdk (VS Code does this); fall back to our own
  // resolution so IntelliJ — which sends none — still works.
  const suppliedTsdk = params.initializationOptions?.typescript?.tsdk;
  const tsdkPath = suppliedTsdk || path.dirname(require.resolve('typescript/lib/tsserverlibrary.js'));
  const tsdk = loadTsdkByPath(tsdkPath, params.locale);

  connection.console.log(`[rozie] language server up — tsdk: ${tsdkPath}`);

  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [rozieLanguagePlugin],
    })),
    createTypeScriptServices(tsdk.typescript),
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
