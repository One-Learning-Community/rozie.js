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

  it('(7-CR-03) null / undefined obj is treated as no-attributes (no throw, prior keys removed)', () => {
    // CR-03 regression: a manual r-bind whose expression goes null/undefined
    // at runtime previously threw on `k in null` / `Object.entries(null)` /
    // `Object.keys(null)`. The fix coerces nullish → `{}` so the diff path
    // is a clean remove-all-prev-keys (matching Vue/React/Svelte semantics).
    const container = document.createElement('div');
    document.body.appendChild(container);
    // First render seeds prevKeys with { id, title }.
    render(
      html`<button ${rozieSpread({ id: 'x', title: 't' })}></button>`,
      container,
    );
    expect(container.querySelector('button')!.getAttribute('title')).toBe('t');
    // Re-render with null — must NOT throw and MUST remove the prior keys.
    expect(() => {
      render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        html`<button ${rozieSpread(null as any)}></button>`,
        container,
      );
    }).not.toThrow();
    const btnAfter = container.querySelector('button')!;
    expect(btnAfter.getAttribute('id')).toBeNull();
    expect(btnAfter.getAttribute('title')).toBeNull();
    // Same for undefined.
    expect(() => {
      render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        html`<button ${rozieSpread(undefined as any)}></button>`,
        container,
      );
    }).not.toThrow();
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

  it('(8-WR-A1) class is token-MERGED with the template-literal class, not replaced', () => {
    // R6 acceptance: consumer-side `class="extra-variant"` lands in `$attrs`;
    // the rozieSpread directive must ADD the token via `classList.add` rather
    // than `setAttribute('class', ...)`, otherwise the template-literal's
    // `class="btn primary"` is wiped.
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button class="btn primary" ${rozieSpread({ class: 'extra-variant' })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('primary')).toBe(true);
    expect(btn.classList.contains('extra-variant')).toBe(true);
  });

  it('(9-WR-A1) class-merge: dropping an incoming class token removes only the directive-added token', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button class="btn primary" ${rozieSpread({ class: 'extra-variant other-one' })}></button>`,
      container,
    );
    const btn = container.querySelector('button')!;
    expect(btn.classList.contains('extra-variant')).toBe(true);
    expect(btn.classList.contains('other-one')).toBe(true);
    // Re-render with `other-one` dropped — directive must remove it, leave
    // template-literal's static tokens (`btn`, `primary`) intact.
    render(
      html`<button class="btn primary" ${rozieSpread({ class: 'extra-variant' })}></button>`,
      container,
    );
    const btnAfter = container.querySelector('button')!;
    expect(btnAfter.classList.contains('btn')).toBe(true);
    expect(btnAfter.classList.contains('primary')).toBe(true);
    expect(btnAfter.classList.contains('extra-variant')).toBe(true);
    expect(btnAfter.classList.contains('other-one')).toBe(false);
  });

  it('(10-WR-A1) style is per-property MERGED with the template-literal style, not replaced', () => {
    // R6 acceptance: consumer-side `style="--btn-bg: #ef4444"` lands in
    // `$attrs`; the directive must `setProperty` per-prop rather than
    // `setAttribute('style', ...)`, otherwise the template-literal's
    // `style="..."` declarations are wiped.
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button
        style="--btn-fg: #ffffff; padding: 4px"
        ${rozieSpread({ style: '--btn-bg: #ef4444' })}
      ></button>`,
      container,
    );
    const btn = container.querySelector('button')! as HTMLElement;
    expect(btn.style.getPropertyValue('--btn-bg').trim()).toBe('#ef4444');
    expect(btn.style.getPropertyValue('--btn-fg').trim()).toBe('#ffffff');
    expect(btn.style.getPropertyValue('padding').trim()).toBe('4px');
  });

  it('(11-WR-A1) style-merge: dropping an incoming style prop removes only the directive-set prop', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button
        style="--btn-fg: #ffffff"
        ${rozieSpread({ style: '--btn-bg: #ef4444; --extra: 1' })}
      ></button>`,
      container,
    );
    const btn = container.querySelector('button')! as HTMLElement;
    expect(btn.style.getPropertyValue('--extra').trim()).toBe('1');
    render(
      html`<button
        style="--btn-fg: #ffffff"
        ${rozieSpread({ style: '--btn-bg: #ef4444' })}
      ></button>`,
      container,
    );
    const btnAfter = container.querySelector('button')! as HTMLElement;
    // Directive-set prop dropped → removed; template-literal-set prop kept.
    expect(btnAfter.style.getPropertyValue('--extra').trim()).toBe('');
    expect(btnAfter.style.getPropertyValue('--btn-bg').trim()).toBe('#ef4444');
    expect(btnAfter.style.getPropertyValue('--btn-fg').trim()).toBe('#ffffff');
  });

  it('(12-WR-A1) class/style absent from new obj after presence → directive-added tokens/props removed (clean drop)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`<button
        class="btn"
        style="padding: 4px"
        ${rozieSpread({ class: 'extra', style: '--c: 1' })}
      ></button>`,
      container,
    );
    let btn = container.querySelector('button')! as HTMLElement;
    expect(btn.classList.contains('extra')).toBe(true);
    expect(btn.style.getPropertyValue('--c').trim()).toBe('1');
    render(
      html`<button
        class="btn"
        style="padding: 4px"
        ${rozieSpread({})}
      ></button>`,
      container,
    );
    btn = container.querySelector('button')! as HTMLElement;
    // Directive-added token removed; template-literal class kept.
    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('extra')).toBe(false);
    // Directive-set prop removed; template-literal style kept.
    expect(btn.style.getPropertyValue('--c').trim()).toBe('');
    expect(btn.style.getPropertyValue('padding').trim()).toBe('4px');
  });
});
