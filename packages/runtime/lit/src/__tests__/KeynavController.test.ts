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
