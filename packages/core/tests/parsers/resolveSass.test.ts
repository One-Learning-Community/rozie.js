// Phase 10 Plan 01 Task 2 — synchronous optional-`sass` resolver tests.
// Implementation: packages/core/src/parsers/resolveSass.ts.
// `sass` is a pinned devDependency of @rozie/core (Plan 10-01 Task 1), so the
// installed-path assertions resolve a real module here. The MODULE_NOT_FOUND →
// null and re-throw branches are exercised by mocking `node:module`'s
// `createRequire` so the `require('sass')` call throws a controlled error —
// mirroring how `parseStyle.scss.test.ts` mocks `resolveSass.js` for ROZ085.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSass } from '../../src/parsers/resolveSass.js';
import type { SassModule } from '../../src/parsers/resolveSass.js';

describe('resolveSass — loadSass()', () => {
  it('returns the sass module object when sass is installed', () => {
    const mod = loadSass();
    expect(mod).not.toBeNull();
  });

  it('the resolved module exposes a compileString function', () => {
    const mod = loadSass();
    expect(typeof mod?.compileString).toBe('function');
  });

  it('the resolved module compiles SCSS to plain CSS deterministically', () => {
    const mod = loadSass() as SassModule;
    const { css } = mod.compileString('$c: red; .a { color: $c; .b { color: $c; } }', {
      style: 'expanded',
      charset: false,
      sourceMap: false,
    });
    // Nesting flattened, $var resolved, no @charset / BOM (charset:false).
    expect(css).toContain('.a {');
    expect(css).toContain('.a .b {');
    expect(css).toContain('color: red;');
    expect(css.startsWith('@charset')).toBe(false);
    expect(css.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('the resolved module exposes Exception and Logger.silent', () => {
    const mod = loadSass() as SassModule;
    expect(typeof mod.Exception).toBe('function');
    expect(mod.Logger.silent).toBeDefined();
  });
});

// The catch contract is exercised against the REAL loadSass() by mocking
// `node:module` so the `createRequire(import.meta.url)` call inside
// resolveSass.ts hands back a `require` whose `require('sass')` throws a
// controlled error. This genuinely walks loadSass()'s catch branch — a future
// refactor that deletes or inverts it (e.g. branches on `err.name`, which is
// the generic 'Error' string, NOT 'Exception') is caught.
describe('resolveSass — loadSass() catch contract (mocked require)', () => {
  afterEach(() => {
    vi.doUnmock('node:module');
    vi.resetModules();
  });

  // Build a `require`-like function that throws `err` for `require('sass')`.
  // `require.resolve` is attached because dart-sass-shaped optional-dep idioms
  // sometimes touch it; here only the call form is used.
  function failingRequire(err: unknown): unknown {
    const fn = (() => {
      throw err;
    }) as unknown as { resolve: () => string };
    fn.resolve = () => {
      throw err;
    };
    return fn;
  }

  it('MODULE_NOT_FOUND from require(\'sass\') collapses to null (optional peer absent)', async () => {
    vi.resetModules();
    const moduleNotFound = Object.assign(new Error("Cannot find module 'sass'"), {
      code: 'MODULE_NOT_FOUND',
    });
    vi.doMock('node:module', () => ({
      createRequire: () => failingRequire(moduleNotFound),
    }));
    const { loadSass: loadSassMocked } = await import('../../src/parsers/resolveSass.js');
    expect(loadSassMocked()).toBeNull();
  });

  it('a non-MODULE_NOT_FOUND error from require(\'sass\') is re-thrown (corrupt installed peer)', async () => {
    vi.resetModules();
    const corrupt = Object.assign(new Error('Unexpected token in sass entrypoint'), {
      code: 'ERR_REQUIRE_ESM',
    });
    vi.doMock('node:module', () => ({
      createRequire: () => failingRequire(corrupt),
    }));
    const { loadSass: loadSassMocked } = await import('../../src/parsers/resolveSass.js');
    expect(() => loadSassMocked()).toThrow('Unexpected token in sass entrypoint');
  });

  it('a thrown error with no `code` at all is re-thrown, not collapsed to null', async () => {
    vi.resetModules();
    const noCode = new Error('opaque load failure');
    vi.doMock('node:module', () => ({
      createRequire: () => failingRequire(noCode),
    }));
    const { loadSass: loadSassMocked } = await import('../../src/parsers/resolveSass.js');
    expect(() => loadSassMocked()).toThrow('opaque load failure');
  });
});
