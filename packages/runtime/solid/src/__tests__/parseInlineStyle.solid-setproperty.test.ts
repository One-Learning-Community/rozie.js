/**
 * LB6 SEAM 3 — Solid expander depth-indent reaches the DOM.
 *
 * Root cause (pinned against solid-js@1.9.12 web.cjs `style()` L294-298): Solid
 * applies an object-form `style` prop by iterating keys into
 * `CSSStyleDeclaration.setProperty(key, value)`. `setProperty` requires a
 * KEBAB-case CSS property name — `setProperty('paddingLeft', …)` is a silent
 * no-op. `parseInlineStyle` previously camelCased declarations (via style-to-js
 * `reactCompat: true`), so a dynamic `:style="bodyCellStyle(row,col)"` returning
 * `'padding-left:1.75rem'` became `{ paddingLeft: '1.75rem' }` → dropped on
 * Solid. Single-word props (`overflow`) survived (camelCase == kebab); the
 * data-table expander depth-indent (`padding-left`) did not.
 *
 * The fix: `parseInlineStyle` passes a CSS STRING through verbatim so Solid's
 * `style()` helper routes it to `cssText` (the browser's CSS parser handles the
 * kebab property correctly). This test reproduces Solid's exact `style()`
 * application (string → cssText, object → per-key setProperty) and asserts the
 * depth-indent `padding-left` actually reaches the element.
 */
import { describe, it, expect } from 'vitest';
import { parseInlineStyle } from '../parseInlineStyle.js';

/** Mirror solid-js/web `style(node, value)`: string → cssText, object → setProperty per key. */
function applySolidStyle(el: HTMLElement, value: ReturnType<typeof parseInlineStyle>): void {
  if (typeof value === 'string') {
    el.style.cssText = value;
    return;
  }
  for (const key in value) {
    const v = (value as Record<string, string>)[key];
    if (v != null) el.style.setProperty(key, String(v));
  }
}

describe('parseInlineStyle → Solid style() application (LB6 SEAM 3)', () => {
  it('a multi-word `padding-left` declaration reaches the DOM the way Solid applies it', () => {
    const el = document.createElement('div');
    applySolidStyle(el, parseInlineStyle('padding-left:1.75rem'));
    expect(el.style.getPropertyValue('padding-left')).toBe('1.75rem');
  });

  it('the expander bodyCellStyle shape (pin style + depth pad) applies both declarations', () => {
    const el = document.createElement('div');
    applySolidStyle(el, parseInlineStyle('position:sticky;left:0px;padding-left:3.25rem'));
    expect(el.style.getPropertyValue('position')).toBe('sticky');
    expect(el.style.getPropertyValue('padding-left')).toBe('3.25rem');
  });

  it('a CSS custom-property object still applies (object-input passthrough preserved)', () => {
    const el = document.createElement('div');
    applySolidStyle(el, parseInlineStyle({ '--rozie-fill': '50%' }));
    expect(el.style.getPropertyValue('--rozie-fill')).toBe('50%');
  });

  it('null / empty input is a no-op (no crash)', () => {
    const el = document.createElement('div');
    applySolidStyle(el, parseInlineStyle(null));
    applySolidStyle(el, parseInlineStyle(''));
    expect(el.getAttribute('style') ?? '').toBe('');
  });
});
