/**
 * Phase 36 (R11 / D-1 / REQ-28) — `rozieContext` globalThis-backed singleton (Solid).
 *
 * Identical contract to the React variant: cross-FILE token identity. A
 * provider module and a consumer module are compiled SEPARATELY but must
 * resolve the SAME Solid Context object for a given string key, or
 * `useContext` reads the default and `$inject` returns undefined.
 *
 * The registry MUST be process-global (`globalThis.__rozieCtx ??= new Map()`).
 * A per-module `new Map()` is FORBIDDEN — it would mint a distinct Context per
 * compiled file. These tests pin that invariant down.
 */
import { describe, it, expect } from 'vitest';
import { rozieContext } from '../rozieContext.js';

describe('rozieContext (globalThis-backed Solid context registry)', () => {
  it('returns the IDENTICAL Context reference for the same key', () => {
    expect(rozieContext('theme')).toBe(rozieContext('theme'));
  });

  it('returns DISTINCT Context references for different keys', () => {
    expect(rozieContext('theme')).not.toBe(rozieContext('locale'));
  });

  it('is backed by globalThis.__rozieCtx (not a module-local Map)', () => {
    rozieContext('theme');
    const registry = (globalThis as Record<string, unknown>).__rozieCtx as
      | Map<string, unknown>
      | undefined;
    expect(registry).toBeInstanceOf(Map);
    expect(registry?.get('theme')).toBe(rozieContext('theme'));
  });

  it('simulates two separately-compiled modules resolving the same token', () => {
    const fromProviderModule = rozieContext('theme');
    const fromConsumerModule = rozieContext('theme');
    expect(fromProviderModule).toBe(fromConsumerModule);
  });
});
