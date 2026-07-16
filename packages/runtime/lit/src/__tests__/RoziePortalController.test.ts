/**
 * command-palette-portal-overlay phase — `RoziePortalController` behavior
 * tests, against a REAL mounted `LitElement` with a REAL shadow root
 * (mirrors `KeynavController.test.ts`'s convention — per
 * `feedback_snapshot_tests_cement_bugs`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LitElement, html } from 'lit';
import { RoziePortalController } from '../RoziePortalController.js';

interface HostInstance extends HTMLElement {
  container: Element | null;
  shadowRoot: ShadowRoot;
  updateComplete: Promise<boolean>;
}

let tagCounter = 0;

function defineHostEl(): string {
  const tag = `portal-test-host-${tagCounter++}`;

  class HostEl extends LitElement {
    static override properties = { container: { attribute: false } };
    declare container: Element | null;
    controller: RoziePortalController;

    // Mirrors the emitted `@query('[data-rozie-ref="…"]', true)` CACHED
    // query — the real emitter's field caches its first resolved value
    // (`cache: true`) precisely because a subsequent `@query` re-query
    // would search `this.shadowRoot`, where the node NO LONGER lives once
    // portalled out. See `RoziePortalController.ts`'s module doc comment.
    private cachedTarget: Element | null = null;

    constructor() {
      super();
      this.container = null;
      this.controller = new RoziePortalController(
        this,
        () => {
          if (!this.cachedTarget) {
            this.cachedTarget =
              this.shadowRoot?.querySelector('[data-testid="target"]') ?? null;
          }
          return this.cachedTarget;
        },
        () => this.container,
      );
    }

    override render() {
      return html`<div data-testid="target">payload</div>`;
    }
  }

  if (!customElements.get(tag)) customElements.define(tag, HostEl);
  return tag;
}

async function mount(tag: string): Promise<HostInstance> {
  const el = document.createElement(tag) as HostInstance;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const mountedEls: HTMLElement[] = [];
afterEach(() => {
  for (const el of mountedEls) el.remove();
  mountedEls.length = 0;
});

describe('RoziePortalController — command-palette-portal-overlay', () => {
  it('a falsy container leaves the element in its natural shadow-DOM position', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);

    const target = el.shadowRoot.querySelector('[data-testid="target"]')!;
    expect(target.parentNode).toBe(el.shadowRoot);
  });

  it('a truthy container moves the element there', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    (el as HostInstance).container = container;
    await el.updateComplete;

    const target = el.shadowRoot.querySelector('[data-testid="target"]');
    expect(target).toBeNull(); // no longer in the shadow root
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();
  });

  it('a truthy -> falsy transition restores the element to its original shadow-DOM position', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    (el as HostInstance).container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();

    (el as HostInstance).container = null;
    await el.updateComplete;

    expect(container.querySelector('[data-testid="target"]')).toBeNull();
    const target = el.shadowRoot.querySelector('[data-testid="target"]');
    expect(target).not.toBeNull();
  });

  it('disconnecting the host while portalled removes the node from the foreign container', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    (el as HostInstance).container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();

    el.remove(); // triggers disconnectedCallback -> hostDisconnected()

    expect(container.querySelector('[data-testid="target"]')).toBeNull();
  });
});
