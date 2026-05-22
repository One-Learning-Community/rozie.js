/**
 * Quick task 260521-qsh — injectGlobalStyles tests for @rozie/runtime-lit.
 *
 * D-LIT-15 idempotent global-styles injection: a `<style data-rozie-global-id>`
 * is appended to document.head; a second call with the same id is a no-op.
 * The `typeof document === 'undefined'` SSR guard is unreachable under
 * happy-dom and carries a justified /* v8 ignore *\/ in injectGlobalStyles.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { injectGlobalStyles } from '../injectGlobalStyles.js';

afterEach(() => {
  // Drain any injected <style> markers between cases.
  for (const el of Array.from(
    document.head.querySelectorAll('style[data-rozie-global-id]'),
  )) {
    el.remove();
  }
});

const injected = (): NodeListOf<Element> =>
  document.head.querySelectorAll('style[data-rozie-global-id]');

describe('injectGlobalStyles — runtime-lit', () => {
  it('first call appends a <style> with the id attribute + css textContent', () => {
    injectGlobalStyles('rozie-modal-global', ':root { --z: 9999; }');
    expect(injected()).toHaveLength(1);
    const styleEl = injected()[0]!;
    expect(styleEl.tagName).toBe('STYLE');
    expect(styleEl.getAttribute('data-rozie-global-id')).toBe(
      'rozie-modal-global',
    );
    expect(styleEl.textContent).toBe(':root { --z: 9999; }');
  });

  it('second call with the same id is a no-op (still exactly one style node)', () => {
    injectGlobalStyles('rozie-dup', ':root { --a: 1; }');
    injectGlobalStyles('rozie-dup', ':root { --a: 2; }');
    expect(injected()).toHaveLength(1);
    // The first injection wins — idempotent, not last-write.
    expect(injected()[0]!.textContent).toBe(':root { --a: 1; }');
  });

  it('two different ids produce two style nodes', () => {
    injectGlobalStyles('rozie-one', ':root { --a: 1; }');
    injectGlobalStyles('rozie-two', ':root { --b: 2; }');
    expect(injected()).toHaveLength(2);
  });

  it('an id with CSS-syntactic chars round-trips through CSS.escape without throwing', () => {
    // The CSS.escape() call protects the querySelector against syntactic chars
    // (], \, etc.). Note: happy-dom's selector engine does not match an
    // attribute selector whose value contains an escaped backslash/bracket, so
    // the idempotency lookup itself cannot be exercised for such an id under
    // happy-dom — the contract verified here is "does not throw".
    const trickyId = 'a]b\\c';
    expect(() =>
      injectGlobalStyles(trickyId, ':root { --x: 1; }'),
    ).not.toThrow();
    expect(injected()).toHaveLength(1);
    expect(injected()[0]!.getAttribute('data-rozie-global-id')).toBe(trickyId);
  });
});
