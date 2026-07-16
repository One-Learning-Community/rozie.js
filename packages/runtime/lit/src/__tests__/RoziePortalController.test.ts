/**
 * command-palette-portal-overlay phase — `RoziePortalController` behavior
 * tests, against a REAL mounted `LitElement` with a REAL shadow root
 * (mirrors `KeynavController.test.ts`'s convention — per
 * `feedback_snapshot_tests_cement_bugs`).
 *
 * SENTINEL DESIGN (SEV-1 close-while-portalled zombie fix): the emitted host
 * uses TWO UNCACHED `@query`s — the portalled element
 * (`[data-rozie-portal-ref]`) and a sibling sentinel
 * (`[data-rozie-portal-anchor]`) stamped ahead of it INSIDE the same `r-if`
 * branch. The test hosts below mirror that emitted shape exactly (uncached
 * `querySelector` per call + a `<span data-rozie-portal-anchor hidden>`
 * sibling), so the controller's real close/reopen/disconnect reconciliation
 * is exercised rather than a cached-query stand-in.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LitElement, html, nothing } from 'lit';
import { RoziePortalController } from '../RoziePortalController.js';

interface HostInstance extends HTMLElement {
  container: Element | null;
  show: boolean;
  shadowRoot: ShadowRoot;
  updateComplete: Promise<boolean>;
  requestUpdate: () => void;
}

let tagCounter = 0;

// Shared host factory mirroring the emitted r-portal shape: uncached element
// + sentinel queries, and a sentinel `<span>` stamped ahead of the portalled
// target inside the `show` (r-if) conditional branch.
function defineHostEl(): string {
  const tag = `portal-test-host-${tagCounter++}`;

  class HostEl extends LitElement {
    static override properties = {
      container: { attribute: false },
      show: { attribute: false },
    };
    declare container: Element | null;
    declare show: boolean;
    controller: RoziePortalController;

    constructor() {
      super();
      this.container = null;
      this.show = true;
      this.controller = new RoziePortalController(
        this,
        // UNCACHED element query — returns null once relocated out of the
        // shadow root (the emitted `@query` without a cache arg).
        () => this.shadowRoot?.querySelector('[data-testid="target"]') ?? null,
        // UNCACHED sentinel query — present while the branch is alive.
        () => this.shadowRoot?.querySelector('[data-rozie-portal-anchor]') ?? null,
        () => this.container,
      );
    }

    override render() {
      // Wrapped in a host `<div id="wrap">` so the conditional is not the
      // template's bare-interpolation root — happy-dom mis-parses a nested
      // template that IS the entire body (the real emitted output has a
      // leading text node that avoids this in a real browser / VR). The
      // wrapper is irrelevant to the controller, which queries the shadow root
      // globally for the target + sentinel regardless of nesting depth.
      return html`<div id="wrap">${this.show
        ? html`<span data-rozie-portal-anchor hidden></span><div data-testid="target">payload</div>`
        : nothing}</div>`;
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
    expect(target).not.toBeNull();
    expect(el.shadowRoot.contains(target)).toBe(true); // stayed in the shadow
  });

  it('a truthy container moves the element there', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    el.container = container;
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

    el.container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();

    el.container = null;
    await el.updateComplete;

    expect(container.querySelector('[data-testid="target"]')).toBeNull();
    const target = el.shadowRoot.querySelector('[data-testid="target"]');
    expect(target).not.toBeNull();
  });

  it('(a) open->portal->close (r-if false) REMOVES the node from the container (SEV-1 zombie fix)', async () => {
    // THE fix: a portalled overlay whose `r-if` goes false is invisible to
    // Lit's ChildPart clear (the node was moved out of the shadow root). The
    // sentinel — a sibling that STAYS under ChildPart control — disappears the
    // instant Lit drops the branch, so the controller knows to remove the
    // stranded node instead of leaving a pointer-capturing zombie backdrop.
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    el.container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();

    // Close (r-if -> false). Container stays truthy (appendTo unchanged).
    el.show = false;
    await el.updateComplete;

    expect(container.querySelector('[data-testid="target"]')).toBeNull();
    // …and a subsequent steady-state re-render must not bring it back.
    el.requestUpdate();
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).toBeNull();
  });

  it('(b) close->reopen re-portals the RECREATED node into the container', async () => {
    // The recreate edge the cached-query design could never reach: after a
    // close, reopening builds a FRESH element in the shadow root; the uncached
    // queries observe it and the controller portals the new node out.
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    el.container = container;
    await el.updateComplete;
    const first = container.querySelector('[data-testid="target"]');
    expect(first).not.toBeNull();

    // Close.
    el.show = false;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).toBeNull();

    // Reopen — the recreated node must portal out again.
    el.show = true;
    await el.updateComplete;
    const second = container.querySelector('[data-testid="target"]');
    expect(second).not.toBeNull();
    expect(el.shadowRoot.querySelector('[data-testid="target"]')).toBeNull(); // moved out
    expect(second).not.toBe(first); // genuinely a fresh node
  });

  it('flipping the container truthy WHILE CLOSED does not resurrect a Lit-removed node', async () => {
    // The truthy-path resurrect guard, restated for the sentinel design: when
    // the branch is dropped (sentinel absent) the controller does nothing even
    // if `appendTo` flips to a real container while closed.
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    // Close first (in place — never portalled).
    el.show = false;
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('[data-testid="target"]')).toBeNull();

    // Flip appendTo to a real container WHILE closed — must NOT resurrect it.
    el.container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).toBeNull();

    // Reopening now portals the freshly-rendered node correctly.
    el.show = true;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();
  });

  it('(c) a steady re-render while portalled does NOT re-move the element (position guard)', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    el.container = container;
    await el.updateComplete;
    const target = container.querySelector('[data-testid="target"]')!;
    expect(target).not.toBeNull();

    let moves = 0;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) if (m.removedNodes.length || m.addedNodes.length) moves++;
    });
    mo.observe(container, { childList: true });

    // Steady-state re-render with the SAME container.
    el.requestUpdate();
    await el.updateComplete;
    mo.disconnect();

    expect(moves).toBe(0);
    expect(container.querySelector('[data-testid="target"]')).toBe(target);
  });

  it('(c) a steady in-place re-render does NOT detach/reattach — focus in a descendant survives', async () => {
    // Regression: `place()` must be a true no-op for a steadily in-place
    // (falsy-container) overlay — the command-palette args field re-renders on
    // every keystroke, and a detach+reattach blurred the focused input so
    // Enter/Escape landed on <body>.
    const tag = `portal-focus-host-${tagCounter++}`;
    class FocusHostEl extends LitElement {
      static override properties = { tick: { attribute: false } };
      declare tick: number;
      controller: RoziePortalController;
      constructor() {
        super();
        this.tick = 0;
        this.controller = new RoziePortalController(
          this,
          () => this.shadowRoot?.querySelector('[data-testid="target"]') ?? null,
          () => this.shadowRoot?.querySelector('[data-rozie-portal-anchor]') ?? null,
          () => null, // falsy container — render in place
        );
      }
      override render() {
        return html`<span data-rozie-portal-anchor hidden></span><div data-testid="target">
          <input data-testid="field" .value=${String(this.tick)} />
        </div>`;
      }
    }
    if (!customElements.get(tag)) customElements.define(tag, FocusHostEl);
    const el = (await mount(tag)) as HostInstance & { tick: number };
    mountedEls.push(el);

    const input = el.shadowRoot.querySelector('[data-testid="field"]') as HTMLInputElement;
    input.focus();
    expect(el.shadowRoot.activeElement).toBe(input);

    el.tick = 1;
    await el.updateComplete;

    const inputAfter = el.shadowRoot.querySelector('[data-testid="field"]');
    expect(inputAfter).toBe(input);
    expect(input.isConnected).toBe(true);
    expect(el.shadowRoot.activeElement).toBe(input);
  });

  it('an in-place (never-portalled) element that Lit removes (r-if false) is NOT resurrected', async () => {
    // The falsy-container mirror of the zombie guard: Lit owns the node's full
    // lifecycle, so an r-if → false removal must stick.
    const tag = defineHostEl();
    const el = await mount(tag); // container stays null → in place
    mountedEls.push(el);

    expect(el.shadowRoot.querySelector('[data-testid="target"]')).not.toBeNull();

    el.show = false;
    await el.updateComplete;
    el.requestUpdate();
    await el.updateComplete;

    expect(el.shadowRoot.querySelector('[data-testid="target"]')).toBeNull();
  });

  it('(d) disconnect->reconnect recovers — the node re-portals after the host is re-attached', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    el.container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();

    // Disconnect: hostDisconnected restores the node to the shadow root
    // (emptying the container) and clears all tracking.
    el.remove();
    expect(container.querySelector('[data-testid="target"]')).toBeNull();
    expect(el.shadowRoot.querySelector('[data-testid="target"]')).not.toBeNull();

    // Reconnect + re-render: the node re-portals into the container cleanly.
    document.body.appendChild(el);
    mountedEls.push(el);
    el.requestUpdate();
    await el.updateComplete;

    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();
    expect(el.shadowRoot.querySelector('[data-testid="target"]')).toBeNull();
  });

  it('disconnecting the host while portalled removes the node from the foreign container', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    el.container = container;
    await el.updateComplete;
    expect(container.querySelector('[data-testid="target"]')).not.toBeNull();

    el.remove(); // triggers disconnectedCallback -> hostDisconnected()

    expect(container.querySelector('[data-testid="target"]')).toBeNull();
  });
});
