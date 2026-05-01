// Phase 2 Plan 02-04 Task 1: ModifierRegistry + registerModifier public API.
//
// MOD-02 modifier registry: ModifierRegistry class (D-22b SemVer-stable surface) +
// registerModifier helper (third-party plugin pattern). Task 2 lands registerBuiltins
// + the 25 builtin impls + the registry-builtins.snap snapshot.
//
// Per D-22 (NO module-import side effects): importing ModifierRegistry must NOT
// register any builtins; a fresh registry is empty.
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ModifierRegistry,
  type ModifierContext,
  type ModifierImpl,
  type ModifierPipelineEntry,
} from '../../src/modifiers/ModifierRegistry.js';
import { registerModifier } from '../../src/modifiers/registerModifier.js';
import {
  registerBuiltins,
  createDefaultRegistry,
} from '../../src/modifiers/registerBuiltins.js';
// Side-effect-free imports — these MUST NOT register anything at module load.
import { outside } from '../../src/modifiers/builtins/outside.js';
import { debounce } from '../../src/modifiers/builtins/debounce.js';
import { passive } from '../../src/modifiers/builtins/passive.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ZERO_LOC = { start: 0, end: 0 } as const;
const STUB_CTX: ModifierContext = {
  source: 'template-event',
  event: 'click',
  sourceLoc: ZERO_LOC,
};

function makeStubImpl(name: string, arity: ModifierImpl['arity'] = 'none'): ModifierImpl {
  return {
    name,
    arity,
    resolve: () => ({ entries: [], diagnostics: [] }),
  };
}

