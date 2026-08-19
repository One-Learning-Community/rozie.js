// Phase 3 Plan 06 Task 2 — transform/load tests.
//
// Tests 4-8 from plan §<behavior>:
//   4. transformInclude returns true for *.rozie ids; false for .vue / .ts / .js
//   5. load on a valid Counter.rozie produces { code, map } where code starts with `<template>`
//      (path-virtual: load on synthetic .rozie.vue id; bare .rozie ids are
//      handled by resolveId)
//   6. load on a malformed .rozie throws an Error with loc / frame / plugin / code (D-28)
//   7. Peer-dep resolve check — emits console.warn (NOT throw) when @rozie/runtime-vue
//      not resolvable from consumer (Pitfall 8). v1: warn-only.
//   8. A non-fatal warning diagnostic calls this.warn(...) instead of throwing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unplugin } from '../index.js';
import { createTransformHook, transformIncludeRozie, createLoadHook, createResolveIdHook } from '../transform.js';
import { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { registerBuiltins } from '../../../core/src/modifiers/registerBuiltins.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function makeRegistry(): ModifierRegistry {
  const r = new ModifierRegistry();
  registerBuiltins(r);
  return r;
}

describe('transformInclude — D-50 (Test 4)', () => {
  // Per path-virtual: the synthetic suffix `.rozie.vue` is what we transform.
  // resolveId rewrites bare .rozie → .rozie.vue, then load handles them.
  // The transformInclude in the plugin body matches *.rozie.vue ids only —
  // those that came through our resolveId.
  it('matches *.rozie.vue (synthetic) ids; rejects bare .rozie / .vue / .ts / .js', () => {
    expect(transformIncludeRozie('Foo.rozie.vue')).toBe(true);
    expect(transformIncludeRozie('/abs/path/Counter.rozie.vue')).toBe(true);
    expect(transformIncludeRozie('Foo.rozie')).toBe(false);
    expect(transformIncludeRozie('App.vue')).toBe(false);
    expect(transformIncludeRozie('main.ts')).toBe(false);
    expect(transformIncludeRozie('foo.js')).toBe(false);
  });
});

