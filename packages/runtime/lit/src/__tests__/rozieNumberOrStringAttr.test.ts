/**
 * Quick 260930-814 — `rozieNumberOrStringAttr` behavior tests.
 *
 * The Lit attribute converter for a Number+String union prop. Asserted two
 * ways: as a pure function (every edge of the finite-number rule), and
 * through a REAL mounted `LitElement` in happy-dom, so the converter is proven
 * on the actual `setAttribute` → `attributeChangedCallback` → property path
 * (behavior, not presence — `feedback_snapshot_tests_cement_bugs`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LitElement } from 'lit';
import { rozieNumberOrStringAttr } from '../rozieNumberOrStringAttr.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('rozieNumberOrStringAttr — pure function', () => {
  it('passes a non-numeric CSS string through unchanged', () => {
    expect(rozieNumberOrStringAttr('auto')).toBe('auto');
    expect(rozieNumberOrStringAttr('100%')).toBe('100%');
  });

  it('turns a finite numeric string into a number', () => {
    expect(rozieNumberOrStringAttr('600')).toBe(600);
    expect(rozieNumberOrStringAttr('-1.5')).toBe(-1.5);
    expect(rozieNumberOrStringAttr(' 42 ')).toBe(42);
  });

  it('keeps the empty string and non-finite numerics as strings', () => {
    expect(rozieNumberOrStringAttr('')).toBe('');
    expect(rozieNumberOrStringAttr('   ')).toBe('   ');
    expect(rozieNumberOrStringAttr('Infinity')).toBe('Infinity');
  });

  it('keeps null (attribute removal) as null', () => {
    expect(rozieNumberOrStringAttr(null)).toBeNull();
  });
});

let tagCounter = 0;

interface HeightHost extends HTMLElement {
  height: number | string | null;
  updateComplete: Promise<boolean>;
}

function defineHeightHost(): string {
  const tag = `number-or-string-attr-test-${tagCounter++}`;
  class TestHost extends LitElement {
    static override properties = {
      height: { converter: { fromAttribute: rozieNumberOrStringAttr } },
    };
    declare height: number | string | null;
  }
  customElements.define(tag, TestHost);
  return tag;
}

describe('rozieNumberOrStringAttr — mounted LitElement', () => {
  it("setAttribute('height', 'auto') gives the string 'auto'", async () => {
    const tag = defineHeightHost();
    const el = document.createElement(tag) as HeightHost;
    document.body.appendChild(el);
    await el.updateComplete;
    el.setAttribute('height', 'auto');
    await el.updateComplete;
    expect(el.height).toBe('auto');
  });

  it("setAttribute('height', '600') gives the number 600; removal gives null", async () => {
    const tag = defineHeightHost();
    const el = document.createElement(tag) as HeightHost;
    document.body.appendChild(el);
    await el.updateComplete;
    el.setAttribute('height', '600');
    await el.updateComplete;
    expect(el.height).toBe(600);
    expect(typeof el.height).toBe('number');
    el.removeAttribute('height');
    await el.updateComplete;
    expect(el.height).toBeNull();
  });
});
