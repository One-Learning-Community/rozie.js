/**
 * Plan 15-04 Task 1 — normalizeListeners unit tests (Vue runtime).
 *
 * Covers the Phase 15 D-08 hybrid's RUNTIME path for Vue: a dynamic `r-on`
 * object whose keys are not known at compile time is passed through to
 * Vue's native `v-on="<obj>"` directive. Vue 3 native-element v-on takes
 * lowercase event-name keys (A1 / Pitfall 8 lock), so this helper applies
 * NO per-target key remap — it's a FORBIDDEN_KEYS-skipping identity over a
 * null-prototype object.
 *
 * SECURITY (T-15-V5-03) — prototype-pollution: `__proto__` / `constructor` /
 * `prototype` keys in the input must be SKIPPED, never copied to the output.
 */
import { describe, it, expect } from 'vitest';
import { normalizeListeners } from '../normalizeListeners.js';

describe('normalizeListeners (Vue runtime) — Plan 15-04 Task 1', () => {
  it('lowercase native-element keys pass through unchanged (A1 / Pitfall 8)', () => {
    const fn1 = () => undefined;
    const fn2 = () => undefined;
    expect(normalizeListeners({ click: fn1, mouseenter: fn2 })).toEqual({
      click: fn1,
      mouseenter: fn2,
    });
  });

  it('does NOT camelCase keys to React-style onClick (Vue native v-on= rejects them)', () => {
    const fn = () => undefined;
    const out = normalizeListeners({ click: fn });
    expect(out).toEqual({ click: fn });
    expect(out).not.toHaveProperty('onClick');
  });

  it('kebab-case custom-event names pass through verbatim', () => {
    const fn = () => undefined;
    expect(normalizeListeners({ 'my-custom-event': fn })).toEqual({
      'my-custom-event': fn,
    });
  });

  it('preserves the full lowercase event surface (mouse / keyboard / form / touch / pointer / animation / clipboard)', () => {
    const fn = () => undefined;
    expect(
      normalizeListeners({
        click: fn,
        mouseenter: fn,
        keydown: fn,
        input: fn,
        submit: fn,
        touchstart: fn,
        pointerdown: fn,
        animationend: fn,
        copy: fn,
      }),
    ).toEqual({
      click: fn,
      mouseenter: fn,
      keydown: fn,
      input: fn,
      submit: fn,
      touchstart: fn,
      pointerdown: fn,
      animationend: fn,
      copy: fn,
    });
  });

  it('empty object input → empty object', () => {
    expect(normalizeListeners({})).toEqual({});
  });

  it('SECURITY: __proto__ key is SKIPPED, no prototype pollution', () => {
    const fn = () => undefined;
    const malicious = JSON.parse(
      '{ "__proto__": { "polluted": true }, "click": null }',
    ) as Record<string, unknown>;
    malicious.click = fn;
    const out = normalizeListeners(malicious);
    expect(out).toEqual({ click: fn });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('SECURITY: constructor and prototype keys are SKIPPED', () => {
    const fn = () => undefined;
    const out = normalizeListeners({
      constructor: 'evil',
      prototype: 'evil',
      click: fn,
    } as Record<string, unknown>);
    expect(out).toEqual({ click: fn });
    expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false);
  });

  it('output is built on a null-prototype object (no Object.prototype chain)', () => {
    const out = normalizeListeners({ click: () => undefined });
    expect(Object.getPrototypeOf(out)).toBeNull();
  });
});
