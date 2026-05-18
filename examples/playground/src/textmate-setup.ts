// Wires the canonical Rozie TextMate grammar (lives in tools/textmate/) into
// Monaco using `vscode-textmate` + `vscode-oniguruma` — the same libs VS Code
// itself uses. Earlier iteration used monaco-textmate + onigasm, but onigasm's
// regex engine doesn't support modern Oniguruma features (look-behind etc.),
// flooding the console with "invalid pattern in look-behind" on the bundled
// TypeScript grammar. The Microsoft libs handle every pattern + are actively
// maintained.
//
// Embedded grammars (TS / JS / CSS / HTML) come from `tm-grammars` — Anthony
// Fu's runtime-ready collection of the same JSON files VS Code + shiki ship.
// The Rozie grammar's `include` directives reference `source.ts`/`source.js`/
// `source.css`/`text.html.basic`, so embedded block bodies (<script>, <style>,
// <template>, {{ }}) get full language-aware tokenization.

import * as monaco from 'monaco-editor';
import {
  INITIAL,
  Registry,
  parseRawGrammar,
  type IGrammar,
  type IRawGrammar,
  type StateStack,
} from 'vscode-textmate';
import {
  createOnigScanner,
  createOnigString,
  loadWASM,
} from 'vscode-oniguruma';

// Vite resolves `?url` to a hashed asset path at build time and serves the
// original at /node_modules/... in dev. We then fetch() the URL ourselves
// because vscode-oniguruma's loadWASM wants an ArrayBuffer (not a URL string).
import onigWasmUrl from 'vscode-oniguruma/release/onig.wasm?url';

// Canonical Rozie grammar from the workspace tree.
import rozieGrammarJson from '../../../tools/textmate/syntaxes/rozie.tmLanguage.json?raw';

// Embedded-language grammars from tm-grammars.
import tsGrammarJson from 'tm-grammars/grammars/typescript.json?raw';
import jsGrammarJson from 'tm-grammars/grammars/javascript.json?raw';
import cssGrammarJson from 'tm-grammars/grammars/css.json?raw';
import htmlGrammarJson from 'tm-grammars/grammars/html.json?raw';
import tsxGrammarJson from 'tm-grammars/grammars/tsx.json?raw';

// scopeName → raw JSON. Keys MUST match the `scopeName` field in each grammar.
const GRAMMAR_JSON_BY_SCOPE: Record<string, string> = {
  'source.rozie': rozieGrammarJson,
  'source.ts': tsGrammarJson,
  'source.js': jsGrammarJson,
  'source.css': cssGrammarJson,
  'text.html.basic': htmlGrammarJson,
  'source.tsx': tsxGrammarJson,
};

// Monaco language ID → top-level scope. These are the languages we install
// TextMate tokenizers for. The right pane sets `language: 'typescript'` /
// `'html'` etc., so wiring the TextMate tokenizer means BOTH panes use
// VS-Code-quality grammars instead of Monaco's built-in Monarch tokenizers.
const LANGUAGE_SCOPES: Array<{ id: string; scope: string; extensions?: string[] }> = [
  { id: 'rozie', scope: 'source.rozie', extensions: ['.rozie'] },
  { id: 'typescript', scope: 'source.ts' },
  { id: 'javascript', scope: 'source.js' },
  { id: 'css', scope: 'source.css' },
  { id: 'html', scope: 'text.html.basic' },
];

