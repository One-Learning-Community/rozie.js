/**
 * Quick task 260819-sg9 (Tier 2) Task 1 — behavior tests for
 * `createRozieAttrApplier` / `createRozieHostAttrsReader`, the runtime
 * factories that replace the Angular target's inlined `__rozieApplyAttrs` /
 * `__rozieGetHostAttrs` IIFE pair. The emitter is NOT touched by this task
 * — these tests exercise the runtime package directly (built via
 * `pnpm --filter @rozie/runtime-angular build`, resolved through the
 * package export map to `dist/`), proving the ported logic is correct
 * BEFORE the emitter is switched over to call it (Task 2).
 *
 * Ambient globals (`describe`, `it`, `expect`) per setup-vitest.ts — do NOT
 * `import { describe, it, expect } from 'vitest'` in this package.
 */
import { TestBed } from '@angular/core/testing';
import {
  createRozieAttrApplier,
  createRozieHostAttrsReader,
  type RozieAttrRenderer,
} from '@rozie/runtime-angular';
import { ensureTestBedInit } from './testBedInit';
import { AttrApplierStylePrecedenceHost } from './hosts/AttrApplierStylePrecedenceHost';

/**
 * A fake `RozieAttrRenderer` that both records every call (for call-shape
 * assertions) AND performs the real DOM mutation via native
 * `setAttribute`/`removeAttribute` (so class/style assertions can read back
 * off the DOM, matching how a real `Renderer2` ultimately behaves for these
 * two methods against a native element).
 */
function makeFakeRenderer(): RozieAttrRenderer & {
  calls: Array<{ method: 'setAttribute' | 'removeAttribute'; name: string; value?: string }>;
} {
  const calls: Array<{ method: 'setAttribute' | 'removeAttribute'; name: string; value?: string }> = [];
  return {
    calls,
    setAttribute(el, name, value) {
      calls.push({ method: 'setAttribute', name, value });
      el.setAttribute(name, value);
    },
    removeAttribute(el, name) {
      calls.push({ method: 'removeAttribute', name });
      el.removeAttribute(name);
    },
  };
}

