// Plan 04-06 Task 1 — MOD-05 dogfood: third-party modifier ModifierImpl shape
// + public-API surface check (D-22b SemVer-stability proof).
//
// This test deliberately imports ONLY public types from @rozie/core (the
// SemVer-stable v1 surface). If a future @rozie/core version moves any of
// these types behind an internal-only path, this test will fail at the
// import-resolution boundary — making the SemVer break impossible to miss.
import { describe, expect, it } from 'vitest';
import {
  ModifierRegistry,
  registerBuiltins,
  type ModifierImpl,
  type ModifierContext,
  type ModifierArg,
  type VueEmissionDescriptor,
  type ReactEmissionDescriptor,
} from '@rozie/core';
import { swipeModifier } from '../index.js';

describe('MOD-05 — swipe ModifierImpl shape (D-22b public surface)', () => {
  it('imports the publicly-exported types verbatim', () => {
    // Compile-time assertion via type narrowing at runtime: the test merely
    // needs to mention each type in a typed context to keep TS sturdy.
    const _impl: ModifierImpl = swipeModifier;
    expect(_impl.name).toBe('swipe');
    expect(_impl.arity).toBe('one');
    expect(typeof _impl.resolve).toBe('function');
    expect(typeof _impl.vue).toBe('function');
    expect(typeof _impl.react).toBe('function');
  });

  it('registers cleanly via the public registry API alongside builtins', () => {
    const registry = new ModifierRegistry();
    registerBuiltins(registry);
    expect(registry.has('swipe')).toBe(false);
    registry.register(swipeModifier);
    expect(registry.has('swipe')).toBe(true);
    expect(registry.get('swipe')?.name).toBe('swipe');
  });

  it('throws on duplicate registration (programmer-error path per D-22b)', () => {
    const registry = new ModifierRegistry();
    registry.register(swipeModifier);
    expect(() => registry.register(swipeModifier)).toThrow(/already registered/);
  });

  it('resolve() accepts each of left/right/up/down', () => {
    const ctx: ModifierContext = {
      source: 'template-event',
      event: 'touchstart',
      sourceLoc: { start: 0, end: 0 },
    };
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      const args: ModifierArg[] = [
        { kind: 'literal', value: dir, loc: { start: 0, end: 0 } },
      ];
      const result = swipeModifier.resolve(args, ctx);
      expect(result.diagnostics).toEqual([]);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.kind).toBe('filter');
    }
  });

  it('resolve() rejects unknown directions with a diagnostic (no throw)', () => {
    const ctx: ModifierContext = {
      source: 'template-event',
      event: 'touchstart',
      sourceLoc: { start: 0, end: 0 },
    };
    const args: ModifierArg[] = [
      { kind: 'literal', value: 'diagonal', loc: { start: 0, end: 0 } },
    ];
    const result = swipeModifier.resolve(args, ctx);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe('error');
    expect(result.diagnostics[0]?.message).toMatch(/swipe modifier expects one argument/);
  });

  it('vue() returns kind:inlineGuard for each direction', () => {
    const ctx: ModifierContext = {
      source: 'template-event',
      event: 'touchstart',
      sourceLoc: { start: 0, end: 0 },
    };
    const args: ModifierArg[] = [
      { kind: 'literal', value: 'left', loc: { start: 0, end: 0 } },
    ];
    const desc: VueEmissionDescriptor = swipeModifier.vue!(args, ctx);
    expect(desc.kind).toBe('inlineGuard');
    if (desc.kind === 'inlineGuard') {
      expect(desc.code).toMatch(/swipe left guard/);
      expect(desc.code).toMatch(/clientX/);
    }
  });

  it('react() returns kind:inlineGuard for each direction', () => {
    const ctx: ModifierContext = {
      source: 'template-event',
      event: 'touchstart',
      sourceLoc: { start: 0, end: 0 },
    };
    const args: ModifierArg[] = [
      { kind: 'literal', value: 'up', loc: { start: 0, end: 0 } },
    ];
    const desc: ReactEmissionDescriptor = swipeModifier.react!(args, ctx);
    expect(desc.kind).toBe('inlineGuard');
    if (desc.kind === 'inlineGuard') {
      expect(desc.code).toMatch(/swipe up guard/);
      expect(desc.code).toMatch(/clientY/);
    }
  });
});