describe('ModifierRegistry — Plan 02-04 Task 1', () => {
  it('new ModifierRegistry().has("outside") === false (empty registry per D-22 — module-import side-effect-free)', () => {
    const reg = new ModifierRegistry();
    expect(reg.has('outside')).toBe(false);
    expect(reg.list().length).toBe(0);
  });

  it('register(impl) succeeds and has(name) reports true afterwards', () => {
    const reg = new ModifierRegistry();
    reg.register(makeStubImpl('foo'));
    expect(reg.has('foo')).toBe(true);
    expect(reg.get('foo')).toBeDefined();
    expect(reg.get('foo')?.name).toBe('foo');
  });

  it('register(impl) THROWS on duplicate name (conflict detection — programmer-error path per Phase 1 invariant)', () => {
    const reg = new ModifierRegistry();
    reg.register(makeStubImpl('foo'));
    expect(() => reg.register(makeStubImpl('foo'))).toThrow(/already registered/i);
  });

  it('list() returns a deterministic (sorted) array of registered names', () => {
    const reg = new ModifierRegistry();
    reg.register(makeStubImpl('z'));
    reg.register(makeStubImpl('a'));
    reg.register(makeStubImpl('m'));
    expect(reg.list()).toEqual(['a', 'm', 'z']);
  });

  it('get(nonexistent) returns undefined (does not throw)', () => {
    const reg = new ModifierRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('registerModifier(reg, name, impl) public helper — D-22b SemVer-stable signature', () => {
    const reg = new ModifierRegistry();
    registerModifier(reg, 'swipe', {
      arity: 'one',
      resolve: () => ({ entries: [], diagnostics: [] }),
    });
    expect(reg.has('swipe')).toBe(true);
    expect(reg.get('swipe')?.name).toBe('swipe');
    expect(reg.get('swipe')?.arity).toBe('one');
  });

  it('ModifierImpl.resolve() return shape: { entries, diagnostics } (type-guard contract)', () => {
    const impl = makeStubImpl('foo');
    const result = impl.resolve([], STUB_CTX);
    expect('entries' in result).toBe(true);
    expect('diagnostics' in result).toBe(true);
    expect(Array.isArray(result.entries)).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('ModifierPipelineEntry discriminated union: listenerOption / wrap / filter assignable', () => {
    const ok1: ModifierPipelineEntry = {
      kind: 'listenerOption',
      option: 'capture',
      sourceLoc: ZERO_LOC,
    };
    const ok2: ModifierPipelineEntry = {
      kind: 'wrap',
      modifier: 'outside',
      args: [],
      sourceLoc: ZERO_LOC,
    };
    const ok3: ModifierPipelineEntry = {
      kind: 'filter',
      modifier: 'stop',
      args: [],
      sourceLoc: ZERO_LOC,
    };
    expect(ok1.kind).toBe('listenerOption');
    expect(ok2.kind).toBe('wrap');
    expect(ok3.kind).toBe('filter');

    // @ts-expect-error invalid kind — compile-time discriminator narrowing
    const bad: ModifierPipelineEntry = { kind: 'invalid' };
    void bad;
  });

  it('SemVer-stability JSDoc present in source (D-22b documentation)', () => {
    const src = fs.readFileSync(
      resolve(__dirname, '../../src/modifiers/ModifierRegistry.ts'),
      'utf8',
    );
    expect(src).toMatch(/@public.*SemVer-stable/);
  });

  it('D-22 module-import side-effect-free: importing ModifierRegistry does not register any builtins', () => {
    // Re-import in the same module is cached — but we can construct fresh instances.
    // The key behavior: NO module-scope register(...) calls anywhere have run.
    const reg1 = new ModifierRegistry();
    const reg2 = new ModifierRegistry();
    expect(reg1.has('outside')).toBe(false);
    expect(reg2.has('outside')).toBe(false);
    expect(reg1.list().length).toBe(0);
    expect(reg2.list().length).toBe(0);
  });
});

describe('registerBuiltins / createDefaultRegistry — Plan 02-04 Task 2', () => {
  it('registerBuiltins(reg) populates 23 default modifiers (9 composition + 14 key/button filters)', () => {
    const reg = new ModifierRegistry();
    registerBuiltins(reg);
    // 9 composition modifiers
    for (const name of [
      'outside',
      'self',
      'stop',
      'prevent',
      'once',
      'capture',
      'passive',
      'debounce',
      'throttle',
    ]) {
      expect(reg.has(name), `${name} should be registered`).toBe(true);
    }
    // 14 key/button filters
    for (const name of [
      'escape',
      'enter',
      'tab',
      'delete',
      'space',
      'up',
      'down',
      'left',
      'right',
      'home',
      'end',
      'pageUp',
      'pageDown',
      'middle',
    ]) {
      expect(reg.has(name), `${name} key/button filter should be registered`).toBe(true);
    }
    expect(reg.list().length).toBe(23);
  });

  it('createDefaultRegistry() returns a fresh registry pre-populated with builtins', () => {
    const reg = createDefaultRegistry();
    expect(reg.has('outside')).toBe(true);
    expect(reg.has('escape')).toBe(true);
    expect(reg.list().length).toBe(23);
  });

  it('createDefaultRegistry() called twice returns INDEPENDENT registries (no shared state)', () => {
    const a = createDefaultRegistry();
    const b = createDefaultRegistry();
    // Mutate one; the other must be unaffected.
    registerModifier(a, 'thirdParty', {
      arity: 'none',
      resolve: () => ({ entries: [], diagnostics: [] }),
    });
    expect(a.has('thirdParty')).toBe(true);
    expect(b.has('thirdParty')).toBe(false);
  });

  it('re-running registerBuiltins on a populated registry THROWS (intentional — duplicate detection)', () => {
    const reg = createDefaultRegistry();
    expect(() => registerBuiltins(reg)).toThrow(/already registered/i);
  });

  it('Snapshot: createDefaultRegistry() output locked to fixtures/modifiers/registry-builtins.snap', async () => {
    const reg = createDefaultRegistry();
    const summary = reg.list().map((name) => {
      const impl = reg.get(name);
      if (!impl) throw new Error(`unreachable: ${name} listed but not retrievable`);
      return { name, arity: impl.arity };
    });
    await expect(JSON.stringify(summary, null, 2)).toMatchFileSnapshot(
      resolve(__dirname, '../../fixtures/modifiers/registry-builtins.snap'),
    );
  });

  it('D-22 imported builtin files do NOT register at module-load time', () => {
    // The mere fact that these imports succeeded at the top of the file and
    // a fresh registry is empty proves the contract.
    expect(outside.name).toBe('outside');
    expect(debounce.name).toBe('debounce');
    expect(passive.name).toBe('passive');
    const reg = new ModifierRegistry();
    expect(reg.has('outside')).toBe(false);
    expect(reg.has('debounce')).toBe(false);
    expect(reg.has('passive')).toBe(false);
    expect(reg.list().length).toBe(0);
  });

  it('D-22b SemVer-stable JSDoc present in registerBuiltins source', () => {
    const src = fs.readFileSync(
      resolve(__dirname, '../../src/modifiers/registerBuiltins.ts'),
      'utf8',
    );
    expect(src).toMatch(/@public.*SemVer-stable/);
    expect(src).toMatch(/createDefaultRegistry/);
    expect(src).toMatch(/registerBuiltins/);
  });
});
