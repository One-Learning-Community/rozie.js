/**
 * Phase 85 Task 1 — the ROZ diagnostics service plugin.
 *
 * Follows Vue's own `vue-compiler-dom-errors.ts` pattern exactly: decline
 * every embedded document except the identity-mapped one this plugin owns,
 * so its host-coordinate output survives Volar's automatic range transform.
 *
 * `computeDiagnostics` (`../../diagnostics.js`) is the EXISTING, UNMODIFIED
 * analyzer — `document` handed to `provideDiagnostics` is byte-identical to
 * the raw `.rozie` file once it is confirmed to be the `rozie-source`
 * embedded code, so it runs completely unchanged.
 *
 * Only diagnostics are ported here. Hover, definition, completion,
 * references, rename and document-symbols port in Plan 85-02 (Wave 2) —
 * this is the tracer contract: one path through every layer first, breadth
 * second. `createRozieServicePlugins` (`./index.js`) is where those get
 * appended.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { computeDiagnostics } from '../../diagnostics.js';
import { toSourceDocument } from '../featureContext.js';

const ROZIE_SOURCE_EMBEDDED_ID = 'rozie-source';

export function createRozieDiagnosticsPlugin(): LanguageServicePlugin {
  return {
    name: 'rozie-diagnostics',
    capabilities: {
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
    },
    create(context) {
      return {
        provideDiagnostics(document) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          // toSourceDocument (Plan 85-02 Task 2): `document.uri` here is the
          // rozie-source EMBEDDED document's URI, not the plain `.rozie`
          // file:// URI. `compile()`'s <components> import resolution
          // (ROZ945) derives its base path from the document URI — against
          // the embedded URI's opaque encoded path it always fails to
          // resolve a real sibling file, producing a false ROZ945 on every
          // file with a <components> block. Plan 85-01's fixtures (Probe /
          // ProbeBad) had no <components> block, so this was latent until
          // Plan 85-02's ProbeConsumer/ProbeProducer pair caught it.
          return computeDiagnostics(toSourceDocument(context, document));
        },
      };
    },
  };
}
