/**
 * Plan 06.4-01 Task 3 — Lit options + peer-dep tests.
 *
 * Tests:
 *   - validateOptions({ target: 'lit' }) returns { target: 'lit' }
 *   - assertLitPeerDeps throws ROZ830 when `lit` not resolvable
 *   - assertLitPeerDeps throws ROZ831 when `@lit-labs/preact-signals`
 *     not resolvable
 */
import { describe, it, expect, vi } from 'vitest';
import { validateOptions } from '../options.js';

describe('validateOptions — target: lit', () => {
  it('accepts target: lit', () => {
    expect(() => validateOptions({ target: 'lit' })).not.toThrow();
    expect(validateOptions({ target: 'lit' })).toEqual({ target: 'lit' });
  });
});

describe('assertLitPeerDeps', () => {
  it('throws ROZ830 when `lit` is not resolvable', async () => {
    vi.resetModules();
    vi.doMock('../lit-detect.js', () => ({
      canResolveLit: () => false,
      canResolvePreactSignals: () => true,
    }));
    const { assertLitPeerDeps: assert } = await import('../options.js');
    expect(() => assert('/tmp')).toThrowError(/\[ROZ830\]/);
    expect(() => assert('/tmp')).toThrowError(/'lit'/);
    vi.doUnmock('../lit-detect.js');
  });

  it('throws ROZ831 when `@lit-labs/preact-signals` is not resolvable', async () => {
    vi.resetModules();
    vi.doMock('../lit-detect.js', () => ({
      canResolveLit: () => true,
      canResolvePreactSignals: () => false,
    }));
    const { assertLitPeerDeps: assert } = await import('../options.js');
    expect(() => assert('/tmp')).toThrowError(/\[ROZ831\]/);
    expect(() => assert('/tmp')).toThrowError(/@lit-labs\/preact-signals/);
    vi.doUnmock('../lit-detect.js');
  });
});
