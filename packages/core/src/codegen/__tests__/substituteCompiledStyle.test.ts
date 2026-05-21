/**
 * substituteCompiledStyle.test.ts — Phase 10 Plan 04 Task 1.
 *
 * Unit tests for the shared substituteCompiledStyle helper (Pattern 2 — the
 * single highest-risk item in the phase). The helper splices `ast.style.cssText`
 * (the COMPILED plain CSS produced by parseStyle for `lang="scss"` blocks) into
 * the style-block body byte range of the source string the six emitStyle.ts
 * files slice from.
 *
 * Coverage:
 *  - plain CSS (no style block) → source returned unchanged, byte-for-byte
 *  - plain CSS (style block, lang absent / 'css') → source returned unchanged
 *  - lang="scss" → style-block body span replaced by ast.style.cssText
 *  - case-insensitive / trimmed lang recognition
 *  - the helper does not mutate its arguments
 */
import { describe, it, expect } from 'vitest';
import { substituteCompiledStyle } from '../substituteCompiledStyle.js';
import type { RozieAST } from '../../ast/types.js';
import type { StyleAST } from '../../ast/blocks/StyleAST.js';

/** Minimal RozieAST stub carrying only the fields the helper reads. */
function makeAst(style: StyleAST | null): RozieAST {
  return {
    type: 'RozieAST',
    name: 'Stub',
    loc: { start: 0, end: 0 },
    props: null,
    data: null,
    script: null,
    listeners: null,
    template: null,
    style,
    components: null,
    blocks: { rozie: { name: 'Stub', loc: { start: 0, end: 0 } } },
  } as RozieAST;
}

describe('substituteCompiledStyle — Phase 10 Pattern 2 splice helper', () => {
  it('Test 1 (no style block): returns the source unchanged byte-for-byte', () => {
    const source = '<rozie name="X"><template><div/></template></rozie>';
    const ast = makeAst(null);
    expect(substituteCompiledStyle(source, ast)).toBe(source);
  });

  it('Test 2 (plain <style>, lang absent): returns the source unchanged', () => {
    // The style body lives at bytes [20, 40).
    const source = '<rozie><style>.a{color:red}</style></rozie>';
    const style: StyleAST = {
      type: 'StyleAST',
      loc: { start: 14, end: 29 },
      cssText: '.a{color:red}',
      rules: [],
    };
    const ast = makeAst(style);
    expect(substituteCompiledStyle(source, ast)).toBe(source);
  });

  it('Test 3 (lang="css"): returns the source unchanged', () => {
    const source = '<rozie><style lang="css">.a{color:red}</style></rozie>';
    const style: StyleAST = {
      type: 'StyleAST',
      loc: { start: 25, end: 38 },
      cssText: '.a{color:red}',
      rules: [],
      lang: 'css',
    };
    const ast = makeAst(style);
    expect(substituteCompiledStyle(source, ast)).toBe(source);
  });

  it('Test 4 (lang="scss"): replaces the style-block body span with cssText', () => {
    // The raw SCSS body `$c:red;.a{color:$c}` occupies bytes [26, 45).
    const rawBody = '$c:red;.a{color:$c}';
    const source = `<rozie><style lang="scss">${rawBody}</style></rozie>`;
    const bodyStart = source.indexOf(rawBody);
    const bodyEnd = bodyStart + rawBody.length;
    const compiledCss = '.a {\n  color: red;\n}';
    const style: StyleAST = {
      type: 'StyleAST',
      loc: { start: bodyStart, end: bodyEnd },
      cssText: compiledCss,
      rules: [],
      lang: 'scss',
    };
    const ast = makeAst(style);
    const out = substituteCompiledStyle(source, ast);
    // The body span [bodyStart, bodyEnd) is now the compiled CSS; the
    // surrounding <style>/<\/style> tags and the rest of the source survive.
    expect(out).toBe(
      source.slice(0, bodyStart) + compiledCss + source.slice(bodyEnd),
    );
    // No raw SCSS syntax survives.
    expect(out).not.toContain('$c');
    // A slice at any offset inside the body span lands on compiled CSS.
    expect(out.slice(bodyStart, bodyStart + compiledCss.length)).toBe(compiledCss);
  });

  it('Test 5 (lang="  SCSS  "): recognizes case-insensitively + trimmed', () => {
    const rawBody = '$c:red;.a{color:$c}';
    const source = `<rozie><style lang="  SCSS  ">${rawBody}</style></rozie>`;
    const bodyStart = source.indexOf(rawBody);
    const bodyEnd = bodyStart + rawBody.length;
    const compiledCss = '.a {\n  color: red;\n}';
    const style: StyleAST = {
      type: 'StyleAST',
      loc: { start: bodyStart, end: bodyEnd },
      cssText: compiledCss,
      rules: [],
      lang: '  SCSS  ',
    };
    const ast = makeAst(style);
    const out = substituteCompiledStyle(source, ast);
    expect(out).toBe(
      source.slice(0, bodyStart) + compiledCss + source.slice(bodyEnd),
    );
  });

  it('Test 6 (purity): does not mutate source or ast', () => {
    const rawBody = '$c:red;.a{color:$c}';
    const source = `<rozie><style lang="scss">${rawBody}</style></rozie>`;
    const bodyStart = source.indexOf(rawBody);
    const bodyEnd = bodyStart + rawBody.length;
    const style: StyleAST = {
      type: 'StyleAST',
      loc: { start: bodyStart, end: bodyEnd },
      cssText: '.a {\n  color: red;\n}',
      rules: [],
      lang: 'scss',
    };
    const ast = makeAst(style);
    const sourceBefore = source;
    const cssTextBefore = style.cssText;
    const locBefore = { ...style.loc };
    substituteCompiledStyle(source, ast);
    expect(source).toBe(sourceBefore);
    expect(style.cssText).toBe(cssTextBefore);
    expect(style.loc).toEqual(locBefore);
  });
});
