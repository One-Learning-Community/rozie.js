/**
 * Plan 14-05 Task 1 — rozieSpread lit-html element-position directive tests.
 *
 * The `rozieSpread(obj)` directive (D-02 / 14-RESEARCH Pattern 4) applies an
 * attribute object to its host element via the lit-html part API. Each render:
 *   - For each key in the new object: `setAttribute(k, String(v))` UNLESS the
 *     value is `null` / `false` (then `removeAttribute(k)`).
 *   - For each key present in the PREVIOUS render but NOT in the new object:
 *     `removeAttribute(k)` (cross-render diff via a `prevKeys` snapshot).
 *
 * `PartType.ELEMENT` guard: instantiating `rozieSpread(...)` in any other part
 * position (attribute, child, property, …) throws a descriptive error.
 *
 * Mirrors the `@open-wc/lit-helpers` `spread()` reference impl's diffing
 * semantics (Pattern 4 / Sources § Secondary).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { html, render } from 'lit';
import { rozieSpread } from '../rozieSpread.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('rozieSpread — runtime-lit element-position directive', () => {
  it('(1) sets attributes from a plain object on first render', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button ${rozieSpread({ id: 'x', title: 't' })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('id')).toBe('x');
    expect(btn.getAttribute('title')).toBe('t');
  });

  it('(2) cross-render diff: removes a key that disappears between renders', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button ${rozieSpread({ id: 'x', title: 't' })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('title')).toBe('t');
    // Re-render with `title` dropped — directive must remove it from the DOM.
    render(
      html`<button ${rozieSpread({ id: 'x' })}></button>`,
      container,
    );
    // happy-dom + lit may or may not preserve the same `<button>` DOM node
    // across re-renders. The contract we care about is that `<button>` does
    // not carry the dropped `title` — re-querying covers both cases (element
    // preserved → diff removed it; element re-created → never had it).
    const btnAfter = container.querySelector('button')!;
    expect(btnAfter.getAttribute('id')).toBe('x');
    expect(btnAfter.getAttribute('title')).toBeNull();
  });

  it('(3) `null` value removes the attribute', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button ${rozieSpread({ id: 'x', title: 't' })}></button>`,
      container,
    );
    expect(container.querySelector('button')!.getAttribute('title')).toBe('t');
    render(
      html`<button ${rozieSpread({ id: 'x', title: null })}></button>`,
      container,
    );
    expect(container.querySelector('button')!.getAttribute('title')).toBeNull();
  });

  it('(4) `false` value removes the attribute', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button ${rozieSpread({ disabled: 'disabled' })}></button>`,
      container,
    );
    expect(container.querySelector('button')!.getAttribute('disabled')).toBe(
      'disabled',
    );
    render(
      html`<button ${rozieSpread({ disabled: false })}></button>`,
      container,
    );
    expect(container.querySelector('button')!.getAttribute('disabled')).toBeNull();
  });

  it('(5) used in non-element position → throws PartType.ELEMENT guard', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    // Using rozieSpread in attribute-value position is illegal — the
    // constructor PartType guard throws as soon as lit-html instantiates it.
    expect(() => {
      // rozieSpread is typed `DirectiveResult` and lit-html accepts any value
      // in attribute-value position at the type level. The runtime guard in
      // the directive constructor checks `partInfo.type !== PartType.ELEMENT`
      // and throws — verifying that intent here.
      render(
        html`<button id=${rozieSpread({ id: 'x' })}></button>`,
        container,
      );
    }).toThrow(/element position/i);
  });

  it('(6) numeric / string values coerce to String for setAttribute', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<input ${rozieSpread({ tabindex: 0, 'data-id': 42 })} />`,
      container,
    );
    const input = container.querySelector('input')!;
    expect(input.getAttribute('tabindex')).toBe('0');
    expect(input.getAttribute('data-id')).toBe('42');
  });
});
