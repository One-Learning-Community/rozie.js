// Phase 12 dogfood: the `.phone` custom MODEL modifier — shape / public-API
// surface check (Requirement 7/8 — SemVer-stability proof).
//
// This test deliberately imports ONLY public types from @rozie/core (the
// SemVer-stable v1 surface). If a future @rozie/core version moves any of
// these types behind an internal-only path, this test fails at the
// import-resolution boundary — making the SemVer break impossible to miss.
import { describe, expect, it } from 'vitest';
import {
  ModifierRegistry,
  registerBuiltins,
  type ModelModifierImpl,
  type ModelModifierDescriptor,
  type ModifierContext,
  type ModifierArg,
} from '@rozie/core';
import { phoneModifier } from '../index.js';

describe('Phase 12 — phone ModelModifierImpl shape (public surface)', () => {
  it('imports the publicly-exported model-modifier types verbatim', () => {
    // Compile-time assertion via type narrowing at runtime: the test merely
    // needs to mention each type in a typed context to keep TS sturdy.
    const _impl: ModelModifierImpl = phoneModifier;
    expect(_impl.kind).toBe('model');
    expect(_impl.name).toBe('phone');
    expect(_impl.arity).toBe('none');
    expect(typeof _impl.resolve).toBe('function');
  });

  it('resolve() returns a descriptor (NOT entries) carrying a valueTransform', () => {
    const ctx: ModifierContext = {
      source: 'template-event',
      event: 'input',
      sourceLoc: { start: 0, end: 0 },
    };
    const result = phoneModifier.resolve([], ctx);
    expect(result.diagnostics).toEqual([]);
    // Model modifiers return `{ descriptor, diagnostics }` — never `entries`.
    expect(result).not.toHaveProperty('entries');
    const descriptor: ModelModifierDescriptor = result.descriptor;
    expect(typeof descriptor.valueTransform).toBe('string');
    // The `$v` placeholder must be present — every emitter substitutes it.
    expect(descriptor.valueTransform).toContain('$v');
    // `.phone` is a pure value transform — no event swap.
    expect(descriptor.eventSwap).toBeUndefined();
  });

  it('registers cleanly via the public registry API alongside builtins', () => {
    const registry = new ModifierRegistry();
    registerBuiltins(registry);
    expect(registry.has('phone')).toBe(false);
    registry.register(phoneModifier);
    expect(registry.has('phone')).toBe(true);
    expect(registry.get('phone')?.name).toBe('phone');
  });

  it('throws on duplicate registration (programmer-error path per D-05)', () => {
    const registry = new ModifierRegistry();
    registry.register(phoneModifier);
    expect(() => registry.register(phoneModifier)).toThrow(/already registered/);
  });

  it('resolve() rejects arguments with a collected diagnostic (no throw)', () => {
    const ctx: ModifierContext = {
      source: 'template-event',
      event: 'input',
      sourceLoc: { start: 0, end: 0 },
    };
    const args: ModifierArg[] = [
      { kind: 'literal', value: 'us', loc: { start: 0, end: 0 } },
    ];
    const result = phoneModifier.resolve(args, ctx);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe('error');
    expect(result.diagnostics[0]?.message).toMatch(/'\.phone' takes no arguments/);
  });

  it('the valueTransform reformats a US phone number when evaluated', () => {
    // The descriptor fragment is a `$v`-placeholder code string. Substitute a
    // string literal for `$v` and eval it to prove the transform is sound.
    const { descriptor } = phoneModifier.resolve([], {
      source: 'template-event',
      event: 'input',
      sourceLoc: { start: 0, end: 0 },
    });
    const fragment = descriptor.valueTransform!.replace(/\$v/g, JSON.stringify('1-800-555-0199'));
    // eslint-disable-next-line no-eval
    const formatted = (0, eval)(fragment) as string;
    expect(formatted).toBe('(800) 555-0199');
  });
});
