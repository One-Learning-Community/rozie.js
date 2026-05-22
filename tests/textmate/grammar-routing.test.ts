// Phase 10 — automated coverage for the Rozie TextMate grammar's
// `<style lang="scss">` routing.
//
// Plan 10-02 inserted a `#block-style-scss` entry FIRST in the grammar's
// top-level `patterns` array so TextMate first-match-wins routes
// `<style lang="scss">` block bodies to the `source.css.scss` embedded
// grammar, while plain `<style>` / `<style lang="css">` falls through to
// `#block-style` (`source.css`). Until now that routing was eyeball-verified
// only — this file tokenizes real `.rozie` source with the actual grammar
// (via `vscode-textmate` + `vscode-oniguruma`, the engine VS Code itself
// uses) and asserts the routing holds.
//
// Embedded-grammar resolution is modeled on
// `examples/playground/src/textmate-setup.ts`: the Rozie grammar's own
// `scopeName` plus `source.css` and `source.css.scss` from `tm-grammars`.
// We deliberately do NOT resolve the JS/TS/HTML sub-grammars — vscode-textmate
// degrades gracefully on unresolved `include`s (unknown sub-grammars simply
// don't contribute scopes), and only the CSS-vs-SCSS routing is under test.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma';
import {
  type IGrammar,
  INITIAL,
  type IRawGrammar,
  parseRawGrammar,
  Registry,
} from 'vscode-textmate';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = join(__dirname, '..', '..');
const ROZIE_GRAMMAR_PATH = join(
  REPO_ROOT,
  'tools',
  'textmate',
  'syntaxes',
  'rozie.tmLanguage.json',
);
const FIXTURES_DIR = join(REPO_ROOT, 'tools', 'textmate', 'fixtures');

// `tm-grammars` ships the same grammar JSON files VS Code + shiki use.
// Its `exports` map exposes `./grammars/*`, so `require.resolve` locates
// each grammar file regardless of pnpm's hoisting layout.
function tmGrammar(name: string): string {
  return readFileSync(require.resolve(`tm-grammars/grammars/${name}.json`), 'utf8');
}

// scopeName -> raw grammar JSON. Mirrors GRAMMAR_JSON_BY_SCOPE in
// examples/playground/src/textmate-setup.ts. `source.css.scss`'s grammar
// internally `include`s `source.css`, so both are registered.
const GRAMMAR_JSON_BY_SCOPE: Record<string, string> = {
  'source.rozie': readFileSync(ROZIE_GRAMMAR_PATH, 'utf8'),
  'source.css': tmGrammar('css'),
  'source.css.scss': tmGrammar('scss'),
};

let registry: Registry;
let rozieGrammar: IGrammar;

beforeAll(async () => {
  // Load the oniguruma WASM blob shipped with vscode-oniguruma.
  const onigWasmPath = join(
    dirname(require.resolve('vscode-oniguruma/package.json')),
    'release',
    'onig.wasm',
  );
  await loadWASM(readFileSync(onigWasmPath).buffer as ArrayBuffer);

  registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: async (scopeName: string) => {
      const raw = GRAMMAR_JSON_BY_SCOPE[scopeName];
      if (!raw) return null; // unknown sub-grammars degrade gracefully
      return parseRawGrammar(raw, `${scopeName}.json`) as IRawGrammar;
    },
  });

  const grammar = await registry.loadGrammar('source.rozie');
  if (!grammar) throw new Error('failed to load source.rozie grammar');
  rozieGrammar = grammar;
});

/**
 * Tokenize every line of `source` with the Rozie grammar and return one
 * flat array of { line, text, scopes } entries — the union of all TextMate
 * scopes that apply to each token.
 */
function tokenizeAll(source: string): Array<{ line: number; text: string; scopes: string[] }> {
  const lines = source.split('\n');
  let ruleStack = INITIAL;
  const out: Array<{ line: number; text: string; scopes: string[] }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const result = rozieGrammar.tokenizeLine(line, ruleStack);
    for (const tok of result.tokens) {
      out.push({
        line: i,
        text: line.slice(tok.startIndex, tok.endIndex),
        scopes: tok.scopes,
      });
    }
    ruleStack = result.ruleStack;
  }
  return out;
}

