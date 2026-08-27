/**
 * Phase 85 Plan 02 Task 2 — the ROZ completion service plugin.
 *
 * Adapter over `computeCompletions` (`../../features.ts`): that function
 * returns a bare `CompletionItem[]`, while Volar's `provideCompletionItems`
 * surface wants a `CompletionList` (`{ isIncomplete, items }`). Wrapping is
 * the only change.
 *
 * `isAdditionalCompletion: true` on the returned plugin INSTANCE is
 * load-bearing, not decoration. Volar's completion dispatch
 * (`lib/features/provideCompletionItems.js`, read in full this session) is a
 * primary+additional model, not a union: the first non-additional plugin to
 * answer a non-empty list for a document becomes that document's sole
 * primary source, and later primary plugins are skipped entirely
 * (`if (mainCompletionUri && (!isAdditional || ...)) continue;`). Without
 * this flag, whichever of {rozie-completion, volar-service-typescript}
 * happens to be ordered first would silently suppress the other, and plugin
 * array order is not a contract either plugin controls.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { computeCompletions } from '../../features.js';
import { createFeatureContext, toSourceDocument } from '../featureContext.js';

const ROZIE_SOURCE_EMBEDDED_ID = 'rozie-source';

export function createRozieCompletionPlugin(): LanguageServicePlugin {
  return {
    name: 'rozie-completion',
    capabilities: {
      completionProvider: { triggerCharacters: ['.', '<'] },
    },
    create(context) {
      const featureContext = createFeatureContext(context);
      return {
        isAdditionalCompletion: true,
        provideCompletionItems(document, position) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          const sourceDoc = toSourceDocument(context, document);
          const items = computeCompletions(sourceDoc, position, featureContext);
          return { isIncomplete: false, items };
        },
      };
    },
  };
}
