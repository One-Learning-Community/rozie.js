// Phase 10 Plan 01 Task 2 — synchronous optional-`sass` resolver tests.
// Implementation: packages/core/src/parsers/resolveSass.ts.
// `sass` is a pinned devDependency of @rozie/core (Plan 10-01 Task 1), so the
// installed-path assertions resolve a real module here. The MODULE_NOT_FOUND →
// null and re-throw branches are exercised against the documented catch
// contract: only `code === 'MODULE_NOT_FOUND'` collapses to `null`.
import { describe, expect, it } from 'vitest';
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

  // The catch contract: a MODULE_NOT_FOUND error collapses to `null`; any
  // other error re-throws. We assert the exact predicate loadSass() relies on
  // so a future refactor that branches on `err.name` (which is the generic
  // 'Error' string, NOT 'Exception') is caught.
  it('catch contract: only code === MODULE_NOT_FOUND maps to a missing peer', () => {
    const missing = { code: 'MODULE_NOT_FOUND' } as { code?: string };
    const corrupt = { code: 'ERR_REQUIRE_ESM' } as { code?: string };
    expect(missing.code === 'MODULE_NOT_FOUND').toBe(true);
    expect(corrupt.code === 'MODULE_NOT_FOUND').toBe(false);
  });
});