/** True if any scope on the token belongs to the `source.css.scss` family. */
function hasScssScope(scopes: string[]): boolean {
  return scopes.some((s) =>
    s.split(' ').some((part) => part === 'source.css.scss' || part.endsWith('.scss')),
  );
}

/** True if any scope on the token is exactly `source.css`. */
function hasPlainCssScope(scopes: string[]): boolean {
  return scopes.some((s) => s.split(' ').includes('source.css'));
}

describe('Rozie TextMate grammar — <style lang="scss"> routing', () => {
  it('routes <style lang="scss"> block body to source.css.scss', () => {
    const source = readFileSync(join(FIXTURES_DIR, 'CounterScss.rozie'), 'utf8');
    const tokens = tokenizeAll(source);

    // The SCSS body of CounterScss.rozie contains `$gap` and `$accent`
    // SCSS variables and a `&:hover` parent-ref — all SCSS-only constructs.
    // Find tokens that are part of the embedded style block.
    const styleBodyTokens = tokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.embedded.block.style.scss.rozie')),
    );
    expect(
      styleBodyTokens.length,
      'expected tokens inside the <style lang="scss"> body',
    ).toBeGreaterThan(0);

    // Every style-body token must carry the SCSS-family scope — proving the
    // embedded `source.css.scss` grammar is active for this block.
    const scssTokens = styleBodyTokens.filter((t) => hasScssScope(t.scopes));
    expect(
      scssTokens.length,
      'expected SCSS-scoped tokens inside <style lang="scss">',
    ).toBeGreaterThan(0);

    // Spot-check a genuinely SCSS-only construct: the `$gap` variable.
    // The SCSS grammar scopes `$`-prefixed variables as `variable.scss`;
    // plain CSS has no such concept, so this token can ONLY appear if the
    // SCSS grammar is the one tokenizing the block.
    const gapVar = tokens.find((t) => t.text === '$gap' && t.scopes.includes('variable.scss'));
    expect(
      gapVar,
      'expected the SCSS `$gap` variable to carry the variable.scss scope',
    ).toBeDefined();

    // Spot-check the SCSS parent-reference selector `&` — another
    // SCSS-only construct (plain CSS has no nesting parent-ref).
    const parentRef = tokens.find(
      (t) => t.text === '&' && t.scopes.includes('entity.name.tag.reference.scss'),
    );
    expect(
      parentRef,
      'expected the SCSS `&` parent-ref to carry an entity.*.scss scope',
    ).toBeDefined();
  });

  it('keeps plain <style> block body on source.css (no SCSS over-match)', () => {
    // Counter.rozie has a plain `<style>` block (no lang attribute). The
    // first-match-wins #block-style-scss rule requires lang="scss" in its
    // lookahead, so a plain opener must fall through to #block-style.
    const source = readFileSync(join(FIXTURES_DIR, 'Counter.rozie'), 'utf8');
    const tokens = tokenizeAll(source);

    const styleBodyTokens = tokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.embedded.block.style.rozie')),
    );
    expect(styleBodyTokens.length, 'expected tokens inside the plain <style> body').toBeGreaterThan(
      0,
    );

    // The plain-style body must carry source.css.
    const cssTokens = styleBodyTokens.filter((t) => hasPlainCssScope(t.scopes));
    expect(
      cssTokens.length,
      'expected source.css-scoped tokens inside plain <style>',
    ).toBeGreaterThan(0);

    // And it must NOT carry the SCSS embedded scope or any SCSS-family
    // scope — proving lang="scss" is not over-matching a plain <style>.
    const overMatched = styleBodyTokens.filter(
      (t) =>
        t.scopes.some((s) => s.includes('meta.embedded.block.style.scss.rozie')) ||
        hasScssScope(t.scopes),
    );
    expect(overMatched, 'plain <style> body must not pick up any source.css.scss scope').toEqual(
      [],
    );
  });

  it('the two block-style rules emit distinct embedded scope names', () => {
    // Sanity guard on the grammar contract itself: routing only works if
    // the scss block and the plain block use different `contentName`s.
    const grammarSource = readFileSync(ROZIE_GRAMMAR_PATH, 'utf8');
    const grammarJson = JSON.parse(grammarSource);
    const repo = grammarJson.repository;

    expect(repo['block-style-scss'].contentName).toContain('source.css.scss');
    expect(repo['block-style'].contentName).toContain('source.css');
    expect(repo['block-style'].contentName).not.toContain('source.css.scss');

    // #block-style-scss must be listed BEFORE #block-style for
    // first-match-wins routing to work.
    const includes: string[] = grammarJson.patterns.map((p: { include?: string }) => p.include);
    expect(includes.indexOf('#block-style-scss')).toBeLessThan(includes.indexOf('#block-style'));
  });
});

