import {
  createConnection,
  type InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { computeDiagnostics } from './diagnostics.js';
import {
  computeCompletions,
  computeDefinition,
  computeHover,
  computePrepareRename,
  computeRename,
} from './features.js';

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
        // `.` after a `$props`/`$data`/`$refs` sigil triggers member completion;
        // `<` triggers composed-component tag-name completion.
        completionProvider: { triggerCharacters: ['.', '<'] },
        definitionProvider: true,
        hoverProvider: true,
        renameProvider: { prepareProvider: true },
      },
    }),
  );

  // Resolve a request's target document, guarding to .rozie files only.
  const rozieDoc = (uri: string): TextDocument | undefined => {
    const doc = documents.get(uri);
    return doc && doc.uri.endsWith(ROZIE_EXTENSION) ? doc : undefined;
  };

  connection.onCompletion((params) => {
    const doc = rozieDoc(params.textDocument.uri);
    return doc ? computeCompletions(doc, params.position) : [];
  });

  connection.onDefinition((params) => {
    const doc = rozieDoc(params.textDocument.uri);
    return doc ? computeDefinition(doc, params.position) : null;
  });

  connection.onHover((params) => {
    const doc = rozieDoc(params.textDocument.uri);
    return doc ? computeHover(doc, params.position) : null;
  });

  connection.onPrepareRename((params) => {
    const doc = rozieDoc(params.textDocument.uri);
    return doc ? computePrepareRename(doc, params.position) : null;
  });

  connection.onRenameRequest((params) => {
    const doc = rozieDoc(params.textDocument.uri);
    return doc ? computeRename(doc, params.position, params.newName) : null;
  });

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
