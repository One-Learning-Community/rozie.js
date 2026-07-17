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
    // Cache-object shape: keys-null IS the miss sentinel — no separate `has`
    // flag (a boolean-gated read of `.keys` defeats strict-tsc null narrowing:
    // `has && keys.length` leaves `.keys` possibly-null inside the `.every`
    // closure, the exact TS18047 class that broke the strict-enforced
    // listbox-solid/lit leaves).
    expect(code).toContain('filteredOptionsCache');
    expect(code).toMatch(/keys:\s*null/);
    expect(code).toMatch(/val:\s*null/);
    expect(code).not.toMatch(/has:/);
    // Wrapper is a plain function assigned to the original name.
    expect(code).toContain('const filteredOptions = () =>');
    // The cached key is captured to a LOCAL before the guard — member-expression
    // narrowing does not survive into the `.every` callback, a local const does.
    expect(code).toContain('const __rozieMemoPrev = filteredOptionsCache.keys');
    expect(code).toContain('__rozieMemoPrev !== null');
    expect(code).toMatch(/__rozieMemoPrev\[i\]/);
    // No raw `filteredOptionsCache.keys` read inside the hit test (only the
    // local capture + the miss-path assignment may touch it).
    expect(code).not.toContain('filteredOptionsCache.keys.length');
    expect(code).not.toContain('filteredOptionsCache.has');
    // keyFn body inlined and evaluated BEFORE the cache-hit check (subscribe-first).
    const keyIdx = code.indexOf('opts, q');
    const hitCheckIdx = code.indexOf('__rozieMemoPrev !== null');
    expect(keyIdx).toBeGreaterThan(-1);
    expect(hitCheckIdx).toBeGreaterThan(-1);
    expect(keyIdx).toBeLessThan(hitCheckIdx);
    // fn body (the MISS path) is present too.
    expect(code).toContain('computeFiltered(opts, q)');
    // No literal `$memo(` survives.
    expect(code).not.toContain('$memo(');
  });

  it('casts the cache holder so strict null-checks accept the shape (all leaves are TS-flavored)', async () => {
    const { expandMemo } = await import('../lowerers/expandMemo.js');
    const src = `const filteredOptions = $memo(() => computeFiltered(opts, q), () => [opts, q]);`;
    const file = moduleFile(src);
    const result = expandMemo(file);
    expect(result.expandedNames).toEqual(['filteredOptions']);
    const code = render(file);
    // `as`-casts on the PROPERTY VALUES, not a TSTypeAnnotation on the
    // declarator id: an annotated declarator id risks defeating downstream
    // id-shape-matching passes (the Svelte typed-declarator lesson), and the
    // React mutated-instance useMemo stabilizer must keep seeing a plain
    // `const X = {…}` ObjectExpression init. `any` (not `unknown`) so the
    // wrapper's return doesn't leak `unknown` downstream (the null-init-$data
    // widened-to-any precedent). Unconditional — every emitted leaf is
    // TS-flavored regardless of the source script's lang (vue/svelte leaves
    // emit lang="ts"; react/solid/angular/lit emit .tsx/.ts).
    expect(code).toMatch(/keys:\s*null as any\[\]\s*\|\s*null/);
    expect(code).toMatch(/val:\s*null as any/);
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