describe('Rozie TextMate grammar — directives & r-model modifier chains', () => {
  // RModelMatch.rozie exercises every construct the grammar gained in v0.2.0:
  // the r-match / r-case / r-default switch-style directives (Phase 11),
  // r-model modifier chains (Phase 12), and the $portals magic identifier.
  const FIXTURE = 'RModelMatch.rozie';

  it('scopes r-match / r-case / r-default as r-* directives', () => {
    const tokens = tokenizeAll(readFileSync(join(FIXTURES_DIR, FIXTURE), 'utf8'));

    for (const directive of ['r-match', 'r-case', 'r-default']) {
      const tok = tokens.find(
        (t) =>
          t.text === directive &&
          t.scopes.some((s) => s.includes('entity.other.attribute-name.directive.rozie')),
      );
      expect(tok, `expected ${directive} to carry the directive scope`).toBeDefined();
    }
  });

  it('scopes the r-model modifier chain (.trim / .lazy / .number)', () => {
    const tokens = tokenizeAll(readFileSync(join(FIXTURES_DIR, FIXTURE), 'utf8'));

    // The modifier segments must land inside meta.modifier-chain.rozie — the
    // capture-group scope #directive-attribute now shares with #event-binding.
    const chainTokens = tokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.modifier-chain.rozie')),
    );
    expect(
      chainTokens.length,
      'expected modifier-chain-scoped tokens on r-model',
    ).toBeGreaterThan(0);

    // Each modifier name must carry support.function.modifier.rozie — the same
    // scope event-modifier names get, so themes colour them identically.
    for (const modifier of ['trim', 'lazy', 'number']) {
      const tok = tokens.find(
        (t) =>
          t.text === modifier &&
          t.scopes.some((s) => s.includes('support.function.modifier.rozie')),
      );
      expect(
        tok,
        `expected the .${modifier} modifier to carry support.function.modifier.rozie`,
      ).toBeDefined();
    }
  });

  it('keeps the r-model:propName argument scope alongside a modifier', () => {
    const tokens = tokenizeAll(readFileSync(join(FIXTURES_DIR, FIXTURE), 'utf8'));

    // r-model:amount.number — the `:amount` argument must still tokenize as a
    // directive argument even when a `.number` modifier chain follows it.
    const arg = tokens.find(
      (t) =>
        t.text === 'amount' &&
        t.scopes.some((s) =>
          s.includes('entity.other.attribute-name.directive-argument.rozie'),
        ),
    );
    expect(arg, 'expected the r-model:amount argument to keep its argument scope').toBeDefined();
  });

  it('scopes $portals as a magic identifier', () => {
    const tokens = tokenizeAll(readFileSync(join(FIXTURES_DIR, FIXTURE), 'utf8'));

    const tok = tokens.find(
      (t) => t.text === '$portals' && t.scopes.some((s) => s.includes('variable.language.rozie')),
    );
    expect(tok, 'expected $portals to carry the magic-identifier scope').toBeDefined();
  });

  // Phase 14: `$attrs` joined the magic-identifier set (consumer-passed
  // attribute cluster minus declared props). Inline-tokenized — no new fixture
  // file is needed because the assertion is purely "the regex matches this
  // identifier and emits the magic scope."
  it('scopes $attrs as a magic identifier (Phase 14)', () => {
    const source = [
      '<rozie name="X" inherit-attrs="false">',
      '<template>',
      '<button r-bind="$attrs">{{ $attrs.label }}</button>',
      '</template>',
      '</rozie>',
    ].join('\n');
    const tokens = tokenizeAll(source);

    const tok = tokens.find(
      (t) => t.text === '$attrs' && t.scopes.some((s) => s.includes('variable.language.rozie')),
    );
    expect(tok, 'expected $attrs to carry the magic-identifier scope').toBeDefined();
  });
});

