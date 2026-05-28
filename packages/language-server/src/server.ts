import {
  createConnection,
  type InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { computeDiagnostics } from './diagnostics.js';

const ROZIE_EXTENSION = '.rozie';

/**
 * Start the Rozie language server over the stdio connection (the transport the
 * editor clients — the VSCode extension and IntelliJ via LSP4IJ — spawn it
 * with).
 *
 * First slice: publishes `@rozie/core` diagnostics (ROZ codes → host ranges) on
 * open/change. Completion, navigation, hover, and rename will register as
 * additional capabilities here, each backed by the same shared analyzer.
 */
export function startServer(): void {
  const connection = createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  connection.onInitialize(
    (): InitializeResult => ({
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
      },
    }),
  );

  const publish = (doc: TextDocument): void => {
    // Only diagnose .rozie documents — the client registers us for the Rozie
    // language, but guard defensively so a stray document never reaches parse().
    if (!doc.uri.endsWith(ROZIE_EXTENSION)) return;
    void connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics: computeDiagnostics(doc),
    });
  };

  documents.onDidOpen((event) => publish(event.document));
  documents.onDidChangeContent((change) => publish(change.document));

  documents.listen(connection);
  connection.listen();
}
