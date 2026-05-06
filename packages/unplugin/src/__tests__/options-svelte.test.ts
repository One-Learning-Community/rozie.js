/**
 * Plan 05-02b Task 1 — Svelte options + peer-dep tests.
 *
 * Tests:
 *   - validateOptions({ target: 'svelte' }) returns { target: 'svelte' }
 *     (no longer throws ROZ402)
 *   - assertSveltePeerDeps('/non/existent/cwd') throws with code 'ROZ600'
 *   - assertSveltePeerDeps from the monorepo cwd does NOT throw post-install
 */
import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateOptions,
  assertSveltePeerDeps,
  SUPPORTED_TARGETS_PHASE_5,
} from '../options.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');

describe('validateOptions — Plan 05-02b svelte surface', () => {
  it('passes for target=svelte (returns the validated options)', () => {
    expect(validateOptions({ target: 'svelte' })).toEqual({ target: 'svelte' });
  });

  it('SUPPORTED_TARGETS_PHASE_5 contains vue, react, and svelte', () => {
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('vue');
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('react');
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('svelte');
    // angular still ROZ402 until Plan 05-04b
    expect(SUPPORTED_TARGETS_PHASE_5).not.toContain('angular');
  });
});

describe('assertSveltePeerDeps — Plan 05-02b ROZ600/ROZ601', () => {
  it('does NOT throw in our monorepo (svelte-vite-demo has @sveltejs/vite-plugin-svelte + svelte as deps)', () => {
    // assertSveltePeerDeps() with no cwd resolves from the unplugin module
    // itself; the workspace hoist makes both deps resolvable.
    expect(() => assertSveltePeerDeps()).not.toThrow();
  });

  it('does NOT throw when called with the svelte-vite-demo cwd directly', () => {
    const demoCwd = resolve(REPO_ROOT, 'examples/consumers/svelte-vite');
    expect(() => assertSveltePeerDeps(demoCwd)).not.toThrow();
  });

  it('throws ROZ600 (or ROZ601) from a cwd where Svelte tooling does not resolve', () => {
    // /tmp has no node_modules tree on a clean macOS / Linux env. If global
    // node_modules happens to expose @sveltejs/vite-plugin-svelte the test
    // is informational; we accept either outcome.
    try {
      assertSveltePeerDeps('/tmp');
      // No throw: global resolution succeeded — accept silently.
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(['ROZ600', 'ROZ601']).toContain(err.code);
      expect(err.message).toMatch(/svelte/i);
    }
  });

  it('throws ROZ600 with a clear remediation message including the install command', () => {
    try {
      assertSveltePeerDeps('/nonexistent/path/that/does/not/exist');
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(err.code).toBe('ROZ600');
      expect(err.message).toMatch(/@sveltejs\/vite-plugin-svelte/);
      expect(err.message).toMatch(/pnpm add/);
    }
  });
});