describe('resolveId hook — path-virtual rewrite (D-25 amendment)', () => {
  it('rewrites bare .rozie ids to <abs>.rozie.vue', () => {
    const resolveHook = createResolveIdHook();
    const id = './Counter.rozie';
    const importer = resolve(EXAMPLES, 'foo.ts');
    const out = resolveHook(id, importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.vue'));
  });

  it('returns null (no rewrite) for non-.rozie ids', () => {
    const resolveHook = createResolveIdHook();
    expect(resolveHook('./foo.vue', '/some/importer.ts')).toBeNull();
    expect(resolveHook('./bar.ts', '/some/importer.ts')).toBeNull();
  });

  it('handles absolute .rozie paths', () => {
    const resolveHook = createResolveIdHook();
    const abs = resolve(EXAMPLES, 'Counter.rozie');
    expect(resolveHook(abs, undefined)).toBe(abs + '.vue');
  });

  // Phase 06.2 D-118 cross-rozie composition: emitted Vue SFCs use
  // `import Foo from './Foo.vue'`. When a sibling `Foo.rozie` exists, the
  // resolveId hook must rewrite the request to the synthetic `Foo.rozie.vue`
  // so the load hook generates the SFC from the .rozie source.
  it('rewrites ./Foo.vue → <abs>/Foo.rozie.vue when sibling Foo.rozie exists', () => {
    const resolveHook = createResolveIdHook();
    const importer = resolve(EXAMPLES, 'Modal.rozie.vue');
    const out = resolveHook('./Counter.vue', importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.vue'));
  });

  it('does NOT rewrite ./Foo.vue when no sibling Foo.rozie exists', () => {
    const resolveHook = createResolveIdHook();
    const importer = resolve(EXAMPLES, 'Modal.rozie.vue');
    expect(resolveHook('./not-a-rozie-component.vue', importer)).toBeNull();
  });

  it('passes through synthetic .rozie.vue ids unchanged in the rewrite branch', () => {
    const resolveHook = createResolveIdHook();
    const importer = resolve(EXAMPLES, 'foo.ts');
    // Already-synthetic id should not be re-rewritten (would double-suffix).
    expect(resolveHook(resolve(EXAMPLES, 'Counter.rozie.vue'), importer)).toBeNull();
  });
});

describe('load hook — Counter.rozie compiles to <template>... (Test 5)', () => {
  const ctx = { warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    ctx.warn.mockClear();
    ctx.error.mockClear();
  });

  it('returns { code, map } where code starts with <template> for Counter', () => {
    const loadHook = createLoadHook(makeRegistry());
    const id = resolve(EXAMPLES, 'Counter.rozie.vue');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(typeof code).toBe('string');
    expect(code.startsWith('<template>')).toBe(true);
    // Counter has scoped style + script setup
    expect(code).toContain('<script setup');
    expect(code).toContain('<style scoped>');
    // Map is the magic-string SourceMap, with sources[0] pointing at the .rozie.
    expect(map).toBeDefined();
    expect(map.sources[0]).toMatch(/Counter\.rozie$/);
  });

  it('returns null for non-virtual ids', () => {
    const loadHook = createLoadHook(makeRegistry());
    expect(loadHook.call(ctx as any, '/regular/foo.ts')).toBeNull();
    expect(loadHook.call(ctx as any, '/regular/bar.vue')).toBeNull();
  });
});

describe('load hook — error handling (Test 6, D-28 Vite-shaped errors)', () => {
  const ctx = { warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    ctx.warn.mockClear();
    ctx.error.mockClear();
  });

  it('throws Vite-shaped error when source has no <rozie> envelope (ROZ001)', () => {
    const loadHook = createLoadHook(makeRegistry());
    // Use a file path the load hook resolves through fs but we override fs by
    // passing a synthetic id that doesn't exist — this should throw ENOENT.
    // Instead: directly exercise the transform pipeline with a malformed source.
    // We call the transform helper directly so we can inject the source.
    const transform = createTransformHook(makeRegistry());
    expect(() =>
      transform.call(ctx as any, 'no envelope here', '/foo/Bad.rozie'),
    ).toThrowError(/ROZ001|envelope|<rozie>/i);
    try {
      transform.call(ctx as any, 'no envelope', '/foo/Bad.rozie');
    } catch (e) {
      const err = e as Error & { plugin?: string; loc?: any; code?: string; frame?: string };
      expect(err.plugin).toBe('rozie');
      expect(err.code).toMatch(/^ROZ\d{3}$/);
      expect(err.loc).toBeDefined();
      expect(err.loc.file).toBe('/foo/Bad.rozie');
      expect(typeof err.loc.line).toBe('number');
      expect(typeof err.loc.column).toBe('number');
      expect(typeof err.frame).toBe('string');
    }
  });
});

describe('warning emission (Test 8) — non-fatal diagnostics call this.warn', () => {
  const ctx = { warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    ctx.warn.mockClear();
  });

  it('a parse warning calls this.warn instead of throwing', () => {
    // Construct a source that triggers a warning-severity diagnostic.
    // For Phase 3, our pipeline emits ROZ300 (r-for missing :key) as a warning.
    // Build a minimal .rozie source with that pattern.
    const transform = createTransformHook(makeRegistry());
    const src = `<rozie name="Test">
<template>
<ul>
  <li r-for="x in items">{{ x }}</li>
</ul>
</template>
</rozie>
`;
    // This should NOT throw — it should call ctx.warn with the ROZ300 warning.
    const result = transform.call(ctx as any, src, '/foo/Test.rozie');
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    // Expect at least one warn call mentioning ROZ300.
    expect(ctx.warn).toHaveBeenCalled();
    const calls = (ctx.warn.mock.calls as any[]).map((c) => JSON.stringify(c));
    expect(calls.some((c) => c.includes('ROZ300'))).toBe(true);
  });
});

describe('peer-dep check (Test 7) — runtime-vue resolvability', () => {
  // v1 acceptable: console.warn rather than throw. We emit a runtime-vue import
  // in the compiled .vue; if @rozie/runtime-vue is not resolvable from the
  // consumer project's CWD, surface a console.warn (not a throw). Pitfall 8.
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('factory does NOT throw when @rozie/runtime-vue is resolvable from cwd', () => {
    // In our monorepo @rozie/runtime-vue IS resolvable (workspace dep).
    // Expect no throw.
    expect(() => unplugin.vite({ target: 'vue' })).not.toThrow();
  });
});
