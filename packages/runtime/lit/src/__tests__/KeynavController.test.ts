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
import { LitElement, html, nothing } from 'lit';
import type { KeynavConfig, KeynavPageDetail } from '@rozie/runtime-keynav-core';
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

async function mount<T extends HTMLElement = MenuElInstance>(tag: string): Promise<T> {
  const el = document.createElement(tag) as T;
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
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

    // Plan 260806-lz7 — a bare `el.active = 2` property write (never a real
    // keydown/pointerdown/focusin) is now correctly guarded on a cold mount
    // (case (c) of the strict-containment matrix) — a value change alone is
    // not evidence of a real navigation. Establish real interaction first
    // (focusing the CURRENTLY active item, mirroring how a roving-tabindex
    // consumer would already have arrived at item 0 before triggering this
    // change) so the SUBSEQUENT active-index write is a genuine navigation,
    // matching this test's actual intent — "does an active-CHANGE call
    // .focus()", not "does a cold value write steal focus".
    rendered[0]!.focus();
    await el.updateComplete;

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

// ---------------------------------------------------------------------------
// Plan 260806-lz7 Task 1 — strict-containment focus guard. `defineScopedMenuEl`
// renders a persistent `#heading` button in the SAME shadow root as the
// keynav root's `<ul>`, so case (b) can focus something "inside the
// component (this.host's shadow tree) but outside the keynav root" — the
// Lit shape of the date-picker drill-heading scenario. Unlike the four
// opts-driven runtimes, Lit has no `getFocusScope` field (it derives its
// anchor natively from `this.host`), so there is no separate compatibility
// case here — every Lit consumer gets strict containment unconditionally.
// ---------------------------------------------------------------------------

interface ScopedMenuElInstance extends HTMLElement {
  active: number;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

function defineScopedMenuEl(opts: { config?: KeynavConfig; onCommit?: (i: number) => void }): string {
  const tag = `keynav-test-scoped-menu-${tagCounter++}`;
  const config = opts.config ?? BASE_CONFIG;
  const onCommit = opts.onCommit ?? (() => {});

  class ScopedMenuEl extends LitElement {
    static override properties = { active: { type: Number } };
    declare active: number;
    controller: KeynavController;

    constructor() {
      super();
      this.active = 0;
      this.controller = new KeynavController(this, {
        config,
        getSource: () => ITEMS,
        getActive: () => this.active,
        setActive: (i) => {
          this.active = i;
        },
        onCommit,
      });
    }

    override render() {
      return html`
        <button type="button" id="heading">Heading</button>
        <ul>
          ${ITEMS.map(
            (item, i) => html`
              <li
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

  customElements.define(tag, ScopedMenuEl);
  return tag;
}

function scopedItems(el: ScopedMenuElInstance): HTMLElement[] {
  return Array.from(el.shadowRoot.querySelectorAll('li'));
}

function scopedByLabel(el: ScopedMenuElInstance, label: string): HTMLElement {
  const found = scopedItems(el).find((it) => it.textContent === label);
  if (!found) throw new Error(`no item with label ${label}`);
  return found;
}

describe('KeynavController — strict-containment focus guard (Plan 260806-lz7 Task 1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('case (c): a cold mount with nothing ever focused does not steal focus or scroll', async () => {
    const tag = defineMenuEl({});
    const el = await mount(tag);

    expect(document.activeElement).toBe(document.body);
    expect(items(el)[0]!.hasAttribute('data-rozie-keynav-active')).toBe(true); // active-class/data marker IS unconditional
    expect(el.shadowRoot.activeElement).not.toBe(items(el)[0]); // but DOM focus was NOT stolen
  });

  it('case (a) — THE STRICTNESS CASE: mount while a real element OUTSIDE the component subtree holds focus does not steal focus', async () => {
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const tag = defineMenuEl({});
    const el = await mount(tag);

    // A document-scoped predicate would let this steal focus (something IS
    // focused on the page); strict containment must not, because "outside"
    // is not inside the component's own host/shadow subtree.
    expect(document.activeElement).toBe(outside);
    expect(el.shadowRoot.activeElement).not.toBe(items(el)[0]);

    outside.remove();
  });

  it('case (b): mount/re-appearance while focus is INSIDE the component (this.host\'s shadow tree) but outside the keynav root DOES focus (drill-continuity shape)', async () => {
    const tag = defineScopedMenuEl({});
    const el = await mount<ScopedMenuElInstance>(tag);
    expect(el.shadowRoot.activeElement).not.toBe(scopedByLabel(el, 'Alpha')); // cold mount — case (c), unaffected here

    // Disconnect + reconnect forces a fresh attachment (hostDisconnected then
    // hostConnected resets lastFocusedActive to null — mirroring an r-if
    // root's controller-level fresh-attachment reset on the other five
    // targets). `.focus()` the heading — inside this.host's shadow tree,
    // outside the <ul> keynav root — SYNCHRONOUSLY right after reconnecting
    // and BEFORE awaiting `updateComplete`: Lit's reactive update (and thus
    // `hostUpdated()`) is scheduled on a microtask, so this establishes real
    // focus before the guarded pass evaluates it, mirroring the date-picker
    // drill shape where focus already sits on the persistent header when a
    // panel reappears.
    el.remove();
    document.body.appendChild(el);
    (el.shadowRoot.querySelector('#heading') as HTMLElement).focus();
    // Forces a genuine update cycle (hostUpdated included) even though no
    // reactive property changed — in the real component, an r-if panel
    // reappearing is always accompanied by a property flip that would
    // trigger this same cycle; `requestUpdate()` is the direct, honest way
    // to force it here without inventing unrelated property plumbing.
    (el as unknown as { requestUpdate(): void }).requestUpdate();
    await el.updateComplete;

    expect(el.shadowRoot.activeElement).toBe(scopedByLabel(el, 'Alpha'));
  });

  it('case (d): after a guarded cold mount, an index change focuses unconditionally even though document focus is still at body', async () => {
    const tag = defineMenuEl({});
    const el = await mount(tag);
    expect(document.activeElement).toBe(document.body); // guarded mount pass did not steal focus

    dispatchKey(items(el)[0]!, 'ArrowDown'); // a genuine navigation pass
    await el.updateComplete;

    // Index 1 (Bravo) is disabled — skipDisabled lands on index 2 (Charlie)
    // — and it IS focused, unconditionally, even though document focus was
    // still at body.
    expect(el.shadowRoot.activeElement).toBe(items(el)[2]);
  });

  // Found via this plan's own Docker VR run against @rozie-ui/date-picker —
  // see the React reference's identical test (`useKeynav.test.tsx`) for the
  // full rationale: a consumer may resolve its true mount-time active index
  // through an app-level property write AFTER the initial render
  // (date-picker's `seedActiveDay`, deferred one `requestAnimationFrame`),
  // which looks IDENTICAL to a real navigation on a plain value diff — a
  // bare `el.active = N` write is never routed through the delegated
  // keydown/pointerdown/focusin listeners.
  it('an app-level (non-interaction) active-index write AFTER mount is still guarded — a value change alone is not evidence of a real navigation', async () => {
    const tag = defineMenuEl({});
    const el = await mount(tag);
    expect(document.activeElement).toBe(document.body); // cold mount — case (c)

    el.active = 2; // 'Charlie' — a bare property write, never a real interaction.
    await el.updateComplete;

    expect(items(el)[2]!.getAttribute('data-rozie-keynav-active')).toBe(''); // active-class/data marker IS unconditional
    // DOM focus must NOT have followed it — nothing on the page was ever
    // interacted with.
    expect(document.activeElement).toBe(document.body);
    expect(el.shadowRoot.activeElement).not.toBe(items(el)[2]);
  });
});

// ---------------------------------------------------------------------------
// Plan 77-05 Task 1 — `onPage` + `gridColumns` + the deferred one-frame-late
// focus pass. A separate harness (`defineGridMenuEl`/`defineLateGridEl`)
// keeps the pre-existing `defineMenuEl` cases above completely untouched
// (SPEC §7.4 additive invariant). Mirrors the React reference's
// `GridMenu`/`LateGrid` harnesses (Plan 77-03 Task 1), replicated test-by-
// test by Vue/Svelte/Solid (Plan 77-04) — REAL Lit updates
// (`el.updateComplete`), not IR-shape-only.
// ---------------------------------------------------------------------------

interface GridItem {
  id: string;
  label: string;
}

const GRID_ITEMS: GridItem[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
  { id: 'e', label: 'E' },
  { id: 'f', label: 'F' },
];

// `orientation: 'both'` is what the 1D branch falls back to when
// `gridColumns` is NOT supplied — deliberately reused for both the grid and
// no-grid cases below so the harness proves grid semantics are selected by
// `gridColumns` PRESENCE alone, not by anything in `config` itself.
const GRID_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'both',
  loop: false,
  typeahead: false,
  skipDisabled: false,
};

