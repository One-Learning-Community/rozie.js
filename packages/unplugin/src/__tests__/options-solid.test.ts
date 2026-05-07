/**
 * Plan 06.3-01 Task 3 — Solid options + peer-dep tests.
 *
 * Tests:
 *   - validateOptions({ target: 'solid' }) returns { target: 'solid' }
 *   - assertSolidPeerDeps throws ROZ810 when vite-plugin-solid not resolvable
 *   - assertSolidPeerDeps throws ROZ811 when solid-js not resolvable
 */
import { describe, it, expect, vi } from 'vitest';
import { validateOptions } from '../options.js';

describe('validateOptions — target: solid', () => {
  it('accepts target: solid', () => {
    expect(() => validateOptions({ target: 'solid' })).not.toThrow();
    expect(validateOptions({ target: 'solid' })).toEqual({ target: 'solid' });
  });
});

describe('assertSolidPeerDeps', () => {
  it('throws ROZ810 when vite-plugin-solid is not resolvable', async () => {
    vi.resetModules();
    vi.doMock('../solid-detect.js', () => ({
      detectSolidPlugin: () => false,
      canResolveSolidJs: () => true,
    }));
    const { assertSolidPeerDeps: assert } = await import('../options.js');
    expect(() => assert('/tmp')).toThrowError(/\[ROZ810\]/);
    expect(() => assert('/tmp')).toThrowError(/vite-plugin-solid/);
    vi.doUnmock('../solid-detect.js');
  });

  it('throws ROZ811 when solid-js is not resolvable', async () => {
    vi.resetModules();
    vi.doMock('../solid-detect.js', () => ({
      detectSolidPlugin: () => true,
      canResolveSolidJs: () => false,
    }));
    const { assertSolidPeerDeps: assert } = await import('../options.js');
    expect(() => assert('/tmp')).toThrowError(/\[ROZ811\]/);
    expect(() => assert('/tmp')).toThrowError(/solid-js/);
    vi.doUnmock('../solid-detect.js');
  });
});
