/**
 * Plan 15-05 Task 1 — rozieListeners lit-html AsyncDirective tests.
 *
 * The `rozieListeners(obj)` directive (D-12 / 15-RESEARCH Pattern 7) attaches a
 * listener object to its host element via the lit-html part API. Each render:
 *   - For each key in the new object whose value is a function and either new
 *     or reference-changed: `addEventListener(k, v)` (after `removeEventListener`
 *     when reference-changed).
 *   - For each key present in the PREVIOUS render but NOT in the new object
 *     (or whose value disappeared): `removeEventListener(k, prevFn)`.
 *   - `FORBIDDEN_KEYS` (`__proto__`, `constructor`, `prototype`) are silently
 *     skipped (T-15-V5-03 prototype-pollution guard).
 *
 * `PartType.ELEMENT` guard: instantiating `rozieListeners(...)` in any other
 * part position (attribute, child, property, …) throws a descriptive error.
 *
 * Disconnected cleanup: when the host part is disconnected (`setConnected(false)`),
 * `disconnected()` removes every attached listener (T-15-V5-04 leak defense).
 * This is the load-bearing reason `rozieListeners` extends `AsyncDirective`
 * (not regular `Directive`, which has no `disconnected()` hook).
 *
 * Mirrors the `@open-wc/lit-helpers`-style cross-render diff (Pattern 7).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, render } from 'lit';
import { rozieListeners } from '../rozieListeners.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('rozieListeners — runtime-lit element-position AsyncDirective', () => {
  it('(1) attaches listeners from a plain object on first render', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click = vi.fn();
    render(
      html`<button ${rozieListeners({ click })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    btn.click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('(2) cross-render diff: removes a key that disappears between renders', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click = vi.fn();
    render(
      html`<button ${rozieListeners({ click })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    btn.click();
    expect(click).toHaveBeenCalledTimes(1);
    // Re-render with `click` dropped — directive must removeEventListener it.
    render(html`<button ${rozieListeners({})}></button>`, container);
    const btnAfter = container.querySelector('button')!;
    btnAfter.click();
    // Listener was removed — no additional calls.
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('(3) reference-changed listener: removeEventListener(prev) + addEventListener(new)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click1 = vi.fn();
    const click2 = vi.fn();
    render(
      html`<button ${rozieListeners({ click: click1 })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    btn.click();
    expect(click1).toHaveBeenCalledTimes(1);
    expect(click2).not.toHaveBeenCalled();
    render(
      html`<button ${rozieListeners({ click: click2 })}></button>`,
      container,
    );
    const btnAfter = container.querySelector('button')!;
    btnAfter.click();
    // Prev (click1) was removed on the re-render; only click2 fires now.
    expect(click1).toHaveBeenCalledTimes(1);
    expect(click2).toHaveBeenCalledTimes(1);
  });

  it('(4) same-reference listener stays attached across re-renders (no extra fires)', () => {
    // Behavioral assertion (not a spy count) — the diff path detects
    // reference-equal listeners and skips both the remove and the add, so a
    // SINGLE click after a re-render fires the handler EXACTLY once. (If the
    // diff incorrectly removed+re-added, the listener identity would be the
    // same value but the count of registered listeners on the element would
    // also be a single one, so the user-visible behavior is identical — but
    // we still want to verify the same handler is invoked once per click
    // after multiple re-renders.)
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click = vi.fn();
    render(html`<button ${rozieListeners({ click })}></button>`, container);
    render(html`<button ${rozieListeners({ click })}></button>`, container);
    render(html`<button ${rozieListeners({ click })}></button>`, container);
    container.querySelector('button')!.click();
    // EXACTLY one — proves the listener is attached exactly once even after
    // multiple identical-reference re-renders (the diff suppresses churn).
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('(5) `__proto__` key is silently skipped (T-15-V5-03)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const harmless = vi.fn();
    const addSpy = vi.spyOn(HTMLButtonElement.prototype, 'addEventListener');
    // Building the object via `Object.defineProperty` so `__proto__` is an
    // own enumerable property (the bare `{ __proto__: harmless }` literal
    // sets the prototype, not a data key).
    const obj: Record<string, unknown> = {};
    Object.defineProperty(obj, '__proto__', {
      value: harmless,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    obj['constructor'] = harmless;
    obj['prototype'] = harmless;
    obj['click'] = harmless;
    render(html`<button ${rozieListeners(obj)}></button>`, container);
    // Only 'click' should have been registered — never '__proto__',
    // 'constructor', 'prototype'.
    const registered = addSpy.mock.calls.map((c) => c[0]);
    expect(registered).toContain('click');
    expect(registered).not.toContain('__proto__');
    expect(registered).not.toContain('constructor');
    expect(registered).not.toContain('prototype');
    addSpy.mockRestore();
  });

  it('(6) `rozieListeners(null)` / `rozieListeners(undefined)` is nullish-safe (CR-03)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click = vi.fn();
    // Seed prev with one listener.
    render(
      html`<button ${rozieListeners({ click })}></button>`,
      container,
    );
    // Re-render with null — must NOT throw and MUST remove the prior listener.
    expect(() => {
      render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        html`<button ${rozieListeners(null as any)}></button>`,
        container,
      );
    }).not.toThrow();
    container.querySelector('button')!.click();
    expect(click).toHaveBeenCalledTimes(0);
    // Same for undefined.
    expect(() => {
      render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        html`<button ${rozieListeners(undefined as any)}></button>`,
        container,
      );
    }).not.toThrow();
  });

  it('(7) non-function values are silently skipped', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const addSpy = vi.spyOn(HTMLButtonElement.prototype, 'addEventListener');
    render(
      html`<button
        ${rozieListeners({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          click: 'not a function' as any,
          mouseover: vi.fn(),
        })}
      ></button>`,
      container,
    );
    const registered = addSpy.mock.calls.map((c) => c[0]);
    expect(registered).toContain('mouseover');
    expect(registered).not.toContain('click');
    addSpy.mockRestore();
  });

  it('(8) used in non-element position → throws PartType.ELEMENT guard', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    expect(() => {
      render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        html`<button id=${rozieListeners({ click: () => {} } as any)}></button>`,
        container,
      );
    }).toThrow(/element position/i);
  });

  it('(9) disconnected() removes every attached listener (T-15-V5-04 leak defense)', async () => {
    // Use lit-html's part-tree connection API directly: `render(template, container)`
    // returns a `RootPart` whose `setConnected(false)` triggers
    // `AsyncDirective.disconnected()` on every async directive in the tree.
    // This is the canonical way to assert disconnect cleanup without going
    // through full template-conditional plumbing (which is happy-dom-fragile).
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click = vi.fn();
    const part = render(
      html`<button ${rozieListeners({ click })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    btn.click();
    expect(click).toHaveBeenCalledTimes(1);
    // Spy on the captured element so we observe the disconnected() path's
    // removeEventListener calls (the live element survives, only the
    // AsyncDirective is informed of the disconnect).
    const removeSpy = vi.spyOn(btn, 'removeEventListener');
    part.setConnected(false);
    // disconnected() should have removed the 'click' listener.
    expect(removeSpy.mock.calls.some((c) => c[0] === 'click')).toBe(true);
    // The element-level listener has been removed — clicking should not
    // call the original handler.
    btn.click();
    expect(click).toHaveBeenCalledTimes(1);
    removeSpy.mockRestore();
  });

  it('(10) `rozieListeners({})` removes prior listeners and adds none', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const click = vi.fn();
    const mouseover = vi.fn();
    render(
      html`<button ${rozieListeners({ click, mouseover })}></button>`,
      container,
    );
    container.querySelector('button')!.click();
    expect(click).toHaveBeenCalledTimes(1);
    render(html`<button ${rozieListeners({})}></button>`, container);
    container.querySelector('button')!.click();
    // No additional fires — both listeners were dropped.
    expect(click).toHaveBeenCalledTimes(1);
    expect(mouseover).toHaveBeenCalledTimes(0);
  });
});
