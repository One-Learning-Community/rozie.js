/**
 * expandMemo — Quick 260717-8zb unit contract.
 *
 * RED-FIRST discipline: this suite was authored against a codebase where
 * `../lowerers/expandMemo.js` did not yet exist and `$memo(...)` passed
 * through unrecognized. Confirmed RED (module-not-found / assertion failure)
 * before `expandMemo.ts` landed. Dynamic `import()` inside each `it` mirrors
 * the repo's established pre-implementation-RED convention
 * (inlineScriptPartials.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { parse as babelParse } from '@babel/parser';
import generate from '@babel/generator';
import type { File, Program, Statement } from '@babel/types';

/** Parse a module-source string into a Babel File (the `<script>` program shape). */
function moduleFile(src: string): File {
  return babelParse(src, { sourceType: 'module', plugins: ['typescript'] });
}

function bodyOf(file: File): Statement[] {
  return (file.program as Program).body;
}

function render(file: File): string {
  return generate(file).code;
}

describe('expandMemo', () => {
  it('byte-level NO-OP on a script with no $memo call', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = [
      `const x = 1;`,
      `function helper(n) { return n * 2; }`,
      `const y = $computed(() => x + 1);`,
    ].join('\n');
    const file = moduleFile(src);
    const before = render(file);
    const result = expandMemo(file);
    const after = render(file);
    expect(result.expandedNames).toEqual([]);
    expect(after).toBe(before);
  });

  it('expands a well-formed top-level $memo into a cache const + wrapper function', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = `const filteredOptions = $memo(() => computeFiltered(opts, q), () => [opts, q]);`;
    const file = moduleFile(src);
    const result = expandMemo(file);
    expect(result.expandedNames).toEqual(['filteredOptions']);

    const body = bodyOf(file);
    // Two top-level declarations replace the single $memo declarator.
    expect(body).toHaveLength(2);

    const [cacheStmt, wrapperStmt] = body as [Statement, Statement];
    expect(cacheStmt.type).toBe('VariableDeclaration');
    expect(wrapperStmt.type).toBe('VariableDeclaration');

    const code = render(file);
    // Cache-object shape.
    expect(code).toContain('filteredOptionsCache');
    expect(code).toMatch(/keys:\s*null/);
    expect(code).toMatch(/val:\s*null/);
    expect(code).toMatch(/has:\s*false/);
    // Wrapper is a plain function assigned to the original name.
    expect(code).toContain('const filteredOptions = () =>');
    // keyFn body inlined and evaluated BEFORE the cache-hit check (subscribe-first).
    const keyIdx = code.indexOf('opts, q');
    const hitCheckIdx = code.indexOf('filteredOptionsCache.has');
    expect(keyIdx).toBeGreaterThan(-1);
    expect(hitCheckIdx).toBeGreaterThan(-1);
    expect(keyIdx).toBeLessThan(hitCheckIdx);
    // fn body (the MISS path) is present too.
    expect(code).toContain('computeFiltered(opts, q)');
    // No literal `$memo(` survives.
    expect(code).not.toContain('$memo(');
  });

  it('inlines a block-bodied keyFn/fn as an IIFE, preserving statement logic', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = [
      `const total = $memo(`,
      `  () => { const sum = a + b; return sum * 2; },`,
      `  () => { return [a, b]; },`,
      `);`,
    ].join('\n');
    const file = moduleFile(src);
    const result = expandMemo(file);
    expect(result.expandedNames).toEqual(['total']);
    const code = render(file);
    expect(code).toContain('const sum = a + b');
    expect(code).toContain('return sum * 2');
    expect(code).not.toContain('$memo(');
  });

  it('leaves a `let`-bound $memo call untouched (misuse — not a top-level const)', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = `let x = $memo(() => 1, () => []);`;
    const file = moduleFile(src);
    const before = render(file);
    const result = expandMemo(file);
    const after = render(file);
    expect(result.expandedNames).toEqual([]);
    expect(after).toBe(before);
  });

  it('leaves a $memo call with the wrong arity untouched (misuse)', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = `const x = $memo(() => 1);`;
    const file = moduleFile(src);
    const before = render(file);
    const result = expandMemo(file);
    const after = render(file);
    expect(result.expandedNames).toEqual([]);
    expect(after).toBe(before);
  });

  it('leaves a $memo call with non-arrow arguments untouched (misuse)', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = `function fn() { return 1; }\nconst x = $memo(fn, () => []);`;
    const file = moduleFile(src);
    const before = render(file);
    const result = expandMemo(file);
    const after = render(file);
    expect(result.expandedNames).toEqual([]);
    expect(after).toBe(before);
  });

  it('expands multiple independent $memo declarations in source order', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = [
      `const a = $memo(() => 1, () => []);`,
      `const b = $memo(() => 2, () => []);`,
    ].join('\n');
    const file = moduleFile(src);
    const result = expandMemo(file);
    expect(result.expandedNames).toEqual(['a', 'b']);
    expect(bodyOf(file)).toHaveLength(4);
  });
});
