/**
 * Phase 85 Plan 02 Task 2 — the ROZ go-to-definition + find-references
 * service plugin.
 *
 * Adapter over `computeDefinition` (`../../features.ts`): that function
 * returns a single `Location | null`, while Volar's `provideDefinition`
 * surface wants `LocationLink[]`. Wrapping is the only change —
 * `computeDefinition` itself is untouched.
 *
 * Cross-file target — RESEARCH.md assumption A2, closed here by observation
 * against `@volar/language-service@2.4.28`'s actual dispatch code
 * (`lib/features/provideDefinition.js`, read in full this session), not
 * assumed: a `LocationLink.targetUri` pointing at the PRODUCER `.rozie` file
 * is a plain (unencoded) `file://` URI — `resolveComponentUri` never runs it
 * through `context.encodeEmbeddedDocumentUri`. Volar's data-transform stage
 * only rewrites a link's target when
 * `context.decodeEmbeddedDocumentUri(link.targetUri)` succeeds, and that
 * decode only succeeds for a URI Volar itself encoded (it scheme-checks
 * against `embeddedContentScheme` — see `languageService.js`'s
 * `decodeEmbeddedDocumentUri`). A plain producer file URI fails that check,
 * so the transform's `if (sourceScript && targetVirtualFile)` branch is
 * skipped entirely and the link is returned UNCHANGED. `computeDefinition`'s
 * own producer-source-computed range therefore needs no extra encoding step
 * to survive the round trip — it already does, by construction.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { computeDefinition, computeReferences } from '../../features.js';
import { createFeatureContext, toSourceDocument } from '../featureContext.js';

const ROZIE_SOURCE_EMBEDDED_ID = 'rozie-source';

export function createRozieNavigationPlugin(): LanguageServicePlugin {
  return {
    name: 'rozie-navigation',
    capabilities: {
      definitionProvider: true,
      referencesProvider: true,
    },
    create(context) {
      const featureContext = createFeatureContext(context);
      return {
        provideDefinition(document, position) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          const sourceDoc = toSourceDocument(context, document);
          const loc = computeDefinition(sourceDoc, position, featureContext);
          if (!loc) return undefined;
          return [{ targetUri: loc.uri, targetRange: loc.range, targetSelectionRange: loc.range }];
        },
        provideReferences(document, position, referenceContext) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          const sourceDoc = toSourceDocument(context, document);
          return computeReferences(sourceDoc, position, referenceContext.includeDeclaration);
        },
      };
    },
  };
}