describe('Rozie TextMate grammar — <script lang="ts"> routing', () => {
  // #block-script-ts is listed FIRST in the grammar's top-level patterns with
  // a lang="ts" lookahead, so a `<script lang="ts">` opener routes its body to
  // the `source.ts` embedded grammar (contentName meta.embedded.block.script.ts.rozie)
  // while a plain `<script>` falls through to #block-script (source.js).

  it('routes <script lang="ts"> block body to the source.ts embedded scope', () => {
    const source = readFileSync(join(FIXTURES_DIR, 'CounterTS.rozie'), 'utf8');
    const tokens = tokenizeAll(source);

    const tsBodyTokens = tokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.embedded.block.script.ts.rozie')),
    );
    expect(
      tsBodyTokens.length,
      'expected tokens inside the <script lang="ts"> body',
    ).toBeGreaterThan(0);

    // Every ts-body token carries `source.ts` — the contentName the
    // #block-script-ts rule applies, and the scope VS Code's embeddedLanguages
    // map keys TypeScript editor features off.
    const tsScoped = tsBodyTokens.filter((t) =>
      t.scopes.some((s) => s.split(' ').includes('source.ts')),
    );
    expect(
      tsScoped.length,
      'expected source.ts-scoped tokens inside <script lang="ts">',
    ).toBeGreaterThan(0);

    // And it must NOT also carry the plain-JS embedded scope — proving the
    // lang="ts" opener won over the generic #block-script rule.
    const jsLeak = tsBodyTokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.embedded.block.script.rozie source.js')),
    );
    expect(jsLeak, '<script lang="ts"> body must not pick up the source.js scope').toEqual([]);
  });

  it('keeps a plain <script> block body on source.js (no ts over-match)', () => {
    // Counter.rozie has a plain `<script>` (no lang). The #block-script-ts
    // lookahead requires lang="ts", so a plain opener must fall through.
    const source = readFileSync(join(FIXTURES_DIR, 'Counter.rozie'), 'utf8');
    const tokens = tokenizeAll(source);

    const jsBodyTokens = tokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.embedded.block.script.rozie')),
    );
    expect(
      jsBodyTokens.length,
      'expected tokens inside the plain <script> body',
    ).toBeGreaterThan(0);

    const tsOverMatch = jsBodyTokens.filter((t) =>
      t.scopes.some((s) => s.includes('meta.embedded.block.script.ts.rozie')),
    );
    expect(tsOverMatch, 'plain <script> body must not pick up the .ts embedded scope').toEqual([]);
  });

  it('the two block-script rules emit distinct embedded scope names', () => {
    // Sanity guard on the grammar contract: routing only works if the ts block
    // and the plain block use different `contentName`s, and #block-script-ts is
    // ordered first for first-match-wins.
    const grammarJson = JSON.parse(readFileSync(ROZIE_GRAMMAR_PATH, 'utf8'));
    const repo = grammarJson.repository;

    expect(repo['block-script-ts'].contentName).toContain('source.ts');
    expect(repo['block-script'].contentName).toContain('source.js');
    expect(repo['block-script'].contentName).not.toContain('source.ts');

    const includes: string[] = grammarJson.patterns.map((p: { include?: string }) => p.include);
    expect(includes.indexOf('#block-script-ts')).toBeLessThan(includes.indexOf('#block-script'));
  });
});
