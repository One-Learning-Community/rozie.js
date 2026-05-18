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

// Color palette borrowed from VS Code Dark+. Monaco's `vs-dark` theme only
// styles a handful of broad token names (string, comment, keyword, number) —
// it has no rules for the TextMate scopes (entity.name.tag, punctuation.*,
// meta.*) the rozie grammar actually emits, so structural tokens fell through
// to default white. Defining `rozie-dark` with longest-prefix-matched rules
// against the grammar's real scope names restores VS-Code-quality coloring.
const ROZIE_DARK_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // Comments
    { token: 'comment', foreground: '6a9955' },
    { token: 'comment.block', foreground: '6a9955' },

    // Strings
    { token: 'string', foreground: 'ce9178' },
    { token: 'string.quoted', foreground: 'ce9178' },

    // Tags — Rozie block names (<rozie>, <props>, <data>, <script>, <style>, etc.)
    // and component refs (<MyComponent>) end up under entity.name.tag.*
    { token: 'entity.name.tag', foreground: '569cd6' },
    { token: 'entity.name.tag.component', foreground: '4ec9b0' },
    { token: 'entity.name.tag.reference', foreground: '4ec9b0' },
    { token: 'entity.name.tag.slot-name', foreground: 'dcdcaa' },

    // Attribute names — plain HTML attrs + Rozie directive attrs (r-for, r-if,
    // @click.outside, :prop, etc.)
    { token: 'entity.other.attribute-name', foreground: '9cdcfe' },
    { token: 'entity.other.attribute-name.directive', foreground: 'c586c0' },
    { token: 'entity.other.attribute-name.directive-argument', foreground: 'dcdcaa' },
    { token: 'entity.other.attribute-name.prop-binding', foreground: 'c586c0' },
    { token: 'entity.other.attribute-name.scoped', foreground: 'c586c0' },
    { token: 'entity.other.attribute-name.lang', foreground: '9cdcfe' },

    // Event handlers (@click, @submit, @keydown.enter)
    { token: 'entity.name.function.event', foreground: 'dcdcaa' },

    // Punctuation
    { token: 'punctuation', foreground: '808080' },
    { token: 'punctuation.definition.tag', foreground: '808080' },
    { token: 'punctuation.definition.tag.begin', foreground: '808080' },
    { token: 'punctuation.definition.tag.end', foreground: '808080' },
    { token: 'punctuation.definition.event', foreground: 'c586c0' },
    { token: 'punctuation.definition.prop-binding', foreground: 'c586c0' },
    { token: 'punctuation.definition.slot-fill', foreground: 'c586c0' },
    { token: 'punctuation.section.embedded', foreground: 'c586c0' },
    { token: 'punctuation.section.brackets', foreground: 'd4d4d4' },
    { token: 'punctuation.section.arguments', foreground: 'd4d4d4' },
    { token: 'punctuation.separator', foreground: 'd4d4d4' },
    { token: 'punctuation.separator.modifier', foreground: 'c586c0' },

    // Embedded expressions — {{ ... }} interpolations
    { token: 'meta.embedded.expression', foreground: 'dcdcaa' },
    { token: 'meta.modifier-chain', foreground: 'c586c0' },

    // Keywords + variables + support fns
    { token: 'keyword', foreground: 'c586c0' },
    { token: 'keyword.other', foreground: '569cd6' },
    { token: 'support.function', foreground: 'dcdcaa' },
    { token: 'variable', foreground: '9cdcfe' },
    { token: 'variable.language', foreground: '569cd6' },
    { token: 'constant', foreground: '4fc1ff' },
    { token: 'constant.character', foreground: 'd7ba7d' },
  ],
  colors: {},
};

let initialized: Promise<void> | null = null;

/**
 * Idempotent setup — register the rozie language, load onigasm, create the
 * Registry, wire the tokenizer to monaco, and install the rozie-dark theme
 * matched to the grammar's actual scope names. Safe to call once at app boot.
 */
export function setupTextmate(): Promise<void> {
  if (initialized) return initialized;

  initialized = (async () => {
    monaco.languages.register({
      id: 'rozie',
      extensions: ['.rozie'],
      aliases: ['Rozie', 'rozie'],
    });

    monaco.editor.defineTheme('rozie-dark', ROZIE_DARK_THEME);

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
