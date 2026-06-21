/**
 * Quick task 260620-rta — rozieStyle normalizer tests for @rozie/runtime-lit.
 *
 * Lit has no string-only style helper to mirror, so this suite renders through
 * lit-html `html`/`render` into a happy-dom container and asserts on the live
 * DOM `style` attribute — the object case PROVES real CSS (not `[object Object]`)
 * via Lit's `styleMap` directive.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { html, render } from 'lit';
import { rozieStyle } from '../rozieStyle.js';

function mount(v: Parameters<typeof rozieStyle>[0]): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(html`<div style=${rozieStyle(v)}></div>`, container);
  return container.querySelector('div')!;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('rozieStyle (Lit)', () => {
  it('renders a non-empty object as real CSS (not [object Object]) via styleMap', () => {
    const el = mount({ color: 'red', fontSize: '12px' });
    const style = el.getAttribute('style') ?? '';
    // styleMap kebab-cases camel keys and serializes compactly (no space after
    // the colon) — the point is real CSS declarations, never `[object Object]`.
    expect(style.replace(/\s+/g, '')).toContain('color:red');
    expect(style.replace(/\s+/g, '')).toContain('font-size:12px');
    expect(style).not.toContain('[object Object]');
  });

  it('passes a non-empty string through verbatim', () => {
    const el = mount('opacity: 0.5');
    expect(el.getAttribute('style')).toBe('opacity: 0.5');
  });

  it('emits custom properties verbatim', () => {
    const el = mount({ '--x': '50%' });
    expect((el.getAttribute('style') ?? '').replace(/\s+/g, '')).toContain('--x:50%');
  });

  it('drops the style attribute for null', () => {
    expect(mount(null).hasAttribute('style')).toBe(false);
  });

  it('drops the style attribute for undefined', () => {
    expect(mount(undefined).hasAttribute('style')).toBe(false);
  });

  it('drops the style attribute for an empty / whitespace-only string', () => {
    expect(mount('').hasAttribute('style')).toBe(false);
    expect(mount('   ').hasAttribute('style')).toBe(false);
  });

  it('drops the style attribute for an empty object', () => {
    expect(mount({}).hasAttribute('style')).toBe(false);
  });
});
