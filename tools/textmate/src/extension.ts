import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { type ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

/**
 * VSCode side of the Option-C architecture: this extension already ships the
 * syntactic layer (the TextMate grammar in `contributes.grammars`); here we add
 * the semantic layer by starting a `vscode-languageclient` against the shared
 * `@rozie/language-server` — the same brain the IntelliJ plugin consumes via
 * LSP4IJ. Diagnostics, completion, go-to-definition, hover, find-references,
 * rename, and the document outline all arrive from the server, so VSCode reaches
 * feature parity with IntelliJ without re-implementing anything per editor.
 */

let client: LanguageClient | undefined;

/**
 * Resolve the standalone server script. Order:
 *   1. the `rozie.languageServer.path` setting (monorepo dev points it at
 *      `packages/language-server/dist-standalone/server-standalone.cjs`);
 *   2. the `ROZIE_LANGUAGE_SERVER` env var (same convention as the IntelliJ plugin);
 *   3. the bundle shipped in the extension at `server/server-standalone.cjs`.
 * Returns undefined when none resolve — the extension then stays grammar-only
 * rather than erroring.
 */
function resolveServerModule(context: ExtensionContext): string | undefined {
  const configured = workspace.getConfiguration('rozie').get<string>('languageServer.path');
  const candidates = [configured, process.env.ROZIE_LANGUAGE_SERVER];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  const bundled = context.asAbsolutePath(path.join('server', 'server-standalone.cjs'));
  return existsSync(bundled) ? bundled : undefined;
}

export function activate(context: ExtensionContext): void {
  const serverModule = resolveServerModule(context);
  if (!serverModule) {
    // No server available — syntax highlighting still works from the grammar.
    return;
  }

  // TransportKind.stdio appends `--stdio` and wires the pipes — exactly the
  // invocation the standalone bundle is built and smoke-tested for.
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'rozie' }],
  };

  client = new LanguageClient(
    'rozie',
    'Rozie Language Server',
    serverOptions,
    clientOptions,
  );
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