interface GridMenuElInstance extends HTMLElement {
  active: number;
  columns: number;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

function defineGridMenuEl(opts: {
  onCommit?: (i: number) => void;
  onPage?: (detail: KeynavPageDetail) => void;
  /** `undefined` exercises the "no gridColumns" (1D) branch. */
  columns?: number;
  initialActive?: number;
}): string {
  const tag = `keynav-test-grid-${tagCounter++}`;
  const items = GRID_ITEMS;
  const onCommit = opts.onCommit ?? (() => {});
  const hasGrid = opts.columns !== undefined;

  class GridMenuEl extends LitElement {
    static override properties = { active: { type: Number }, columns: { type: Number } };
    declare active: number;
    declare columns: number;
    controller: KeynavController;

    constructor() {
      super();
      this.active = opts.initialActive ?? 0;
      this.columns = opts.columns ?? 0;
      const controllerOpts: KeynavControllerOpts = {
        config: GRID_CONFIG,
        getSource: () => items,
        getActive: () => this.active,
        setActive: (i) => {
          this.active = i;
        },
        onCommit,
      };
      if (hasGrid) controllerOpts.gridColumns = () => this.columns;
      if (opts.onPage !== undefined) controllerOpts.onPage = opts.onPage;
      this.controller = new KeynavController(this, controllerOpts);
    }

    override render() {
      return html`
        <div role="grid">
          ${items.map(
            (item, i) => html`
              <button
                data-rozie-keynav-item=${i}
                ?data-rozie-keynav-active=${this.active === i}
                tabindex=${this.active === i ? 0 : -1}
              >${item.label}</button>
            `,
          )}
        </div>
      `;
    }
  }

  customElements.define(tag, GridMenuEl);
  return tag;
}

interface LateGridElInstance extends HTMLElement {
  active: number;
  revealed: boolean;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

/**
 * Harness for the "item renders one frame late" cases — item 5 stays absent
 * from the render output until `revealed` flips, standing in for a dataset
 * swap (grid paging) whose landing element isn't in the DOM at
 * `hostUpdated()` time yet. `active` and `revealed` are DIFFERENT reactive
 * properties, so navigating onto index 5 alone does not reveal it — mirrors
 * the React/Solid references' identical two-signal harness design.
 */
function defineLateGridEl(opts: { onCommit?: (i: number) => void }): string {
  const tag = `keynav-test-lategrid-${tagCounter++}`;
  const items = GRID_ITEMS;
  const onCommit = opts.onCommit ?? (() => {});

  class LateGridEl extends LitElement {
    static override properties = { active: { type: Number }, revealed: { type: Boolean } };
    declare active: number;
    declare revealed: boolean;
    controller: KeynavController;

    constructor() {
      super();
      this.active = 0;
      this.revealed = false;
      this.controller = new KeynavController(this, {
        config: GRID_CONFIG,
        getSource: () => items,
        getActive: () => this.active,
        setActive: (i) => {
          this.active = i;
        },
        onCommit,
        gridColumns: () => 3,
      });
    }

    override render() {
      return html`
        <div role="grid">
          ${items.map((item, i) => {
            if (i === 5 && !this.revealed) return html``;
            return html`
              <button
                data-rozie-keynav-item=${i}
                ?data-rozie-keynav-active=${this.active === i}
                tabindex=${this.active === i ? 0 : -1}
              >${item.label}</button>
            `;
          })}
        </div>
      `;
    }
  }

  customElements.define(tag, LateGridEl);
  return tag;
}

function gridItems(el: GridMenuElInstance | LateGridElInstance): HTMLElement[] {
  return Array.from(el.shadowRoot.querySelectorAll('button'));
}

function byLabel(el: GridMenuElInstance | LateGridElInstance, label: string): HTMLElement {
  const found = gridItems(el).find((b) => b.textContent === label);
  if (!found) throw new Error(`no item with label ${label}`);
  return found;
}

/** Stubs `requestAnimationFrame`/`cancelAnimationFrame` for manual, deterministic control. */
function stubRaf(): {
  callbacks: FrameRequestCallback[];
  cancelSpy: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const callbacks: FrameRequestCallback[] = [];
  const rafSpy = vi.fn((cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  });
  const cancelSpy = vi.fn();
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  return { callbacks, cancelSpy, restore: () => vi.unstubAllGlobals() };
}

describe('KeynavController — grid config, @keynav-page, deferred focus (Plan 77-05 Task 1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('grid: onPage receives a boundary detail when an arrow hits the edge (SPEC §4.1)', async () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const tag = defineGridMenuEl({ onCommit: commit, onPage, columns: 3 });
    const el = await mount<GridMenuElInstance>(tag);

    dispatchKey(gridItems(el)[0]!, 'ArrowLeft'); // active starts at 0 -> row-axis boundary
    await el.updateComplete;

    expect(onPage).toHaveBeenCalledWith({ direction: -1, reason: 'boundary', axis: 'row' });
    // The machine never lands on a boundary key (SPEC §4.1) — active unmoved.
    expect(el.active).toBe(0);
  });

