/**
 * Plan 15-03 Task 1 — normalizeListeners unit tests (React runtime).
 *
 * Covers the Phase 15 D-08 hybrid's RUNTIME path: a dynamic `r-on` object
 * whose keys are not known at compile time is key-remapped at runtime so
 * HTML-shape event names (`click`, `mouseenter`, …) become React-JSX
 * listener-prop names (`onClick`, `onMouseEnter`, …).
 *
 * SECURITY (T-15-V5-03) — prototype-pollution: `__proto__` / `constructor` /
 * `prototype` keys in the input must be SKIPPED, never copied to the output.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeListeners,
  REACT_LISTENER_KEY_MAP,
} from '../normalizeListeners.js';

describe('normalizeListeners (React runtime) — Plan 15-03 Task 1', () => {
  it('remaps click → onClick and mouseenter → onMouseEnter', () => {
    const fn1 = () => undefined;
    const fn2 = () => undefined;
    expect(normalizeListeners({ click: fn1, mouseenter: fn2 })).toEqual({
      onClick: fn1,
      onMouseEnter: fn2,
    });
  });

  it('remaps the core Mouse / Keyboard / Form / Touch / Pointer event set', () => {
    const fn = () => undefined;
    expect(
      normalizeListeners({
        click: fn,
        dblclick: fn,
        mousedown: fn,
        mouseenter: fn,
        keydown: fn,
        keyup: fn,
        input: fn,
        change: fn,
        submit: fn,
        focus: fn,
        blur: fn,
        touchstart: fn,
        pointerdown: fn,
      }),
    ).toEqual({
      onClick: fn,
      onDoubleClick: fn,
      onMouseDown: fn,
      onMouseEnter: fn,
      onKeyDown: fn,
      onKeyUp: fn,
      onInput: fn,
      onChange: fn,
      onSubmit: fn,
      onFocus: fn,
      onBlur: fn,
      onTouchStart: fn,
      onPointerDown: fn,
    });
  });

  it('remaps Animation / Transition / Clipboard event names', () => {
    const fn = () => undefined;
    expect(
      normalizeListeners({
        animationend: fn,
        transitionend: fn,
        copy: fn,
        cut: fn,
        paste: fn,
      }),
    ).toEqual({
      onAnimationEnd: fn,
      onTransitionEnd: fn,
      onCopy: fn,
      onCut: fn,
      onPaste: fn,
    });
  });

  it('keys already in onCamelCase form pass through verbatim (defensive)', () => {
    const fn = () => undefined;
    expect(normalizeListeners({ onClick: fn, onMouseEnter: fn })).toEqual({
      onClick: fn,
      onMouseEnter: fn,
    });
  });

  it('custom event names not in the remap table pass through verbatim', () => {
    const fn = () => undefined;
    expect(normalizeListeners({ 'my-custom-event': fn })).toEqual({
      'my-custom-event': fn,
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
    expect(out).toEqual({ onClick: fn });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('SECURITY: constructor and prototype keys are SKIPPED', () => {
    const fn = () => undefined;
    const out = normalizeListeners({
      constructor: 'evil',
      prototype: 'evil',
      click: fn,
    } as Record<string, unknown>);
    expect(out).toEqual({ onClick: fn });
    expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false);
  });

  it('output is built on a null-prototype object (no Object.prototype chain)', () => {
    const out = normalizeListeners({ click: () => undefined });
    expect(Object.getPrototypeOf(out)).toBeNull();
  });

  it('REACT_LISTENER_KEY_MAP contains the documented core event set', () => {
    // Sanity-check the minimum exhaustiveness called out in Plan 15-03's
    // acceptance criteria.
    expect(REACT_LISTENER_KEY_MAP['click']).toBe('onClick');
    expect(REACT_LISTENER_KEY_MAP['dblclick']).toBe('onDoubleClick');
    expect(REACT_LISTENER_KEY_MAP['mouseenter']).toBe('onMouseEnter');
    expect(REACT_LISTENER_KEY_MAP['mousedown']).toBe('onMouseDown');
    expect(REACT_LISTENER_KEY_MAP['keydown']).toBe('onKeyDown');
    expect(REACT_LISTENER_KEY_MAP['input']).toBe('onInput');
    expect(REACT_LISTENER_KEY_MAP['focus']).toBe('onFocus');
    expect(REACT_LISTENER_KEY_MAP['blur']).toBe('onBlur');
    expect(REACT_LISTENER_KEY_MAP['submit']).toBe('onSubmit');
    expect(REACT_LISTENER_KEY_MAP['touchstart']).toBe('onTouchStart');
    expect(REACT_LISTENER_KEY_MAP['pointerdown']).toBe('onPointerDown');
    expect(REACT_LISTENER_KEY_MAP['animationend']).toBe('onAnimationEnd');
    expect(REACT_LISTENER_KEY_MAP['transitionend']).toBe('onTransitionEnd');
    expect(REACT_LISTENER_KEY_MAP['copy']).toBe('onCopy');
  });
});
