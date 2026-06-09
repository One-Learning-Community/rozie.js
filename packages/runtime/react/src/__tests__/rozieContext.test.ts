/**
 * Phase 36 (R11 / D-1 / REQ-28) — `rozieContext` globalThis-backed singleton.
 *
 * The whole point of the registry is cross-FILE token identity: a provider
 * module and a consumer module are compiled SEPARATELY, yet must resolve the
 * SAME React Context object for a given string key — otherwise `useContext`
 * reads the wrong (default) context and `$inject` returns undefined.
 *
 * The only way to share an identity-based token across separately-compiled
 * modules is a PROCESS-GLOBAL registry: `globalThis.__rozieCtx ??= new Map()`.
 * A per-module `new Map()` is FORBIDDEN — it would mint a distinct Context per
 * compiled file. These tests pin that invariant down.
 */
import { describe, it, expect } from 'vitest';
import { rozieContext } from '../rozieContext.js';

describe('rozieContext (globalThis-backed React context registry)', () => {
  it('returns the IDENTICAL Context reference for the same key', () => {
    expect(rozieContext('theme')).toBe(rozieContext('theme'));
  });

  it('returns DISTINCT Context references for different keys', () => {
    expect(rozieContext('theme')).not.toBe(rozieContext('locale'));
  });

  it('is backed by globalThis.__rozieCtx (not a module-local Map)', () => {
    // Calling rozieContext must populate the process-global registry, so a
    // separately-compiled module reaching globalThis.__rozieCtx finds the
    // same entry — this is the cross-file-identity contract.
    rozieContext('theme');
    const registry = (globalThis as Record<string, unknown>).__rozieCtx as
      | Map<string, unknown>
      | undefined;
    expect(registry).toBeInstanceOf(Map);
    expect(registry?.get('theme')).toBe(rozieContext('theme'));
  });

  it('simulates two separately-compiled modules resolving the same token', () => {
    // The "provider" file and the "consumer" file both call rozieContext('theme');
    // the dedup MUST resolve them to one and the same Context object.
    const fromProviderModule = rozieContext('theme');
    const fromConsumerModule = rozieContext('theme');
    expect(fromProviderModule).toBe(fromConsumerModule);
  });
});