  it('grid: ArrowDown moves active by the column-stride count', async () => {
    const tag = defineGridMenuEl({ columns: 3 });
    const el = await mount<GridMenuElInstance>(tag);

    dispatchKey(gridItems(el)[0]!, 'ArrowDown');
    await el.updateComplete;

    expect(el.active).toBe(3); // stride 3
    expect(byLabel(el, 'D').hasAttribute('data-rozie-keynav-active')).toBe(true);
  });

  it('grid: a dynamic columns() getter changes the stride between keydowns without re-instantiating the machine', async () => {
    const tag = defineGridMenuEl({ columns: 3 });
    const el = await mount<GridMenuElInstance>(tag);

    dispatchKey(gridItems(el)[0]!, 'ArrowDown'); // stride 3: 0 -> 3 (D)
    await el.updateComplete;
    expect(el.active).toBe(3);

    // A fresh columns VALUE lands via the SAME `this.opts.gridColumns!()`
    // delegation the emitted `gridColumns: () => this.columns` opts line
    // relies on — no re-instantiation of the state machine.
    el.columns = 2;
    await el.updateComplete;
    dispatchKey(gridItems(el)[0]!, 'ArrowDown'); // stride 2: 3 -> 5 (F)
    await el.updateComplete;

    expect(el.active).toBe(5);
  });

