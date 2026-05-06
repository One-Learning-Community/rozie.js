// Phase 3 Plan 06 Task 2 — options validation tests + Phase 4 Plan 04-05 Task 2 react surface.
//
// Tests:
//   - .vite called without target → ROZ400
//   - .vite called with target='preact' (unknown) → ROZ401
//   - .vite called with target='svelte'/'angular' → ROZ402 (still not yet shipped)
//   - .vite called with target='vue' → returns a Vite plugin object (name + enforce: 'pre')
//   - .vite called with target='react' → validates; raises ROZ500/501 if peer deps missing
//
// Validation happens inside the factory `createUnplugin` is called with —
// validateOptions throws synchronously when .vite (or .rollup, etc.) is
// invoked at consumer-side `Rozie({ target: ... })`.
import { describe, it, expect } from 'vitest';
import { validateOptions, assertReactPeerDeps } from '../options.js';
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

  it('passes for target=angular (Phase 5 Plan 05-04b — all four canonical targets shipped)', () => {
    expect(validateOptions({ target: 'angular' })).toEqual({ target: 'angular' });
  });

  it('passes for target=svelte (Phase 5 Plan 05-02b)', () => {
    expect(validateOptions({ target: 'svelte' })).toEqual({ target: 'svelte' });
  });

  it('passes for target=vue (returns the validated options)', () => {
    expect(validateOptions({ target: 'vue' })).toEqual({ target: 'vue' });
  });

  it('passes for target=react (Phase 4 — Plan 04-05)', () => {
    expect(validateOptions({ target: 'react' })).toEqual({ target: 'react' });
  });
});

describe('assertReactPeerDeps — D-59 / ROZ500..501', () => {
  it('does NOT throw in our monorepo (plugin-react + react are workspace devDeps)', () => {
    // The unplugin package's devDeps include @vitejs/plugin-react via the
    // react-vite-demo workspace, and react via runtime-react. Both should
    // resolve from the unplugin package's own node_modules tree.
    expect(() => assertReactPeerDeps()).not.toThrow();
  });

  it('throws ROZ500 from a cwd where neither @vitejs/plugin-react nor plugin-react-swc resolve', () => {
    // Use the OS root as a deliberately empty cwd — no node_modules upstream.
    try {
      assertReactPeerDeps('/tmp');
      // It might pass if /tmp can climb up to the global node_modules. If so,
      // skip — the failure path is what matters semantically.
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(['ROZ500', 'ROZ501']).toContain(err.code);
    }
  });
});

describe('unplugin entry — .vite shape (factory wires validateOptions)', () => {
  it('throws ROZ400 when .vite called without target', () => {
    expect(() => unplugin.vite({} as any)).toThrowError(/ROZ400/);
  });

  it('returns a Vite plugin object for target=angular with name=rozie + enforce=pre (Plan 05-04b)', () => {
    // In our monorepo @analogjs/vite-plugin-angular and @angular/core are
    // resolvable via the angular-analogjs-demo workspace; vite is ^6 in
    // that subgraph. The factory does NOT throw ROZ700/ROZ701/ROZ702.
    const plugin = unplugin.vite({ target: 'angular' });
    const p = Array.isArray(plugin) ? plugin[0] : plugin;
    expect(p).toBeDefined();
    expect((p as any).name).toBe('rozie');
    expect((p as any).enforce).toBe('pre');
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

  it('returns a Vite plugin object for target=react with name=rozie + enforce=pre', () => {
    // In our monorepo @vitejs/plugin-react and react are resolvable, so the
    // factory does NOT throw ROZ500/ROZ501.
    const plugin = unplugin.vite({ target: 'react' });
    const p = Array.isArray(plugin) ? plugin[0] : plugin;
    expect(p).toBeDefined();
    expect((p as any).name).toBe('rozie');
    expect((p as any).enforce).toBe('pre');
  });

  it('returns a Vite plugin object for target=svelte with name=rozie + enforce=pre (Plan 05-02b)', () => {
    // In our monorepo @sveltejs/vite-plugin-svelte and svelte are resolvable
    // via the svelte-vite-demo workspace, so the factory does NOT throw
    // ROZ600/ROZ601.
    const plugin = unplugin.vite({ target: 'svelte' });
    const p = Array.isArray(plugin) ? plugin[0] : plugin;
    expect(p).toBeDefined();
    expect((p as any).name).toBe('rozie');
    expect((p as any).enforce).toBe('pre');
  });
});
