// Phase 3 Plan 06 Task 2 — options validation tests.
//
// Tests 1-3 from plan §<behavior>:
//   - .vite called without target → ROZ400
//   - .vite called with target='preact' (unknown) → ROZ401
//   - .vite called with target='react'/'svelte'/'angular' → ROZ402
//   - .vite called with target='vue' → returns a Vite plugin object (name + enforce: 'pre')
//
// Validation happens inside the factory `createUnplugin` is called with —
// validateOptions throws synchronously when .vite (or .rollup, etc.) is
// invoked at consumer-side `Rozie({ target: ... })`.
import { describe, it, expect } from 'vitest';
import { validateOptions } from '../options.js';
import { unplugin } from '../index.js';

describe('validateOptions — D-49 / ROZ400+', () => {
  it('throws ROZ400 when target is missing', () => {
    expect(() => validateOptions(undefined)).toThrowError(/ROZ400/);
    expect(() => validateOptions({})).toThrowError(/ROZ400/);
    try {
      validateOptions({});
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(err.code).toBe('ROZ400');
      expect(err.message).toMatch(/target/i);
    }
  });

  it('throws ROZ401 for an unknown target value', () => {
    try {
      validateOptions({ target: 'preact' as unknown as 'vue' });
      throw new Error('expected throw');
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(err.code).toBe('ROZ401');
      expect(err.message).toMatch(/preact/);
    }
  });

  it('throws ROZ402 when target is react / svelte / angular (Phase 3 ships vue only)', () => {
    for (const target of ['react', 'svelte', 'angular'] as const) {
      try {
        validateOptions({ target });
        throw new Error('expected throw for ' + target);
      } catch (e) {
        const err = e as Error & { code?: string };
        expect(err.code).toBe('ROZ402');
        expect(err.message).toMatch(/Phase 3|not yet/i);
        expect(err.message).toContain(target);
      }
    }
  });

  it('passes for target=vue (returns the validated options)', () => {
    expect(validateOptions({ target: 'vue' })).toEqual({ target: 'vue' });
  });
});

describe('unplugin entry — .vite shape (factory wires validateOptions)', () => {
  it('throws ROZ400 when .vite called without target', () => {
    expect(() => unplugin.vite({} as any)).toThrowError(/ROZ400/);
  });

  it('throws ROZ402 when .vite called with target=react', () => {
    try {
      unplugin.vite({ target: 'react' as 'vue' });
      throw new Error('expected throw');
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(err.code).toBe('ROZ402');
    }
  });

  it('returns a Vite plugin object for target=vue with name=rozie + enforce=pre', () => {
    const plugin = unplugin.vite({ target: 'vue' });
    // unplugin.vite returns either a single plugin or an array; when our
    // factory returns a single rawPlugin, the .vite caller wraps it as a
    // single Rollup-shape plugin (Vite uses Rollup's shape internally).
    const p = Array.isArray(plugin) ? plugin[0] : plugin;
    expect(p).toBeDefined();
    expect((p as any).name).toBe('rozie');
    expect((p as any).enforce).toBe('pre');
  });
});