  it('no gridColumns: the config handed to the machine has no grid key — 1D arrow semantics (±1), onPage never fires', async () => {
    const onPage = vi.fn();
    const tag = defineGridMenuEl({ onPage });
    const el = await mount<GridMenuElInstance>(tag);

    dispatchKey(gridItems(el)[0]!, 'ArrowDown'); // 1D: ±1, NOT ±columns
    await el.updateComplete;

    expect(el.active).toBe(1);
    expect(onPage).not.toHaveBeenCalled();
  });

  it('grid: a one-frame-late item render still receives focus once it appears (T-77-03-03)', async () => {
    const raf = stubRaf();
    try {
      const tag = defineLateGridEl({});
      const el = await mount<LateGridElInstance>(tag);

      // Ctrl+End resolves to the whole-grid corner (index 5, not yet rendered).
      gridItems(el)[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true, composed: true }),
      );
      await el.updateComplete;

      expect(el.active).toBe(5);
      expect(() => byLabel(el, 'F')).toThrow(); // not yet rendered
      expect(raf.callbacks).toHaveLength(1);

      // The framework "renders" the newly-swapped dataset one frame later.
      el.revealed = true;
      await el.updateComplete;
      const revealedEl = byLabel(el, 'F');
      expect(revealedEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(el.shadowRoot.activeElement).not.toBe(revealedEl);

      // Fire the deferred pass — the element exists now, so focus lands.
      raf.callbacks[0]!(0);
      expect(el.shadowRoot.activeElement).toBe(revealedEl);
    } finally {
      raf.restore();
    }
  });

  it('grid: a stale deferred pass never steals focus after a newer navigation supersedes it (T-77-03-03)', async () => {
    const raf = stubRaf();
    try {
      const tag = defineLateGridEl({});
      const el = await mount<LateGridElInstance>(tag);

      // First navigation lands on the not-yet-rendered index 5 — schedules a
      // deferred pass scoped to active === 5.
      gridItems(el)[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true, composed: true }),
      );
      await el.updateComplete;
      expect(raf.callbacks).toHaveLength(1);
      const stalePass = raf.callbacks[0]!;

      // A second navigation (to an ALREADY-rendered item) supersedes it
      // before the deferred pass ever runs — `hostUpdated()`'s
      // `cancelPendingRetry()` cancels the pending rAF on the very next
      // active-change, but this fixture forces the STALE callback to fire
      // anyway (simulating a browser that already queued the frame) to prove
      // the value-guard inside the callback also holds.
      gridItems(el)[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true, composed: true }),
      );
      await el.updateComplete;
      const aEl = byLabel(el, 'A');
      expect(aEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(el.shadowRoot.activeElement).toBe(aEl);

      el.revealed = true;
      await el.updateComplete;

      // The stale pass (still scoped to the superseded active === 5) fires —
      // it must no-op, never stealing focus back from the current item.
      stalePass(0);
      expect(el.shadowRoot.activeElement).toBe(aEl);
    } finally {
      raf.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Plan 77-05 Task 1 — multi-root DOM containment scoping (SPEC §6). Two
// independent `KeynavController` instances share the SAME shadow root (the
// Landmine-6 delegation design — see `emitKeynav.ts`'s module doc comment)
// but are each constructed with a distinct `rootMarker`; a keydown that
// originates inside ONE group's marked subtree must never move the OTHER
// group's active index.
// ---------------------------------------------------------------------------

interface MultiRootElInstance extends HTMLElement {
  activeA: number;
  activeB: number;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

function defineMultiRootEl(): string {
  const tag = `keynav-test-multiroot-${tagCounter++}`;
  const itemsA = ITEMS;
  const itemsB = ITEMS;

  class MultiRootEl extends LitElement {
    static override properties = { activeA: { type: Number }, activeB: { type: Number } };
    declare activeA: number;
    declare activeB: number;
    controllerA: KeynavController;
    controllerB: KeynavController;

    constructor() {
      super();
      this.activeA = 0;
      this.activeB = 0;
      this.controllerA = new KeynavController(this, {
        config: BASE_CONFIG,
        getSource: () => itemsA,
        getActive: () => this.activeA,
        setActive: (i) => {
          this.activeA = i;
        },
        onCommit: () => {},
        rootMarker: '0',
      });
      this.controllerB = new KeynavController(this, {
        config: BASE_CONFIG,
        getSource: () => itemsB,
        getActive: () => this.activeB,
        setActive: (i) => {
          this.activeB = i;
        },
        onCommit: () => {},
        rootMarker: '1',
      });
    }

    override render() {
      return html`
        <div role="menu" data-rozie-keynav-root="0">
          ${itemsA.map(
            (item, i) => html`
              <li
                data-group="a"
                data-rozie-keynav-item=${i}
                ?data-rozie-keynav-active=${this.activeA === i}
                tabindex=${this.activeA === i ? 0 : -1}
              >${item.label}</li>
            `,
          )}
        </div>
        <div role="menu" data-rozie-keynav-root="1">
          ${itemsB.map(
            (item, i) => html`
              <li
                data-group="b"
                data-rozie-keynav-item=${i}
                ?data-rozie-keynav-active=${this.activeB === i}
                tabindex=${this.activeB === i ? 0 : -1}
              >${item.label}</li>
            `,
          )}
        </div>
      `;
    }
  }

  customElements.define(tag, MultiRootEl);
  return tag;
}

describe('KeynavController — multi-root DOM containment scoping (Plan 77-05 Task 1, SPEC §6)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('a keydown inside group A never moves group B\'s active index, and vice versa', async () => {
    const tag = defineMultiRootEl();
    const el = await mount<MultiRootElInstance>(tag);

    const groupAItems = Array.from(el.shadowRoot.querySelectorAll('[data-group="a"]'));
    dispatchKey(groupAItems[0] as Element, 'ArrowDown');
    await el.updateComplete;

    expect(el.activeA).toBe(2); // index 1 disabled — skipDisabled walks past it
    expect(el.activeB).toBe(0); // group B untouched

    const groupBItems = Array.from(el.shadowRoot.querySelectorAll('[data-group="b"]'));
    dispatchKey(groupBItems[0] as Element, 'ArrowDown');
    await el.updateComplete;

    expect(el.activeB).toBe(2);
    expect(el.activeA).toBe(2); // group A untouched by group B's own move
  });

  it('pointerdown inside group A only resolves an item marker scoped to group A', async () => {
    const tag = defineMultiRootEl();
    const el = await mount<MultiRootElInstance>(tag);

    const groupAItems = Array.from(el.shadowRoot.querySelectorAll('[data-group="a"]'));
    (groupAItems[2] as Element).dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    );
    await el.updateComplete;

    expect(el.activeA).toBe(2);
    expect(el.activeB).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// lit-drill-seed-january — a THIRD, CONDITIONALLY-rendered group (`data-rozie-
// keynav-root` absent until its own mode is active) sharing the same shadow
// root as an always-present group whose CONTENT (not just visibility) empties
// when a sibling mode is active. Mirrors date-picker's day/months/years
// drill triple exactly (day grid's wrapper root is always in the DOM but its
// item content is gated separately; the months/years panels are each fully
// r-if-gated). Reproduces the cross-group DOM-query collision: an INACTIVE
// group's controller (still holding its own default `active === 0`, and
// whose `lastAppliedEl` goes stale the instant ANY sibling's content swaps)
// re-queries the WHOLE shadow root for its own index (because its own scoped
// root element doesn't exist), coincidentally matches a DIFFERENT,
// currently-visible group's item at that same index, and steals DOM focus
// onto it — even though that group's `active` value never actually changed.
// ---------------------------------------------------------------------------

interface DrillElInstance extends HTMLElement {
  mode: 'a' | 'b' | 'c';
  activeA: number;
  activeB: number;
  activeC: number;
  enterB(seedIndex: number): void;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

function defineDrillEl(): string {
  const tag = `keynav-test-drill-${tagCounter++}`;
  const groupItems = ITEMS.map((it) => ({ ...it, disabled: false }));

  class DrillEl extends LitElement {
    static override properties = {
      mode: { type: String },
      activeA: { type: Number },
      activeB: { type: Number },
      activeC: { type: Number },
    };
    declare mode: 'a' | 'b' | 'c';
    declare activeA: number;
    declare activeB: number;
    declare activeC: number;
    controllerA: KeynavController;
    controllerB: KeynavController;
    controllerC: KeynavController;

    constructor() {
      super();
      this.mode = 'a';
      this.activeA = 0;
      this.activeB = 0;
      this.activeC = 0;
      // Construction order mirrors DatePicker.ts's field order (day, month,
      // year) — `hostUpdated()` runs in this SAME order on every update,
      // which is what lets a LATER-constructed inactive controller steal
      // focus back from an EARLIER-constructed active one within one batch.
      this.controllerA = new KeynavController(this, {
        config: BASE_CONFIG,
        getSource: () => groupItems,
        getActive: () => this.activeA,
        setActive: (i) => {
          this.activeA = i;
        },
        onCommit: () => {},
        rootMarker: 'a',
      });
      this.controllerB = new KeynavController(this, {
        config: BASE_CONFIG,
        getSource: () => groupItems,
        getActive: () => this.activeB,
        setActive: (i) => {
          this.activeB = i;
        },
        onCommit: () => {},
        rootMarker: 'b',
      });
      this.controllerC = new KeynavController(this, {
        config: BASE_CONFIG,
        getSource: () => groupItems,
        getActive: () => this.activeC,
        setActive: (i) => {
          this.activeC = i;
        },
        onCommit: () => {},
        rootMarker: 'c',
      });
    }

    /** Mirrors `enterMonthsView()`: seed the target group's active index
     * FIRST, then flip the view mode — both synchronous, same handler. */
    enterB(seedIndex: number): void {
      this.activeB = seedIndex;
      this.mode = 'b';
    }

    override render() {
      // Single top-level wrapper element (rather than several top-level
      // conditional sibling parts) — the vitest/happy-dom environment used
      // by this suite does not reliably patch MULTIPLE top-level dynamic
      // child parts in a shadow-root-rendered template (verified against a
      // throwaway spike: an array/conditional part growing from empty at
      // the TOP LEVEL of the template silently fails to commit under
      // happy-dom@15, while the identical part nested one level down inside
      // a containing element works correctly). This has no bearing on the
      // bug under test — `DatePicker.ts`'s real template nests its drill
      // panels one level inside the component's own root `<div>` the same
      // way.
      return html`
        <div class="root">
          <button type="button" id="drill-heading">Heading</button>
          <div role="menu" data-rozie-keynav-root="a">
            ${this.mode === 'a'
              ? groupItems.map(
                  (item, i) => html`
                    <li
                      data-group="a"
                      data-rozie-keynav-item=${i}
                      ?data-rozie-keynav-active=${this.activeA === i}
                      tabindex=${this.activeA === i ? 0 : -1}
                    >${item.label}</li>
                  `,
                )
              : nothing}
          </div>
          ${this.mode === 'b'
            ? html`<div role="menu" data-rozie-keynav-root="b">
                ${groupItems.map(
                  (item, i) => html`
                    <li
                      data-group="b"
                      data-rozie-keynav-item=${i}
                      ?data-rozie-keynav-active=${this.activeB === i}
                      tabindex=${this.activeB === i ? 0 : -1}
                    >${item.label}</li>
                  `,
                )}
              </div>`
            : nothing}
          ${this.mode === 'c'
            ? html`<div role="menu" data-rozie-keynav-root="c">
                ${groupItems.map(
                  (item, i) => html`
                    <li
                      data-group="c"
                      data-rozie-keynav-item=${i}
                      ?data-rozie-keynav-active=${this.activeC === i}
                      tabindex=${this.activeC === i ? 0 : -1}
                    >${item.label}</li>
                  `,
                )}
              </div>`
            : nothing}
        </div>
      `;
    }
  }

  customElements.define(tag, DrillEl);
  return tag;
}

describe('KeynavController — conditionally-rendered multi-root groups (lit-drill-seed-january)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('entering group B seeds a non-zero active index and focus lands on THAT item, not group C\'s stale default stealing focus onto index 0', async () => {
    const tag = defineDrillEl();
    const el = await mount<DrillElInstance>(tag);

    // Plan 260806-lz7 — establish real focus inside the component BEFORE
    // drilling, mirroring the actual date-picker flow (the user has already
    // interacted with the calendar — e.g. via the persistent month/year
    // header — before ever opening the months drill). `#drill-heading`
    // persists across every mode (unlike a group's own items, which are torn
    // down the instant mode flips — happy-dom, like real browsers, reverts
    // focus to the document the moment a focused node is removed, so a group
    // item cannot be used as the pre-drill focus target here). Without this,
    // group B's entry pass is a COLD first pass with nothing focused
    // anywhere, which the strict-containment guard correctly refuses to
    // steal focus for (case (c)) — this test is specifically the drill-
    // CONTINUITY shape (case (b)), which requires focus already established
    // inside the component.
    (el.shadowRoot.querySelector('#drill-heading') as HTMLElement).focus();

    // Enter group B seeded at index 2 (the "already-selected" cell — mirrors
    // enterMonthsView() resolving to June, index 5, not January, index 0).
    // `activeC` is NEVER touched — it stays at its constructor default (0),
    // exactly like `activeYear` before the years drill is ever entered.
    el.enterB(2);
    await el.updateComplete;

    expect(el.activeB).toBe(2);
    expect(el.activeC).toBe(0); // untouched — this group was never entered

    const groupBItems = Array.from(el.shadowRoot.querySelectorAll('[data-group="b"]'));
    // The regression: group C's controller (inactive, root "c" absent,
    // active still 0) must NOT re-query the whole shadow root and steal
    // focus onto group B's index-0 item.
    expect(el.shadowRoot.activeElement).toBe(groupBItems[2]);
    expect((groupBItems[2] as HTMLElement).getAttribute('data-rozie-keynav-item')).toBe('2');
  });

  // -------------------------------------------------------------------------
  // lit-drill-seed-january follow-up (found via synchronous Docker VR against
  // date-picker-keyboard.spec.ts 'drill enter/exit keeps keyboard focus
  // continuity', line 260): the fix above (queryScope() returning null
  // instead of falling back to the whole shadow root) correctly stops the
  // cross-group steal, but exposed a SECOND, previously-latent gap in the
  // SAME hostUpdated()/applyActiveSideEffects() interaction — clearing
  // `lastAppliedEl` to null when a group's own root is absent silently
  // disables the `staleEl` re-apply trigger for the NEXT time that group's
  // root reappears with the SAME numeric active value (hostUpdated()'s
  // `active === lastActive` short-circuit fires first). Mirrors date-picker's
  // selectYear(): re-entering the months drill after picking a year re-seeds
  // activeMonth to the SAME already-selected month index.
  // -------------------------------------------------------------------------
  it('re-entering group B with an unchanged seed index (after visiting group C) still re-applies focus (lit-drill-seed-january follow-up)', async () => {
    const tag = defineDrillEl();
    const el = await mount<DrillElInstance>(tag);

    // Plan 260806-lz7 — establish real focus inside the component before the
    // first drill, mirroring the actual date-picker flow. See the sibling
    // test above for why this is required under the strict-containment
    // guard.
    (el.shadowRoot.querySelector('#drill-heading') as HTMLElement).focus();

    el.enterB(2);
    await el.updateComplete;
    const firstGroupBItems = Array.from(el.shadowRoot.querySelectorAll('[data-group="b"]'));
    expect(el.shadowRoot.activeElement).toBe(firstGroupBItems[2]);

    // Drill further into group C — group B's root goes absent (torn down),
    // which (like a real browser) reverts DOM focus to the document the
    // instant the focused node is removed. Re-focus the persistent heading —
    // mirroring the real date-picker flow, where the user still has SOME
    // element inside the component focused (e.g. the persistent header) —
    // before re-entering group B.
    el.mode = 'c';
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('[data-rozie-keynav-root="b"]')).toBeNull();
    (el.shadowRoot.querySelector('#drill-heading') as HTMLElement).focus();

    // Re-enter group B, seeded to the SAME index as before (mirrors
    // selectYear() re-resolving $data.activeMonth to the already-seeded
    // month — the selected date never changed, only the view anchor did).
    el.enterB(2);
    await el.updateComplete;

    const groupBItems = Array.from(el.shadowRoot.querySelectorAll('[data-group="b"]'));
    expect(el.activeB).toBe(2);
    expect(el.shadowRoot.activeElement).toBe(groupBItems[2]);
  });
});
