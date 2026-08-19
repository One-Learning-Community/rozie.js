/**
 * Plan 05-02b Task 1 — Svelte branch resolveId/load/transform tests.
 *
 * Mirrors react-resolveid.test.ts. Verifies:
 *   1. resolveId target='svelte' rewrites Foo.rozie → <abs>/Foo.rozie.svelte
 *   2. transformInclude matches *.rozie.svelte synthetic ids
 *   3. load target='svelte' returns { code, map } where code starts with
 *      `<script lang="ts">` and contains expected Svelte 5 rune syntax
 *   4. createTransformHook(reg, 'svelte') for Counter.rozie returns
 *      { code, map }; map.mappings non-empty (DX-01 anchor)
 *   5. Cross-check: unplugin path output is byte-identical to the
 *      packages/targets/svelte/fixtures/Counter.svelte.snap fixture.
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
const SVELTE_FIXTURES = resolve(REPO_ROOT, 'packages/targets/svelte/fixtures');

function makeRegistry(): ModifierRegistry {
  const r = new ModifierRegistry();
  registerBuiltins(r);
  return r;
}

describe('transformInclude — Plan 05-02b svelte surface', () => {
  it('matches *.rozie.svelte synthetic ids', () => {
    expect(transformIncludeRozie('Foo.rozie.svelte')).toBe(true);
    expect(transformIncludeRozie('/abs/path/Counter.rozie.svelte')).toBe(true);
  });

  it('does NOT match plain .svelte ids (consumer-authored)', () => {
    expect(transformIncludeRozie('App.svelte')).toBe(false);
    expect(transformIncludeRozie('/src/Header.svelte')).toBe(false);
  });

  it('does NOT match bare .rozie ids (resolveId rewrites these first)', () => {
    expect(transformIncludeRozie('Foo.rozie')).toBe(false);
  });
});

describe('resolveId target="svelte" — Plan 05-02b path-virtual', () => {
  it('rewrites bare .rozie ids to <abs>/Foo.rozie.svelte', () => {
    const resolveHook = createResolveIdHook('svelte');
    const id = './Counter.rozie';
    const importer = resolve(EXAMPLES, 'foo.ts');
    const out = resolveHook(id, importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.svelte'));
  });

  it('returns null (no rewrite) for non-.rozie ids', () => {
    const resolveHook = createResolveIdHook('svelte');
    expect(resolveHook('./foo.svelte', '/some/importer.ts')).toBeNull();
    expect(resolveHook('./bar.ts', '/some/importer.ts')).toBeNull();
    expect(resolveHook('./App.vue', '/some/importer.ts')).toBeNull();
  });

  it('handles absolute .rozie paths', () => {
    const resolveHook = createResolveIdHook('svelte');
    const abs = resolve(EXAMPLES, 'Counter.rozie');
    expect(resolveHook(abs, undefined)).toBe(abs + '.svelte');
  });

  it('passes through synthetic .rozie.svelte ids unchanged', () => {
    const resolveHook = createResolveIdHook('svelte');
    const synthetic = resolve(EXAMPLES, 'Counter.rozie.svelte');
    expect(resolveHook(synthetic, undefined)).toBe(synthetic);
  });

  // Phase 06.2 D-118 cross-rozie composition: emitted Svelte SFCs use
  // `import Foo from './Foo.svelte'` (and the D-117 self-import idiom does
  // the same for recursion). When a sibling `Foo.rozie` exists on disk, the
  // resolveId hook must rewrite to the synthetic `Foo.rozie.svelte` id.
  it('rewrites ./Foo.svelte → <abs>/Foo.rozie.svelte when sibling Foo.rozie exists', () => {
    const resolveHook = createResolveIdHook('svelte');
    const importer = resolve(EXAMPLES, 'Modal.rozie.svelte');
    const out = resolveHook('./Counter.svelte', importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.svelte'));
  });

  it('does NOT rewrite ./Foo.svelte when no sibling Foo.rozie exists', () => {
    const resolveHook = createResolveIdHook('svelte');
    const importer = resolve(EXAMPLES, 'Modal.rozie.svelte');
    expect(resolveHook('./not-a-rozie-component.svelte', importer)).toBeNull();
  });
});

describe('load hook target="svelte" — Counter.rozie compiles to <script lang="ts">...', () => {
  const ctx = { warn: vi.fn(), error: vi.fn(), addWatchFile: vi.fn() };

  it('returns { code, map } where code starts with <script lang="ts"> for Counter', () => {
    const loadHook = createLoadHook(makeRegistry(), 'svelte');
    const id = resolve(EXAMPLES, 'Counter.rozie.svelte');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(typeof code).toBe('string');
    expect(code.startsWith('<script lang="ts">')).toBe(true);
    // Counter has $bindable for value (model: true), $state for hovering,
    // $derived for canIncrement/canDecrement, no on:click syntax (Pitfall 4).
    expect(code).toContain('$bindable');
    expect(code).toContain('$state');
    expect(code).toContain('$derived');
    expect(code).toContain('onclick=');
    expect(code).not.toMatch(/\son:[a-z]/);
    // DX-03 trust-erosion floor: hello from rozie survives byte-identical.
    expect(code).toContain('console.log("hello from rozie")');
    // Map is the magic-string SourceMap with sources[0] pointing at .rozie.
    expect(map).toBeDefined();
    expect(map.sources[0]).toMatch(/Counter\.rozie$/);
  });

  it('returns null for non-virtual ids (e.g., .rozie.tsx React-side / .rozie.vue Vue-side)', () => {
    const loadHook = createLoadHook(makeRegistry(), 'svelte');
    expect(loadHook.call(ctx as any, '/regular/foo.ts')).toBeNull();
    expect(loadHook.call(ctx as any, '/abs/Counter.rozie.tsx')).toBeNull();
    expect(loadHook.call(ctx as any, '/abs/Counter.rozie.vue')).toBeNull();
  });
});

describe('transform hook target="svelte" — direct pipeline test (DX-01 anchor)', () => {
  const ctx = { warn: vi.fn(), error: vi.fn(), addWatchFile: vi.fn() };

  it('Counter.rozie source produces { code, map } with non-empty mappings', () => {
    const counterSrc = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    const transform = createTransformHook(makeRegistry(), 'svelte');
    const result = transform.call(ctx as any, counterSrc, resolve(EXAMPLES, 'Counter.rozie'));
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(code).toContain('<script lang="ts">');
    expect(map).toBeDefined();
    // DX-01 anchor: source map must have non-empty mappings field for the
    // .rozie source to be reachable in browser DevTools.
    expect(typeof map.mappings).toBe('string');
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it('cross-check: unplugin path produces byte-identical output to packages/targets/svelte/fixtures/Counter.svelte.snap', () => {
    // The unplugin path delegates straight to emitSvelte — output should
    // equal the locked fixture from Plan 05-02a (modulo trailing newline
    // which the snap file may or may not include).
    const counterSrc = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    const transform = createTransformHook(makeRegistry(), 'svelte');
    const result = transform.call(ctx as any, counterSrc, resolve(EXAMPLES, 'Counter.rozie'));
    expect(result).not.toBeNull();
    const { code } = result as { code: string };
    const fixturePath = resolve(SVELTE_FIXTURES, 'Counter.svelte.snap');
    const expected = readFileSync(fixturePath, 'utf8');
    // Normalize trailing whitespace differences (snap files are often
    // newline-terminated by the editor).
    expect(code.trim()).toBe(expected.trim());
  });
});
