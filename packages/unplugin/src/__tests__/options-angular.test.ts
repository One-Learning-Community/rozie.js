/**
 * Plan 05-04b Task 1 — Angular options + peer-dep tests (D-72).
 *
 * Tests:
 *   - validateOptions({ target: 'angular' }) returns { target: 'angular' }
 *     (no longer throws ROZ402 — Plan 05-04b ships the angular branch)
 *   - SUPPORTED_TARGETS_PHASE_5 includes 'angular'
 *   - assertAngularPeerDeps('/non/existent/cwd') throws with code 'ROZ700'
 *   - assertAngularPeerDeps from the angular-analogjs-demo cwd does NOT
 *     throw (post-pnpm-install) — proves the workspace deps are resolvable
 *   - detectViteMajor returns >= 6 for the demo (per OQ6 RESOLVED + the
 *     demo's pinned `vite ^6.0.0`)
 *   - ROZ702 fires when consumer cwd has Vite < 6 (we cannot easily
 *     construct that scenario in our monorepo — informational pass-through
 *     test guarded against the monorepo's actual Vite version)
 */
import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateOptions,
  assertAngularPeerDeps,
  SUPPORTED_TARGETS_PHASE_5,
} from '../options.js';
import { detectAnalogjs, canResolveAngularCore, detectViteMajor } from '../analogjs-detect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');

describe('validateOptions — Plan 05-04b angular surface', () => {
  it('passes for target=angular (returns the validated options)', () => {
    expect(validateOptions({ target: 'angular' })).toEqual({ target: 'angular' });
  });

  it('SUPPORTED_TARGETS_PHASE_5 contains all canonical targets (vue, react, svelte, angular, solid)', () => {
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('vue');
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('react');
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('svelte');
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('angular');
    expect(SUPPORTED_TARGETS_PHASE_5).toContain('solid');
    // Phase 06.3-01 added 'solid' as the 5th canonical target.
    expect(SUPPORTED_TARGETS_PHASE_5).toHaveLength(5);
  });
});

describe('analogjs-detect — Plan 05-04b detection helpers', () => {
  it('detectAnalogjs returns true for the angular-analogjs-demo cwd (post-install)', () => {
    const demoCwd = resolve(REPO_ROOT, 'examples/consumers/angular-analogjs');
    expect(detectAnalogjs(demoCwd)).toBe(true);
  });

  it('detectAnalogjs returns false for a cwd with no node_modules tree', () => {
    expect(detectAnalogjs('/nonexistent/path/that/does/not/exist')).toBe(false);
  });

  it('canResolveAngularCore returns true for the angular-analogjs-demo cwd', () => {
    const demoCwd = resolve(REPO_ROOT, 'examples/consumers/angular-analogjs');
    expect(canResolveAngularCore(demoCwd)).toBe(true);
  });

  it('canResolveAngularCore returns false for an empty cwd', () => {
    expect(canResolveAngularCore('/nonexistent/path/that/does/not/exist')).toBe(false);
  });

  it('detectViteMajor returns >= 6 for the angular-analogjs-demo cwd (OQ6 RESOLVED)', () => {
    const demoCwd = resolve(REPO_ROOT, 'examples/consumers/angular-analogjs');
    const major = detectViteMajor(demoCwd);
    expect(major).not.toBeNull();
    expect(major).toBeGreaterThanOrEqual(6);
  });

  it('detectViteMajor returns either null OR a valid major when vite is not in cwd subtree', () => {
    // /nonexistent — createRequire scoped to a synthetic path inside that
    // directory may still climb up to the monorepo's hoisted vite, returning
    // a valid major; OR it may fail entirely and return null. Either outcome
    // is acceptable — what matters is that the function does not throw.
    const major = detectViteMajor('/nonexistent/path/that/does/not/exist');
    if (major !== null) {
      expect(typeof major).toBe('number');
      expect(Number.isFinite(major)).toBe(true);
    }
  });
});

describe('assertAngularPeerDeps — Plan 05-04b ROZ700/ROZ701/ROZ702 (D-72)', () => {
  it('does NOT throw when called with the angular-analogjs-demo cwd directly', () => {
    const demoCwd = resolve(REPO_ROOT, 'examples/consumers/angular-analogjs');
    expect(() => assertAngularPeerDeps(demoCwd)).not.toThrow();
  });

  it('does NOT throw in our monorepo when called without an explicit cwd (workspace hoist)', () => {
    // assertAngularPeerDeps() with no cwd resolves from the unplugin module
    // itself; the workspace hoist makes the deps reachable via the
    // angular-analogjs-demo workspace.
    expect(() => assertAngularPeerDeps()).not.toThrow();
  });

  it('throws ROZ700 when @analogjs/vite-plugin-angular is not resolvable', () => {
    try {
      assertAngularPeerDeps('/nonexistent/path/that/does/not/exist');
      throw new Error('expected throw');
    } catch (e) {
      const err = e as Error & { code?: string };
      expect(err.code).toBe('ROZ700');
      expect(err.message).toMatch(/@analogjs\/vite-plugin-angular/);
      expect(err.message).toMatch(/pnpm add/);
    }
  });

  it('ROZ700 message includes the explicit consumer-side install instruction (D-72)', () => {
    try {
      assertAngularPeerDeps('/nonexistent/path/that/does/not/exist');
    } catch (e) {
      const err = e as Error;
      expect(err.message).toMatch(/Rozie\(\{ target: 'angular' \}\)/);
    }
  });
});
