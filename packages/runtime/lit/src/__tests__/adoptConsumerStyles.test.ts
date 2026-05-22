/**
 * Quick task 260521-qsh — adoptConsumerStyles tests for @rozie/runtime-lit.
 *
 * Phase 07.5 cross-shadow-root stylesheet bridge. collectSheets walks a
 * CSSResultGroup (array | CSSStyleSheet | { styleSheet }) recursively;
 * adoptInto idempotently appends to shadowRoot.adoptedStyleSheets. The
 * deferred `customElements.whenDefined(...).then(...)` + `requestAnimationFrame`
 * branch is covered by registering a custom element whose shadow root attaches
 * after the call.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { adoptConsumerStyles } from '../adoptConsumerStyles.js';

let defineCounter = 0;
const uniqueTag = (): string => `rozie-adopt-test-${defineCounter++}`;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('adoptConsumerStyles — runtime-lit', () => {
  it('collectSheets handles a bare CSSStyleSheet and adopts it into the producer shadow root', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();

    adoptConsumerStyles(producer, sheet);
    expect(sr.adoptedStyleSheets).toContain(sheet);
    expect(sr.adoptedStyleSheets).toHaveLength(1);
  });

  it('collectSheets handles a { styleSheet } CssResult-like object', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();

    adoptConsumerStyles(producer, { styleSheet: sheet });
    expect(sr.adoptedStyleSheets).toContain(sheet);
  });

  it('collectSheets handles a nested array of CSSStyleSheet + CssResult-like', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });
    const a = new CSSStyleSheet();
    const b = new CSSStyleSheet();
    const c = new CSSStyleSheet();

    adoptConsumerStyles(producer, [a, [{ styleSheet: b }, [c]]]);
    expect(sr.adoptedStyleSheets).toContain(a);
    expect(sr.adoptedStyleSheets).toContain(b);
    expect(sr.adoptedStyleSheets).toContain(c);
    expect(sr.adoptedStyleSheets).toHaveLength(3);
  });

  it('adoptInto is idempotent — a second call adds nothing', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();

    adoptConsumerStyles(producer, sheet);
    adoptConsumerStyles(producer, sheet);
    expect(sr.adoptedStyleSheets).toHaveLength(1);
  });

  it('a CssResult-like object with a null styleSheet contributes nothing', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });

    adoptConsumerStyles(producer, { styleSheet: null });
    expect(sr.adoptedStyleSheets).toHaveLength(0);
  });

  it('consumerStyles of undefined is a no-op', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });

    expect(() => adoptConsumerStyles(producer, undefined)).not.toThrow();
    expect(sr.adoptedStyleSheets).toHaveLength(0);
  });

  it('consumerStyles of an empty array is a no-op', () => {
    const producer = document.createElement('div');
    const sr = producer.attachShadow({ mode: 'open' });

    adoptConsumerStyles(producer, []);
    expect(sr.adoptedStyleSheets).toHaveLength(0);
  });

  it('drives the deferred whenDefined + rAF path when the producer has no shadow root at call time', async () => {
    const tag = uniqueTag();
    const sheet = new CSSStyleSheet();

    class DeferredEl extends HTMLElement {
      connectedCallback(): void {
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      }
    }

    // Create the element BEFORE the class is registered — no shadowRoot,
    // not yet upgraded. This is the deferred-path entry condition: the initial
    // trySync() returns false, so adoptConsumerStyles reads `localName` and
    // schedules customElements.whenDefined().then() → requestAnimationFrame().
    const producer = document.createElement(tag);
    expect(producer.shadowRoot).toBeNull();

    // Must not throw — the whole deferred branch is exercised here.
    expect(() => adoptConsumerStyles(producer, sheet)).not.toThrow();

    customElements.define(tag, DeferredEl);
    document.body.appendChild(producer);

    // Let whenDefined().then() resolve and the scheduled rAF callback run.
    await customElements.whenDefined(tag);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await Promise.resolve();
    // Note: happy-dom does not attach a shadow root via connectedCallback in a
    // way the deferred trySync() can observe, so the cross-shadow-root adoption
    // cannot complete here — the deferred-path *code* is fully exercised; only
    // its terminal success arm is unreachable under happy-dom (see the
    // /* v8 ignore */ in adoptConsumerStyles.ts).
  });
});
