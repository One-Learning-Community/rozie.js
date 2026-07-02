/**
 * Plan 71-08 Task 1 — `KeynavController` behavior tests.
 *
 * Every case from the plan's `<behavior>` block, asserted against a REAL
 * mounted `LitElement` with a REAL shadow root (not IR-shape-only — per
 * `feedback_snapshot_tests_cement_bugs` and SPEC §11's "behavior tests, not
 * just snapshots" gate). The `MenuEl` harness below hand-authors the
 * `html\`\`` template a compiled Lit `r-keynav` component would emit
 * (`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabindex` as
 * DECLARATIVE template bindings comparing the loop index to the live
 * `active` reactive property — see `KeynavController.ts`'s module doc
 * comment for why the controller itself never writes those two attributes).
 *
 * Decorators (`@customElement`/`@property`) are deliberately NOT used here —
 * this workspace's vitest/esbuild transform has no decorator-metadata
 * config wired for this package's test path, and a plain `static properties`
 * + `declare <name>` field (avoiding Lit's class-field-shadowing footgun,
 * https://lit.dev/msg/class-field-shadowing) mounts and reacts identically
 * under `happy-dom` — verified against a throwaway spike before authoring
 * this suite.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LitElement, html } from 'lit';
import type { KeynavConfig } from '@rozie/runtime-keynav-core';
import { KeynavController, type KeynavControllerOpts } from '../KeynavController.js';

interface Item {
  id: string;
  label: string;
  disabled?: boolean;
}

const ITEMS: Item[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo', disabled: true },
  { id: 'c', label: 'Charlie' },
];

const BASE_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'vertical',
  loop: false,
  typeahead: true,
  skipDisabled: true,
};

interface MenuElInstance extends HTMLElement {
  active: number;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

let tagCounter = 0;

/**
 * Defines (and returns the tag name for) a fresh `MenuEl` custom element —
 * a fresh class per call so each test's `KeynavController` instance is
 * fully isolated (mirrors the React reference harness's per-render `Menu`
 * component, adapted to Lit's per-class-registration world).
 */
function defineMenuEl(opts: {
  config?: KeynavConfig;
  onCommit?: (i: number) => void;
  activeClass?: string;
  items?: Item[];
  initialActive?: number;
}): string {
  const tag = `keynav-test-menu-${tagCounter++}`;
  const items = opts.items ?? ITEMS;
  const config = opts.config ?? BASE_CONFIG;
  const onCommit = opts.onCommit ?? (() => {});

  class MenuEl extends LitElement {
    static override properties = { active: { type: Number } };
    declare active: number;
    controller: KeynavController;

    constructor() {
      super();
      this.active = opts.initialActive ?? 0;
      const controllerOpts: KeynavControllerOpts = {
        config,
        getSource: () => items,
        getActive: () => this.active,
        setActive: (i) => {
          this.active = i;
        },
        onCommit,
      };
      if (opts.activeClass !== undefined) {
        controllerOpts.activeClass = opts.activeClass;
      }
      this.controller = new KeynavController(this, controllerOpts);
    }

    override render() {
      return html`
        <ul>
          ${items.map(
            (item, i) => html`
              <li
                id="item-${i}"
                data-rozie-keynav-item=${i}
                ?data-rozie-keynav-active=${this.active === i}
                tabindex=${this.active === i ? 0 : -1}
              >${item.label}</li>
            `,
          )}
        </ul>
      `;
    }
  }

  customElements.define(tag, MenuEl);
  return tag;
}

