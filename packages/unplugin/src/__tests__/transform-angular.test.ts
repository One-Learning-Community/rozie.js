/**
 * Plan 05-04b Task 1 — Angular branch resolveId/load/transform tests.
 *
 * Mirrors transform-svelte.test.ts. Verifies:
 *   1. resolveId target='angular' rewrites Foo.rozie → <abs>/Foo.rozie.ts
 *   2. transformInclude matches *.rozie.ts synthetic ids
 *   3. load target='angular' returns { code, map } where code starts with
 *      `import` and contains expected Angular signal-API syntax
 *   4. createTransformHook(reg, 'angular') for Counter.rozie returns
 *      { code, map }; map.mappings non-empty (DX-01 anchor)
 *   5. Cross-check: unplugin path output is byte-identical to the
 *      packages/targets/angular/fixtures/Counter.ts.snap fixture.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResolveIdHook,
  createLoadHook,
  createTransformHook,
  transformIncludeRozie,
} from '../transform.js';
import { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { registerBuiltins } from '../../../core/src/modifiers/registerBuiltins.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const ANGULAR_FIXTURES = resolve(REPO_ROOT, 'packages/targets/angular/fixtures');

function makeRegistry(): ModifierRegistry {
  const r = new ModifierRegistry();
  registerBuiltins(r);
  return r;
}

describe('transformInclude — Plan 05-04b angular surface', () => {
  it('matches *.rozie.ts synthetic ids', () => {
    expect(transformIncludeRozie('Foo.rozie.ts')).toBe(true);
    expect(transformIncludeRozie('/abs/path/Counter.rozie.ts')).toBe(true);
  });

  it('does NOT match plain .ts ids (consumer-authored)', () => {
    expect(transformIncludeRozie('main.ts')).toBe(false);
    expect(transformIncludeRozie('/src/AppComponent.ts')).toBe(false);
    // Note: a file literally named `App.rozie.ts` on disk WOULD match — that's
    // intentional, the suffix is the contract.
  });

  it('does NOT match bare .rozie ids (resolveId rewrites these first)', () => {
    expect(transformIncludeRozie('Foo.rozie')).toBe(false);
  });
});

describe('resolveId target="angular" — Plan 05-04b path-virtual (Path A)', () => {
  it('rewrites bare .rozie ids to <abs>/Foo.rozie.ts', () => {
    const resolveHook = createResolveIdHook('angular');
    const id = './Counter.rozie';
    const importer = resolve(EXAMPLES, 'foo.ts');
    const out = resolveHook(id, importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.ts'));
  });

  it('returns null (no rewrite) for non-.rozie ids', () => {
    const resolveHook = createResolveIdHook('angular');
    expect(resolveHook('./foo.ts', '/some/importer.ts')).toBeNull();
    expect(resolveHook('./bar.svelte', '/some/importer.ts')).toBeNull();
    expect(resolveHook('./App.vue', '/some/importer.ts')).toBeNull();
  });

  it('handles absolute .rozie paths', () => {
    const resolveHook = createResolveIdHook('angular');
    const abs = resolve(EXAMPLES, 'Counter.rozie');
    expect(resolveHook(abs, undefined)).toBe(abs + '.ts');
  });

  it('passes through synthetic .rozie.ts ids unchanged', () => {
    const resolveHook = createResolveIdHook('angular');
    const synthetic = resolve(EXAMPLES, 'Counter.rozie.ts');
    expect(resolveHook(synthetic, undefined)).toBe(synthetic);
  });
});

describe('load hook target="angular" — Counter.rozie compiles to Angular standalone .ts', () => {
  const ctx = { warn: vi.fn(), error: vi.fn(), addWatchFile: vi.fn() };

  it('returns { code, map } where code imports from @angular/core for Counter', () => {
    const loadHook = createLoadHook(makeRegistry(), 'angular');
    const id = resolve(EXAMPLES, 'Counter.rozie.ts');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(typeof code).toBe('string');
    // Counter has @Component decorator with `selector: 'rozie-counter'` and
    // signal API: model<number>() for `value` (model: true), input<number>()
    // for `step`/`min`/`max`, signal() for hovering, computed() for
    // canIncrement/canDecrement.
    expect(code).toContain("from '@angular/core'");
    expect(code).toContain('@Component');
    expect(code).toContain("selector: 'rozie-counter'");
    expect(code).toContain('standalone: true');
    expect(code).toContain('model<number>(0)');
    expect(code).toContain('input<number>(');
    expect(code).toContain('signal(');
    expect(code).toContain('computed(');
    // DX-03 trust-erosion floor: hello from rozie survives byte-identical.
    expect(code).toContain('console.log("hello from rozie")');
    // Map is the magic-string SourceMap with sources[0] pointing at .rozie.
    expect(map).toBeDefined();
    expect(map.sources[0]).toMatch(/Counter\.rozie$/);
  });

  it('returns null for non-virtual ids (e.g., .rozie.tsx React-side / .rozie.svelte / .rozie.vue)', () => {
    const loadHook = createLoadHook(makeRegistry(), 'angular');
    expect(loadHook.call(ctx as any, '/regular/foo.ts')).toBeNull();
    expect(loadHook.call(ctx as any, '/abs/Counter.rozie.tsx')).toBeNull();
    expect(loadHook.call(ctx as any, '/abs/Counter.rozie.svelte')).toBeNull();
    expect(loadHook.call(ctx as any, '/abs/Counter.rozie.vue')).toBeNull();
  });
});

describe('transform hook target="angular" — direct pipeline test (DX-01 anchor)', () => {
  const ctx = { warn: vi.fn(), error: vi.fn(), addWatchFile: vi.fn() };

  it('Counter.rozie source produces { code, map } with non-empty mappings', () => {
    const counterSrc = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    const transform = createTransformHook(makeRegistry(), 'angular');
    const result = transform.call(ctx as any, counterSrc, resolve(EXAMPLES, 'Counter.rozie'));
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(code).toContain('@Component');
    expect(map).toBeDefined();
    // DX-01 anchor: source map must have non-empty mappings field for the
    // .rozie source to be reachable in browser DevTools.
    expect(typeof map.mappings).toBe('string');
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it('cross-check: unplugin path produces byte-identical output to packages/targets/angular/fixtures/Counter.ts.snap', () => {
    // The unplugin path delegates straight to emitAngular — output should
    // equal the locked fixture from Plan 05-04a (modulo trailing newline
    // which the snap file may or may not include).
    const counterSrc = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    const transform = createTransformHook(makeRegistry(), 'angular');
    const result = transform.call(ctx as any, counterSrc, resolve(EXAMPLES, 'Counter.rozie'));
    expect(result).not.toBeNull();
    const { code } = result as { code: string };
    const fixturePath = resolve(ANGULAR_FIXTURES, 'Counter.ts.snap');
    const expected = readFileSync(fixturePath, 'utf8');
    // Normalize trailing whitespace differences.
    expect(code.trim()).toBe(expected.trim());
  });

  it('SearchInput.rozie produces output matching SearchInput.ts.snap (cross-check)', () => {
    const src = readFileSync(resolve(EXAMPLES, 'SearchInput.rozie'), 'utf8');
    const transform = createTransformHook(makeRegistry(), 'angular');
    const result = transform.call(ctx as any, src, resolve(EXAMPLES, 'SearchInput.rozie'));
    expect(result).not.toBeNull();
    const { code } = result as { code: string };
    const fixturePath = resolve(ANGULAR_FIXTURES, 'SearchInput.ts.snap');
    const expected = readFileSync(fixturePath, 'utf8');
    expect(code.trim()).toBe(expected.trim());
  });
});
