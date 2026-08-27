/**
 * Phase 85 Plan 02 Task 1 — the cross-file read hook for Volar-hosted ROZ
 * providers.
 *
 * `FeatureContext.readDoc` (`../features.ts`) is what lets a consumer
 * `.rozie` file resolve a sibling PRODUCER `.rozie` file's props/slots
 * surface (component-tag attribute completion, slot-fill navigation). Under
 * the retired hand-rolled server this was backed by `TextDocuments` (open
 * buffers) + `readFileSync` (disk fallback) — see `server.ts`'s git history.
 * Under Volar, the open-buffer half is `context.language.scripts` — Volar's
 * own live script store, which already reflects unsaved editor buffers, so
 * reading through it (rather than re-reading disk) means an unsaved
 * sibling's props still resolve correctly. Disk stays the fallback for a
 * sibling that is not currently open in the editor.
 *
 * Never throws — a resolution miss returns null, and the analyzers already
 * treat a null read as "cross-file features degrade to silence" (T-85-05's
 * own disposition: `resolveComponentUri` is the only path in, unchanged).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LanguageServiceContext } from '@volar/language-service';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import type { FeatureContext } from '../features.js';

export function createFeatureContext(context: LanguageServiceContext): FeatureContext {
  return {
    readDoc(uri: string): string | null {
      try {
        const script = context.language.scripts.get(URI.parse(uri));
        if (script) return script.snapshot.getText(0, script.snapshot.getLength());
      } catch {
        // fall through to the disk read below.
      }
      try {
        return readFileSync(fileURLToPath(uri), 'utf8');
      } catch {
        return null;
      }
    },
  };
}

/**
 * The `document` Volar hands `provide*` is the `rozie-source` EMBEDDED
 * document — its `.uri` is a `volar-embedded-content://...` URI, not the
 * plain `file://` URI of the `.rozie` file itself (confirmed by reading
 * `@volar/language-service`'s `languageFeatureWorker`/`forEachEmbeddedDocument`
 * dispatch this session; the identity mapping only makes the TEXT and
 * OFFSETS byte-identical to the source, not the `.uri`).
 *
 * `computeDefinition`/`computeCompletions` resolve a `<components>` import
 * path relative to `doc.uri` (`resolveComponentUri`, `componentNav.ts`) —
 * resolving a relative path against an embedded-content URI's opaque,
 * percent-encoded path segment produces a nonsense target URI (observed:
 * `<components>` path `./ProbeProducer.rozie` resolved against the
 * consumer's embedded URI came back as
 * `volar-embedded-content://rozie-source/ProbeProducer.rozie` — a URI that
 * decodes as neither a real file nor a valid embedded-document reference).
 *
 * `toSourceDocument` swaps in the real source URI (from
 * `context.decodeEmbeddedDocumentUri`'s first tuple element — the
 * `sourceScript.id` Volar itself tracks) before an analyzer ever sees the
 * document, so `resolveComponentUri` resolves against the correct base and
 * — as an added benefit — the returned Location/WorkspaceEdit URIs are
 * plain `file://` URIs that Volar's own definition/rename transform decodes
 * as NOT an embedded-content URI and therefore returns unmodified (see
 * `rozieNavigation.ts`), which is exactly the "form the transform leaves
 * alone" RESEARCH.md's assumption A2 called for.
 */
export function toSourceDocument(
  context: LanguageServiceContext,
  document: TextDocument,
): TextDocument {
  const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
  if (!decoded) return document;
  const sourceUri = decoded[0].toString();
  if (sourceUri === document.uri) return document;
  return TextDocument.create(sourceUri, document.languageId, document.version, document.getText());
}