async function mount(tag: string): Promise<MenuElInstance> {
  const el = document.createElement(tag) as MenuElInstance;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function items(el: MenuElInstance): HTMLElement[] {
  return Array.from(el.shadowRoot.querySelectorAll('li'));
}

function dispatchKey(target: Element, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('KeynavController — runtime-lit', () => {
  it('ArrowDown moves active and skips a disabled item; stamps data-rozie-keynav-active', async () => {
    const tag = defineMenuEl({});
    const el = await mount(tag);
    dispatchKey(items(el)[0]!, 'ArrowDown');
    await el.updateComplete;
    expect(el.active).toBe(2); // index 1 is disabled — skipDisabled walks past it
    const rendered = items(el);
    expect(rendered[2]!.hasAttribute('data-rozie-keynav-active')).toBe(true);
    expect(rendered[0]!.hasAttribute('data-rozie-keynav-active')).toBe(false);
  });

  it('ArrowUp moves backward', async () => {
    const tag = defineMenuEl({ initialActive: 2 });
    const el = await mount(tag);
    dispatchKey(items(el)[2]!, 'ArrowUp');
    await el.updateComplete;
    expect(el.active).toBe(0); // skips disabled index 1
  });

  it('Home / End jump to the first / last enabled item', async () => {
    const tag = defineMenuEl({ initialActive: 0 });
    const el = await mount(tag);
    dispatchKey(items(el)[0]!, 'End');
    await el.updateComplete;
    expect(el.active).toBe(2);
    dispatchKey(items(el)[2]!, 'Home');
    await el.updateComplete;
    expect(el.active).toBe(0);
  });

  it('Enter fires onCommit with the active index, without moving active', async () => {
    const onCommit = vi.fn();
    const tag = defineMenuEl({ onCommit, initialActive: 0 });
    const el = await mount(tag);
    dispatchKey(items(el)[0]!, 'Enter');
    await el.updateComplete;
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(0);
    expect(el.active).toBe(0);
  });

  it('typeahead jumps to the item whose label starts with the pressed letter', async () => {
    const tag = defineMenuEl({ initialActive: 0 });
    const el = await mount(tag);
    dispatchKey(items(el)[0]!, 'c');
    await el.updateComplete;
    expect(el.active).toBe(2); // "Charlie"
  });

  it('r-keynav-active-class tokens toggle on the active item only', async () => {
    const tag = defineMenuEl({ activeClass: 'is-active ring', initialActive: 0 });
    const el = await mount(tag);
    expect(items(el)[0]!.classList.contains('is-active')).toBe(true);
    expect(items(el)[0]!.classList.contains('ring')).toBe(true);

    el.active = 2;
    await el.updateComplete;
    expect(items(el)[0]!.classList.contains('is-active')).toBe(false);
    expect(items(el)[0]!.classList.contains('ring')).toBe(false);
    expect(items(el)[2]!.classList.contains('is-active')).toBe(true);
    expect(items(el)[2]!.classList.contains('ring')).toBe(true);
  });

  it('tabindex focus model calls .focus() on the newly-active item and updates roving tabindex', async () => {
    const tag = defineMenuEl({ initialActive: 0 });
    const el = await mount(tag);
    const rendered = items(el);
    const focusSpy = vi.spyOn(rendered[2]!, 'focus');

    el.active = 2;
    await el.updateComplete;

    expect(focusSpy).toHaveBeenCalledOnce();
    expect(rendered[2]!.getAttribute('tabindex')).toBe('0');
    expect(rendered[0]!.getAttribute('tabindex')).toBe('-1');
  });

  it('activedescendant focus model never calls .focus()', async () => {
    const tag = defineMenuEl({
      config: { ...BASE_CONFIG, focusModel: 'activedescendant' },
      initialActive: 0,
    });
    const el = await mount(tag);
    const rendered = items(el);
    const focusSpy = vi.spyOn(rendered[2]!, 'focus');

    el.active = 2;
    await el.updateComplete;

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('pointerdown on a marked item sets active AND fires commit (delegated — no per-item listeners)', async () => {
    const onCommit = vi.fn();
    const tag = defineMenuEl({ onCommit, initialActive: 0 });
    const el = await mount(tag);
    items(el)[2]!.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.active).toBe(2);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('T-71-08-01 — a pointerdown with no data-rozie-keynav-item ancestor is a safe no-op', async () => {
    const onCommit = vi.fn();
    const tag = defineMenuEl({ onCommit, initialActive: 0 });
    const el = await mount(tag);
    const ul = el.shadowRoot.querySelector('ul')!;
    expect(() =>
      ul.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, composed: true }),
      ),
    ).not.toThrow();
    await el.updateComplete;
    expect(el.active).toBe(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('loop wraps past the ends when .loop is set', async () => {
    const tag = defineMenuEl({
      config: { ...BASE_CONFIG, loop: true },
      initialActive: 2,
    });
    const el = await mount(tag);
    dispatchKey(items(el)[2]!, 'ArrowDown');
    await el.updateComplete;
    expect(el.active).toBe(0);
  });

  it('delegation queries/listeners are scoped to the shadow root, not document', async () => {
    const tag = defineMenuEl({ initialActive: 0 });
    const el = await mount(tag);
    // A keydown dispatched at document level (never entering the shadow
    // tree) must not move `active` — delegation is scoped to
    // `host.renderRoot`, per Landmine 6.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await el.updateComplete;
    expect(el.active).toBe(0);
  });

  it('hostDisconnected detaches listeners; a reconnect (hostConnected) re-arms them', async () => {
    const tag = defineMenuEl({ initialActive: 0 });
    const el = await mount(tag);

    el.remove();
    // Detached — a keydown against the (now-orphaned) shadow tree must not
    // move `active`.
    dispatchKey(items(el)[0]!, 'ArrowDown');
    await Promise.resolve();
    expect(el.active).toBe(0);

    document.body.appendChild(el);
    await el.updateComplete;
    dispatchKey(items(el)[0]!, 'ArrowDown');
    await el.updateComplete;
    expect(el.active).toBe(2);
  });
});