describe('createRozieAttrApplier — pure diff/merge behavior (jsdom element, fake renderer)', () => {
  it('applies { id: "x" } via the supplied renderer', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const el = document.createElement('button');
    apply(el, { id: 'x' });
    expect(el.getAttribute('id')).toBe('x');
    expect(renderer.calls).toContainEqual({ method: 'setAttribute', name: 'id', value: 'x' });
  });

  it('removes the attribute for null and false values', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);

    const elNull = document.createElement('button');
    elNull.setAttribute('id', 'pre-existing');
    apply(elNull, { id: null });
    expect(elNull.hasAttribute('id')).toBe(false);

    const elFalse = document.createElement('button');
    elFalse.setAttribute('disabled', 'pre-existing');
    apply(elFalse, { disabled: false });
    expect(elFalse.hasAttribute('disabled')).toBe(false);
  });

  it('sets the attribute (does not remove) for 0 and empty-string values', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);

    const elZero = document.createElement('button');
    apply(elZero, { tabindex: 0 });
    expect(elZero.hasAttribute('tabindex')).toBe(true);
    expect(elZero.getAttribute('tabindex')).toBe('0');

    const elEmpty = document.createElement('button');
    apply(elEmpty, { title: '' });
    expect(elEmpty.hasAttribute('title')).toBe(true);
    expect(elEmpty.getAttribute('title')).toBe('');
  });

  it('removes a key present on the previous call and absent from the next; class/style are exempt from this removal path', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const el = document.createElement('button');

    apply(el, { id: 'x', title: 't', class: 'btn', style: 'color: red' });
    expect(el.hasAttribute('id')).toBe(true);
    expect(el.hasAttribute('title')).toBe(true);

    // Drop `id` and `title`; class/style also absent from this call.
    apply(el, {});
    expect(el.hasAttribute('id')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
    // class/style go through the merge path (asserted in detail below), not
    // the plain removeAttribute diff path — verified here only that they do
    // NOT appear as a bare `removeAttribute` call for a key that was never
    // absent-then-present through the plain path.
    const plainRemovals = renderer.calls.filter((c) => c.method === 'removeAttribute');
    expect(plainRemovals.some((c) => c.name === 'class')).toBe(false);
    expect(plainRemovals.some((c) => c.name === 'style')).toBe(false);
  });

  it('treats a null/undefined whole object as a clean remove-all then no-op, never a TypeError', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const el = document.createElement('button');

    apply(el, { id: 'x' });
    expect(el.hasAttribute('id')).toBe(true);

    expect(() => apply(el, null)).not.toThrow();
    expect(el.hasAttribute('id')).toBe(false);

    expect(() => apply(el, undefined)).not.toThrow();
    expect(el.hasAttribute('id')).toBe(false);
  });

  it('(CR-02) two different elements driven by ONE applier keep independent previous-key state — the per-element WeakMap', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const elA = document.createElement('button');
    const elB = document.createElement('button');

    apply(elA, { id: 'a' });
    apply(elB, { id: 'b' });

    // Dropping the key on A must not touch B.
    apply(elA, {});
    expect(elA.hasAttribute('id')).toBe(false);
    expect(elB.hasAttribute('id')).toBe(true);
    expect(elB.getAttribute('id')).toBe('b');
  });

  it('(R3a) class merge: a wrapper-authored static class survives a spread that also sets class, and both tokens are present', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const el = document.createElement('button');
    el.className = 'btn';

    apply(el, { class: 'is-open' });
    expect(el.classList.contains('btn')).toBe(true);
    expect(el.classList.contains('is-open')).toBe(true);
  });

  it('(R3b) class merge: dropping the class key on the next call removes only the previously-applied token, leaving the wrapper class', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const el = document.createElement('button');
    el.className = 'btn';

    apply(el, { class: 'is-open' });
    expect(el.classList.contains('is-open')).toBe(true);

    apply(el, {});
    expect(el.classList.contains('is-open')).toBe(false);
    expect(el.classList.contains('btn')).toBe(true);
  });

  it('(R3) style merge: an applied declaration lands with important priority; a dropped style property is removed and untouched properties survive', () => {
    const renderer = makeFakeRenderer();
    const apply = createRozieAttrApplier(renderer);
    const el = document.createElement('button');
    el.style.setProperty('color', 'green'); // wrapper-authored, not tracked by the applier

    apply(el, { style: 'background-color: blue' });
    expect(el.style.getPropertyValue('background-color')).toBe('blue');
    expect(el.style.getPropertyPriority('background-color')).toBe('important');
    // Untouched wrapper-authored property survives.
    expect(el.style.getPropertyValue('color')).toBe('green');

    // Drop the applied style property on the next call.
    apply(el, {});
    expect(el.style.getPropertyValue('background-color')).toBe('');
    // Untouched wrapper-authored property still survives.
    expect(el.style.getPropertyValue('color')).toBe('green');
  });
});

describe('createRozieHostAttrsReader — folds the host element live attributes into a record, re-read on every call', () => {
  it('reads current attributes and reflects a mutation made between calls', () => {
    const el = document.createElement('div');
    el.setAttribute('id', 'host-1');
    const read = createRozieHostAttrsReader({ nativeElement: el });

    const first = read();
    expect(first).toEqual({ id: 'host-1' });

    el.setAttribute('id', 'host-2');
    el.setAttribute('data-x', 'y');
    const second = read();
    expect(second).toEqual({ id: 'host-2', 'data-x': 'y' });
  });
});

describe('createRozieAttrApplier — R3(c) DI-identity + style-precedence proof (real TestBed, real Renderer2)', () => {
  it('an applied style wins over an Angular [ngStyle] binding for the same property — the WR-A1 last-write race, machine-checked', async () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AttrApplierStylePrecedenceHost] });
    const fixture = TestBed.createComponent(AttrApplierStylePrecedenceHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const div = (fixture.nativeElement as HTMLElement).querySelector('div');
    expect(div).not.toBeNull();
    expect(div!.style.getPropertyValue('color')).toBe('blue');
    expect(div!.style.getPropertyPriority('color')).toBe('important');

    fixture.destroy();
  });
});