// VS Code Dark+ palette. Color rules use longest-prefix matching against the
// most specific TextMate scope on each token. Covers Rozie SFC structure,
// TS/JS keywords + identifiers, CSS selectors + properties, HTML tags.
const ROZIE_DARK_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // Comments
    { token: 'comment', foreground: '6a9955' },
    { token: 'comment.block', foreground: '6a9955' },
    { token: 'comment.line', foreground: '6a9955' },

    // Strings
    { token: 'string', foreground: 'ce9178' },
    { token: 'string.quoted', foreground: 'ce9178' },
    { token: 'string.regexp', foreground: 'd16969' },
    { token: 'string.template', foreground: 'ce9178' },

    // Rozie SFC structure
    { token: 'entity.name.tag', foreground: '569cd6' },
    { token: 'entity.name.tag.component', foreground: '4ec9b0' },
    { token: 'entity.name.tag.reference', foreground: '4ec9b0' },
    { token: 'entity.name.tag.slot-name', foreground: 'dcdcaa' },
    { token: 'entity.other.attribute-name', foreground: '9cdcfe' },
    { token: 'entity.other.attribute-name.directive', foreground: 'c586c0' },
    { token: 'entity.other.attribute-name.directive-argument', foreground: 'dcdcaa' },
    { token: 'entity.other.attribute-name.prop-binding', foreground: 'c586c0' },
    { token: 'entity.other.attribute-name.scoped', foreground: 'c586c0' },
    { token: 'entity.name.function.event', foreground: 'dcdcaa' },

    // Punctuation
    { token: 'punctuation', foreground: '808080' },
    { token: 'punctuation.definition.tag', foreground: '808080' },
    { token: 'punctuation.definition.event', foreground: 'c586c0' },
    { token: 'punctuation.definition.prop-binding', foreground: 'c586c0' },
    { token: 'punctuation.definition.slot-fill', foreground: 'c586c0' },
    { token: 'punctuation.section.embedded', foreground: 'c586c0' },
    { token: 'punctuation.section.brackets', foreground: 'd4d4d4' },
    { token: 'punctuation.section.arguments', foreground: 'd4d4d4' },
    { token: 'punctuation.separator', foreground: 'd4d4d4' },
    { token: 'punctuation.separator.modifier', foreground: 'c586c0' },

    // Embedded interpolation
    { token: 'meta.embedded.expression', foreground: 'dcdcaa' },
    { token: 'meta.modifier-chain', foreground: 'c586c0' },

    // TS/JS keywords + storage
    { token: 'keyword', foreground: 'c586c0' },
    { token: 'keyword.control', foreground: 'c586c0' },
    { token: 'keyword.operator', foreground: 'd4d4d4' },
    { token: 'keyword.operator.new', foreground: 'c586c0' },
    { token: 'keyword.other', foreground: '569cd6' },
    { token: 'storage', foreground: '569cd6' },
    { token: 'storage.type', foreground: '569cd6' },
    { token: 'storage.modifier', foreground: '569cd6' },

    // TS/JS identifiers
    { token: 'entity.name.function', foreground: 'dcdcaa' },
    { token: 'entity.name.type', foreground: '4ec9b0' },
    { token: 'entity.name.type.class', foreground: '4ec9b0' },
    { token: 'entity.name.type.interface', foreground: '4ec9b0' },
    { token: 'entity.name.type.module', foreground: '4ec9b0' },
    { token: 'support.function', foreground: 'dcdcaa' },
    { token: 'support.type', foreground: '4ec9b0' },
    { token: 'support.class', foreground: '4ec9b0' },
    { token: 'support.constant', foreground: '4fc1ff' },
    { token: 'support.variable', foreground: '9cdcfe' },
    { token: 'variable', foreground: '9cdcfe' },
    { token: 'variable.parameter', foreground: '9cdcfe' },
    { token: 'variable.other', foreground: '9cdcfe' },
    { token: 'variable.other.property', foreground: '9cdcfe' },
    { token: 'variable.language', foreground: '569cd6' },
    { token: 'constant', foreground: '4fc1ff' },
    { token: 'constant.numeric', foreground: 'b5cea8' },
    { token: 'constant.language', foreground: '569cd6' },
    { token: 'constant.character', foreground: 'd7ba7d' },
    { token: 'constant.character.escape', foreground: 'd7ba7d' },

    // CSS
    { token: 'entity.name.tag.css', foreground: 'd7ba7d' },
    { token: 'entity.other.attribute-name.class.css', foreground: 'd7ba7d' },
    { token: 'entity.other.attribute-name.id.css', foreground: 'd7ba7d' },
    { token: 'entity.other.attribute-name.pseudo-class.css', foreground: 'd7ba7d' },
    { token: 'support.type.property-name.css', foreground: '9cdcfe' },
    { token: 'support.constant.property-value.css', foreground: 'ce9178' },

    // Invalid + meta
    { token: 'invalid', foreground: 'f44747' },
    { token: 'meta.tag', foreground: 'd4d4d4' },
  ],
  colors: {},
};

let initialized: Promise<void> | null = null;

/**
 * Idempotent setup — register all language IDs, load oniguruma, build the
 * grammar Registry, install rozie-dark theme, then wire a TokensProvider for
 * each language that delegates to the TextMate engine. Safe to call once at
 * app boot; multiple calls are no-ops after the first.
 */
export function setupTextmate(): Promise<void> {
  if (initialized) return initialized;

  initialized = (async () => {
    // Register language IDs first so subsequent setTokensProvider calls land.
    for (const { id, extensions } of LANGUAGE_SCOPES) {
      if (!monaco.languages.getLanguages().some((l) => l.id === id)) {
        monaco.languages.register({ id, extensions });
      }
    }

    monaco.editor.defineTheme('rozie-dark', ROZIE_DARK_THEME);

    // Load oniguruma WASM. vscode-oniguruma accepts an ArrayBuffer or a
    // Response/Promise<Response> — we fetch and pass the buffer for simplicity.
    const wasmBuf = await fetch(onigWasmUrl).then((r) => r.arrayBuffer());
    await loadWASM(wasmBuf);

    const registry = new Registry({
      onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
      loadGrammar: async (scopeName: string) => {
        const raw = GRAMMAR_JSON_BY_SCOPE[scopeName];
        if (!raw) return null;
        return parseRawGrammar(raw, `${scopeName}.json`) as IRawGrammar;
      },
    });

    // Load each top-level grammar; embedded scopes are resolved lazily by
    // the Registry when the engine encounters an `include` directive.
    const grammarByLangId = new Map<string, IGrammar>();
    for (const { id, scope } of LANGUAGE_SCOPES) {
      const grammar = await registry.loadGrammar(scope);
      if (grammar) grammarByLangId.set(id, grammar);
    }

    // Wire a TokensProvider per language. We use the simpler `tokenizeLine`
    // (object tokens with full scope arrays) rather than `tokenizeLine2`
    // (encoded Uint32Array with theme metadata baked in) because Monaco's
    // theme-rule longest-prefix matching against the most-specific scope name
    // gives ~95% of the visual quality with a fraction of the adapter code.
    for (const { id } of LANGUAGE_SCOPES) {
      const grammar = grammarByLangId.get(id);
      if (!grammar) continue;
      monaco.languages.setTokensProvider(id, {
        getInitialState: () => INITIAL as unknown as monaco.languages.IState,
        tokenize: (line: string, state: monaco.languages.IState) => {
          const result = grammar.tokenizeLine(line, state as unknown as StateStack);
          return {
            tokens: result.tokens.map((t) => ({
              startIndex: t.startIndex,
              // Most-specific scope = last in the stack. Monaco does
              // longest-prefix matching against theme rules to pick a color.
              scopes: t.scopes[t.scopes.length - 1] ?? '',
            })),
            endState: result.ruleStack as unknown as monaco.languages.IState,
          };
        },
      });
    }
  })();

  return initialized;
}
