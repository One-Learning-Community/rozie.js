/**
 * command-palette-portal-overlay phase — `RoziePortalController` behavior
 * tests, against a REAL mounted `LitElement` with a REAL shadow root
 * (mirrors `KeynavController.test.ts`'s convention — per
 * `feedback_snapshot_tests_cement_bugs`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LitElement, html, nothing } from 'lit';
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

  it('a re-render with an UNCHANGED (falsy) container does NOT detach/reattach the element — focus in a descendant survives', async () => {
    // Regression: `place()` unconditionally called `insertBefore`/`appendChild`
    // on every `hostUpdated()`. Re-inserting an already-correctly-positioned
    // node is a MOVE (detach+reattach), which blurs any focused descendant.
    // The in-place (falsy-container) overlay case is the command-palette args
    // field: every keystroke re-renders the host, and the blur made Enter/
    // Escape land on <body> instead of the funnel. A steady-state re-render
    // must be a true no-op.
    const tag = `portal-focus-host-${tagCounter++}`;
    class FocusHostEl extends LitElement {
      static override properties = { tick: { attribute: false } };
      declare tick: number;
      controller: RoziePortalController;
      private cachedTarget: Element | null = null;
      constructor() {
        super();
        this.tick = 0;
        this.controller = new RoziePortalController(
          this,
          () => {
            if (!this.cachedTarget) {
              this.cachedTarget =
                this.shadowRoot?.querySelector('[data-testid="target"]') ?? null;
            }
            return this.cachedTarget;
          },
          () => null, // falsy container — render in place
        );
      }
      override render() {
        return html`<div data-testid="target">
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

    // Force a steady-state re-render (container unchanged, still falsy).
    el.tick = 1;
    await el.updateComplete;

    // Same node instance, still connected, and STILL focused.
    const inputAfter = el.shadowRoot.querySelector('[data-testid="field"]');
    expect(inputAfter).toBe(input);
    expect(input.isConnected).toBe(true);
    expect(el.shadowRoot.activeElement).toBe(input);
  });

  it('an in-place (never-portalled) element that Lit removes (r-if false) is NOT resurrected', async () => {
    // Regression: `@query(cache: true)` keeps returning the node after Lit
    // removes it (`open`/`r-if` → false). The controller must NOT re-insert a
    // node Lit has authoritatively removed when it was never portalled out —
    // otherwise a closed command-palette overlay reappears as a stale zombie
    // with its result list still showing (the submit-then-close [lit] gap).
    const tag = `portal-zombie-host-${tagCounter++}`;
    class ZombieHostEl extends LitElement {
      static override properties = { show: { attribute: false } };
      declare show: boolean;
      controller: RoziePortalController;
      private cachedTarget: Element | null = null;
      constructor() {
        super();
        this.show = true;
        this.controller = new RoziePortalController(
          this,
          () => {
            if (!this.cachedTarget) {
              this.cachedTarget =
                this.shadowRoot?.querySelector('[data-testid="target"]') ?? null;
            }
            return this.cachedTarget; // cache: true semantics — stays non-null after removal
          },
          () => null, // always in place
        );
      }
      override render() {
        return html`<div id="wrap">${this.show ? html`<div data-testid="target">payload</div>` : nothing}</div>`;
      }
    }
    if (!customElements.get(tag)) customElements.define(tag, ZombieHostEl);
    const el = (await mount(tag)) as HostInstance & { show: boolean };
    mountedEls.push(el);

    expect(el.shadowRoot.querySelector('[data-testid="target"]')).not.toBeNull();

    // Lit removes the node.
    el.show = false;
    await el.updateComplete;
    // …and a subsequent steady-state re-render must not bring it back.
    el.requestUpdate();
    await el.updateComplete;

    expect(el.shadowRoot.querySelector('[data-testid="target"]')).toBeNull();
  });

  it('a truthy container does NOT resurrect an r-if-removed node (appendTo toggled while closed)', async () => {
    // Regression (command-palette-portal-through-portal VR gap closure): the
    // falsy-container path already guards against resurrecting a Lit-removed
    // node, but the TRUTHY-container path did not. Sequence: palette CLOSED
    // (r-if → false removes the overlay), then `appendTo` flips to a real
    // container. `@query(cache:true)` still returns the detached node, and the
    // truthy branch `container.appendChild(el)` re-mounted it into the
    // container as a full-viewport, pointer-capturing zombie backdrop that
    // blocked every click (appendTo-escape [lit] openBtn timeout). The
    // controller must only place a node Lit still intends to render.
    const tag = `portal-toggle-zombie-host-${tagCounter++}`;
    class ToggleZombieHostEl extends LitElement {
      static override properties = {
        show: { attribute: false },
        container: { attribute: false },
      };
      declare show: boolean;
      declare container: Element | null;
      controller: RoziePortalController;
      private cachedTarget: Element | null = null;
      constructor() {
        super();
        this.show = true;
        this.container = null;
        this.controller = new RoziePortalController(
          this,
          () => {
            if (!this.cachedTarget) {
              this.cachedTarget =
                this.shadowRoot?.querySelector('[data-testid="target"]') ?? null;
            }
            return this.cachedTarget; // cache: true — stays non-null after removal
          },
          () => this.container,
        );
      }
      override render() {
        return html`<div id="wrap">${this.show ? html`<div data-testid="target">payload</div>` : nothing}</div>`;
      }
    }
    if (!customElements.get(tag)) customElements.define(tag, ToggleZombieHostEl);
    const el = (await mount(tag)) as HostInstance & { show: boolean; container: Element | null };
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    // Close: Lit removes the (never-portalled) overlay node.
    el.show = false;
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('[data-testid="target"]')).toBeNull();

    // Flip appendTo to a real container WHILE closed — must NOT resurrect it.
    el.container = container;
    await el.updateComplete;

    expect(container.querySelector('[data-testid="target"]')).toBeNull();

    // NOTE: re-opening after a toggle-while-closed does NOT re-portal the
    // freshly-rendered node here, because the emitted `@query(cache:true)` ref
    // stays bound to the FIRST node and the controller never sees the recreated
    // one — a separately-tracked limitation
    // (.planning/debug/command-palette-portal-through-portal.md; the VR
    // appendTo-escape cell toggles WHILE OPEN to avoid it). This test's scope
    // is the resurrect guard: a closed overlay must never reappear as a
    // pointer-capturing zombie in the container.
    el.show = true;
    await el.updateComplete;
    // The freshly-rendered node lives in the shadow root (not resurrected into
    // the container from the stale cache).
    expect(el.shadowRoot.querySelector('[data-testid="target"]')).not.toBeNull();
  });

  it('a re-render while portalled to a container does NOT re-move the element on every update', async () => {
    const tag = defineHostEl();
    const el = await mount(tag);
    mountedEls.push(el);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountedEls.push(container);

    (el as HostInstance).container = container;
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
