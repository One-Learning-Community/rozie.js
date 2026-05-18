// Wires the canonical Rozie TextMate grammar (lives in tools/textmate/) into
// Monaco via monaco-textmate + monaco-editor-textmate. The grammar is the
// SAME `source.rozie` scope shipped in the VS Code marketplace bundle, so the
// playground's left pane matches editor parity in VS Code.
//
// onigasm carries a ~500 KB WASM payload — acceptable for an internal testing
// tool. If we ever ship the playground publicly, swap to vscode-textmate +
// vscode-oniguruma (modern equivalents, smaller adapter surface).

import * as monaco from 'monaco-editor';
import { Registry } from 'monaco-textmate';
import { loadWASM } from 'onigasm';
import { wireTmGrammars } from 'monaco-editor-textmate';

// Vite resolves `?url` to a hashed asset path at build time and serves a 200
// at the original location in dev. `loadWASM` accepts a URL string.
import onigasmWasm from 'onigasm/lib/onigasm.wasm?url';

// Pull the grammar source-of-truth from the workspace tree. Vite resolves the
// relative path filesystem-style across the pnpm package boundary.
import rozieGrammarJson from '../../../tools/textmate/syntaxes/rozie.tmLanguage.json?raw';

let initialized: Promise<void> | null = null;

/**
 * Idempotent setup — register the rozie language, load onigasm, create the
 * Registry, and wire the tokenizer to monaco. Safe to call once at app boot.
 */
export function setupTextmate(): Promise<void> {
  if (initialized) return initialized;

  initialized = (async () => {
    monaco.languages.register({
      id: 'rozie',
      extensions: ['.rozie'],
      aliases: ['Rozie', 'rozie'],
    });

    await loadWASM(onigasmWasm);

    const registry = new Registry({
      getGrammarDefinition: async (scopeName: string) => {
        if (scopeName === 'source.rozie') {
          return { format: 'json' as const, content: rozieGrammarJson };
        }
        // The Rozie grammar references embedded scopes (source.ts, source.js,
        // source.css, text.html.basic) for <script>/<style>/<template> bodies.
        // We don't bundle those grammars — the tokenizer skips highlighting
        // inside the embedded ranges but still colors the surrounding SFC
        // structure (block tags, attributes, directives, interpolation).
        // Returning a non-throwing empty grammar lets monaco-textmate proceed.
        return { format: 'json' as const, content: '{"scopeName":"' + scopeName + '","patterns":[]}' };
      },
    });

    const grammars = new Map<string, string>([['rozie', 'source.rozie']]);
    await wireTmGrammars(monaco, registry, grammars);
  })();

  return initialized;
}
