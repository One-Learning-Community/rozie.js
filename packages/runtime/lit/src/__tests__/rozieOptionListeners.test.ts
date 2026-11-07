/**
 * `rozieOptionListeners` — element directive for listeners with `.capture` / `.passive` /
 * `.once` whose event already has a binding on the same element (Lit forbids two bindings
 * with the same attribute name). Rendered through real lit-html into happy-dom.
 */
import { html, render } from 'lit';
import { beforeEach, describe, expect, it } from 'vitest';
import { rozieOptionListeners, type RozieOptionListener } from '../rozieOptionListeners.js';

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

const mount = (entries: RozieOptionListener[], onPlain: () => void = () => {}) => {
  render(html`<div id="outer" @click=${onPlain} ${rozieOptionListeners(entries)}><button id="inner">x</button></div>`, host);
  return {
    outer: host.querySelector<HTMLElement>('#outer')!,
    inner: host.querySelector<HTMLElement>('#inner')!,
  };
};

describe('rozieOptionListeners', () => {
  it('attaches with capture next to a plain binding for the same event', () => {
    const log: string[] = [];
    const { inner } = mount([['click', () => log.push('capture'), { capture: true }]], () => log.push('bubble'));
    inner.addEventListener('click', () => log.push('inner'));
    inner.click();
    expect(log).toEqual(['capture', 'inner', 'bubble']);
  });

  it('once fires a single time, even when re-rendered with a new handler', () => {
    let calls = 0;
    const { outer } = mount([['click', () => calls++, { once: true }]]);
    outer.click();
    mount([['click', () => calls++, { once: true }]]);
    outer.click();
    expect(calls).toBe(1);
  });

  it('a non-once listener always runs the current render handler', () => {
    const log: string[] = [];
    const { outer } = mount([['click', () => log.push('first'), { capture: true }]]);
    mount([['click', () => log.push('second'), { capture: true }]]);
    outer.click();
    expect(log).toEqual(['second']);
  });

  it('passive makes preventDefault a no-op', () => {
    let prevented: boolean | null = null;
    const { outer } = mount([['wheel', (e: Event) => { e.preventDefault(); prevented = e.defaultPrevented; }, { passive: true }]]);
    outer.dispatchEvent(new Event('wheel', { cancelable: true }));
    expect(prevented).toBe(false);
  });

  it('removes the listeners when the element is removed', () => {
    let calls = 0;
    const { outer } = mount([['click', () => calls++, { capture: true }]]);
    render(html``, host);
    outer.click();
    expect(calls).toBe(0);
  });
});
