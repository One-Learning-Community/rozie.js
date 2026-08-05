// Plan 71-05 Task 1 — `useKeynav` (Vue) behavior tests.
//
// Every case from the plan's `<behavior>` block, asserted against a REAL
// rendered DOM tree (not IR-shape-only — per
// `feedback_snapshot_tests_cement_bugs` and SPEC §11's "behavior tests, not
// just snapshots" testing gate). The `Menu` harness below hand-authors the
// template a compiled Vue `r-keynav` component would emit
// (`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabindex` as
// DECLARATIVE bindings comparing the loop index to live `active` state — see
// the module doc comment on `useKeynav.ts` for why the composable itself
// never touches those two attributes). Mirrors the React reference's
// `useKeynav.test.tsx` (Plan 71-04) test-by-test.
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { KeynavConfig, KeynavPageDetail } from '@rozie/runtime-keynav-core';
import { useKeynav } from '../useKeynav.js';

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

function mountMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  activeClass?: string;
  items?: Item[];
}) {
  const items = opts.items ?? ITEMS;
  const Menu = defineComponent({
    setup() {
      const rootRef = ref<HTMLElement | null>(null);
      const active = ref(0);
      useKeynav(rootRef, {
        config: opts.config,
        getSource: () => items,
        getActive: () => active.value,
        setActive: (i) => {
          active.value = i;
        },
        onCommit: opts.onCommit,
        ...(opts.activeClass !== undefined ? { activeClass: opts.activeClass } : {}),
      });
      return () =>
        h(
          'div',
          { role: 'menu', ref: rootRef, tabindex: -1, 'data-testid': 'root' },
          items.map((it, i) =>
            h(
              'button',
              {
                type: 'button',
                key: it.id,
                role: 'menuitem',
                id: `menu-item-${i}`,
                'data-rozie-keynav-item': i,
                'data-rozie-keynav-active': active.value === i ? '' : undefined,
                tabindex: active.value === i ? 0 : -1,
                disabled: it.disabled,
              },
              it.label,
            ),
          ),
        );
    },
  });
  return mount(Menu, { attachTo: document.body });
}

function isActive(el: Element): boolean {
  return el.getAttribute('data-rozie-keynav-active') === '';
}

function byText(wrapper: { element: Element }, text: string): HTMLElement {
  const el = [...wrapper.element.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  );
  if (!el) throw new Error(`no button with text ${text}`);
  return el as HTMLElement;
}

describe('useKeynav (Vue, Plan 71-05 Task 1)', () => {
  it('ArrowDown moves active + stamps data-rozie-keynav-active on the next enabled item (skips disabled)', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'ArrowDown' });

    // Index 1 (Bravo) is disabled — skipDisabled lands on index 2 (Charlie).
    expect(isActive(byText(wrapper, 'Charlie'))).toBe(true);
    expect(isActive(byText(wrapper, 'Alpha'))).toBe(false);
    expect(isActive(byText(wrapper, 'Bravo'))).toBe(false);

    wrapper.unmount();
  });

  it('Home/End jump to first/last enabled; Enter invokes commit with the active index', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'End' });
    expect(isActive(byText(wrapper, 'Charlie'))).toBe(true);

    await root.trigger('keydown', { key: 'Enter' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(2);

    await root.trigger('keydown', { key: 'Home' });
    expect(isActive(byText(wrapper, 'Alpha'))).toBe(true);

    wrapper.unmount();
  });

  it('typeahead: typing a label prefix jumps to the matching item', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'c' });

    expect(isActive(byText(wrapper, 'Charlie'))).toBe(true);

    wrapper.unmount();
  });

  it('r-keynav-active-class tokens are added to the active item and removed from the previous one', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit, activeClass: 'is-active' });
    const root = wrapper.get('[data-testid="root"]');

    // The active-class effect fires on mount too (active starts at index 0).
    expect(byText(wrapper, 'Alpha').classList.contains('is-active')).toBe(true);

    await root.trigger('keydown', { key: 'ArrowDown' });
    expect(byText(wrapper, 'Charlie').classList.contains('is-active')).toBe(true);
    expect(byText(wrapper, 'Alpha').classList.contains('is-active')).toBe(false);

    await root.trigger('keydown', { key: 'Home' });
    expect(byText(wrapper, 'Alpha').classList.contains('is-active')).toBe(true);
    expect(byText(wrapper, 'Charlie').classList.contains('is-active')).toBe(false);

    wrapper.unmount();
  });

  it('tabindex model: the active item receives DOM focus + tabindex 0, others tabindex -1', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'ArrowDown' });
    const activeEl = byText(wrapper, 'Charlie');

    expect(activeEl.getAttribute('tabindex')).toBe('0');
    expect(byText(wrapper, 'Alpha').getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(activeEl);

    wrapper.unmount();
  });

  it('pointer activation: pointerdown on an item sets active + fires commit (bounds-checked marker parse)', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    byText(wrapper, 'Charlie').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await nextTick();

    expect(commit).toHaveBeenCalledWith(2);
    expect(isActive(byText(wrapper, 'Charlie'))).toBe(true);

    wrapper.unmount();
  });

  it('activedescendant model: no DOM focus movement (focus stays where the author put it)', async () => {
    const commit = vi.fn();
    const wrapper = mountMenu({
      config: { ...BASE_CONFIG, focusModel: 'activedescendant' },
      onCommit: commit,
    });
    const root = wrapper.get('[data-testid="root"]');
    (root.element as HTMLElement).focus();

    await root.trigger('keydown', { key: 'ArrowDown' });

    expect(isActive(byText(wrapper, 'Charlie'))).toBe(true);
    expect(document.activeElement).toBe(root.element);

    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// Plan 77-04 Task 1 — `onPage` + `gridColumns` + the deferred one-frame-late
// focus pass. A separate harness (`GridMenu`) keeps the pre-existing `Menu`
// cases above completely untouched (SPEC §7.4 additive invariant). Mirrors
// the React reference's `GridMenu`/`LateGrid` harnesses (Plan 77-03 Task 1)
// test-by-test.
// ---------------------------------------------------------------------------

const GRID_ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
  { id: 'e', label: 'E' },
  { id: 'f', label: 'F' },
];

// `orientation: 'both'` is what the 1D branch falls back to when `columns`
// is NOT supplied — deliberately reused for both the grid and no-grid cases
// below so the harness proves grid semantics are selected by `gridColumns`
// PRESENCE alone, not by anything in `config` itself.
const GRID_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'both',
  loop: false,
  typeahead: false,
  skipDisabled: false,
};

function mountGridMenu(opts: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  /** `undefined` exercises the "no gridColumns" (1D) branch. */
  columns?: number;
  onPage?: (detail: KeynavPageDetail) => void;
  items?: Item[];
}) {
  const items = opts.items ?? GRID_ITEMS;
  const GridMenu = defineComponent({
    props: {
      columns: { type: Number, required: false, default: undefined },
    },
    setup(props) {
      const rootRef = ref<HTMLElement | null>(null);
      const active = ref(0);
      useKeynav(rootRef, {
        config: opts.config,
        getSource: () => items,
        getActive: () => active.value,
        setActive: (i) => {
          active.value = i;
        },
        onCommit: opts.onCommit,
        // Reads `props.columns` fresh on every call — Vue props are
        // reactive, so this mirrors the emitted `() => cols.value` closure
        // without needing an explicit ref indirection in the harness.
        ...(props.columns !== undefined ? { gridColumns: () => props.columns! } : {}),
        ...(opts.onPage !== undefined ? { onPage: opts.onPage } : {}),
      });
      return () =>
        h(
          'div',
          { role: 'grid', ref: rootRef, tabindex: -1, 'data-testid': 'root' },
          items.map((it, i) =>
            h(
              'button',
              {
                type: 'button',
                key: it.id,
                role: 'gridcell',
                'data-rozie-keynav-item': i,
                'data-rozie-keynav-active': active.value === i ? '' : undefined,
                tabindex: active.value === i ? 0 : -1,
              },
              it.label,
            ),
          ),
        );
    },
  });
  return mount(GridMenu, {
    attachTo: document.body,
    props: { ...(opts.columns !== undefined ? { columns: opts.columns } : {}) },
  });
}

// Harness for the "item renders one frame late" cases — item 5 is only
// present once the `revealed` prop flips, standing in for a dataset swap
// (grid paging) whose landing element isn't in the DOM at watch-callback
// time yet.
function mountLateGrid(opts: { revealed: boolean; onCommit: (i: number) => void }) {
  const LateGrid = defineComponent({
    props: {
      revealed: { type: Boolean, required: true },
    },
    setup(props) {
      const rootRef = ref<HTMLElement | null>(null);
      const active = ref(0);
      useKeynav(rootRef, {
        config: GRID_CONFIG,
        getSource: () => GRID_ITEMS,
        getActive: () => active.value,
        setActive: (i) => {
          active.value = i;
        },
        onCommit: opts.onCommit,
        gridColumns: () => 3,
      });
      return () =>
        h(
          'div',
          { role: 'grid', ref: rootRef, tabindex: -1, 'data-testid': 'root' },
          GRID_ITEMS.map((it, i) =>
            i === 5 && !props.revealed
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    key: it.id,
                    role: 'gridcell',
                    'data-rozie-keynav-item': i,
                    'data-rozie-keynav-active': active.value === i ? '' : undefined,
                    tabindex: active.value === i ? 0 : -1,
                  },
                  it.label,
                ),
          ),
        );
    },
  });
  return mount(LateGrid, { attachTo: document.body, props: { revealed: opts.revealed } });
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

describe('useKeynav (Vue) — grid config, @keynav-page, deferred focus (Plan 77-04 Task 1)', () => {
  it('a malformed/out-of-range data-rozie-keynav-item marker is rejected, never coerced (T-77-04-01)', async () => {
    const commit = vi.fn();
    const wrapper = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]').element as HTMLElement;

    const rogue = document.createElement('button');
    rogue.setAttribute('data-rozie-keynav-item', '999');
    root.appendChild(rogue);
    rogue.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await nextTick();

    expect(commit).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('grid: onPage receives a boundary detail when an arrow hits the edge (SPEC §4.1)', async () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const wrapper = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit, onPage });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'ArrowLeft' }); // active starts at 0 -> row-axis boundary

    expect(onPage).toHaveBeenCalledWith({ direction: -1, reason: 'boundary', axis: 'row' });
    // The machine never lands on a boundary key (SPEC §4.1) — active unmoved.
    expect(byText(wrapper, 'A').getAttribute('data-rozie-keynav-active')).toBe('');

    wrapper.unmount();
  });

  it('grid: ArrowDown moves active by the column-stride count', async () => {
    const commit = vi.fn();
    const wrapper = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'ArrowDown' });

    expect(byText(wrapper, 'D').getAttribute('data-rozie-keynav-active')).toBe('');

    wrapper.unmount();
  });

  it('grid: a dynamic columns() getter changes the stride between keydowns without re-instantiating the machine', async () => {
    const commit = vi.fn();
    const wrapper = mountGridMenu({ config: GRID_CONFIG, columns: 3, onCommit: commit });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'ArrowDown' }); // stride 3: 0 -> 3 (D)
    expect(byText(wrapper, 'D').getAttribute('data-rozie-keynav-active')).toBe('');

    // A fresh columns VALUE lands via a reactive prop update — same
    // mechanism a reactive `$data.cols` read would exercise in emitted code.
    await wrapper.setProps({ columns: 2 });
    await root.trigger('keydown', { key: 'ArrowDown' }); // stride 2: 3 -> 5 (F)

    expect(byText(wrapper, 'F').getAttribute('data-rozie-keynav-active')).toBe('');

    wrapper.unmount();
  });

  it('no gridColumns: the config handed to the machine has no grid key — 1D arrow semantics (±1), onPage never fires', async () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    const wrapper = mountGridMenu({ config: GRID_CONFIG, onCommit: commit, onPage });
    const root = wrapper.get('[data-testid="root"]');

    await root.trigger('keydown', { key: 'ArrowDown' }); // 1D: ±1, NOT ±columns

    expect(byText(wrapper, 'B').getAttribute('data-rozie-keynav-active')).toBe('');
    expect(onPage).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('grid: a one-frame-late item render still receives focus once it appears (T-77-03-03)', async () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const wrapper = mountLateGrid({ revealed: false, onCommit: commit });
      const root = wrapper.get('[data-testid="root"]');

      await root.trigger('keydown', { key: 'End', ctrlKey: true }); // grid corner -> index 5, not yet rendered
      expect(wrapper.findAll('button').some((b) => b.text() === 'F')).toBe(false);
      expect(raf.callbacks).toHaveLength(1);

      // The browser "paints" the newly-swapped dataset one frame later.
      await wrapper.setProps({ revealed: true });
      const revealedEl = byText(wrapper, 'F');
      expect(revealedEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).not.toBe(revealedEl);

      // Fire the deferred pass — the element exists now, so focus lands.
      raf.callbacks[0]!(0);
      expect(document.activeElement).toBe(revealedEl);

      wrapper.unmount();
    } finally {
      raf.restore();
    }
  });

  it('grid: a stale deferred pass never steals focus after a newer navigation supersedes it (T-77-03-03)', async () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const wrapper = mountLateGrid({ revealed: false, onCommit: commit });
      const root = wrapper.get('[data-testid="root"]');

      // First navigation lands on the not-yet-rendered index 5 — schedules a
      // deferred pass scoped to active === 5.
      await root.trigger('keydown', { key: 'End', ctrlKey: true });
      expect(raf.callbacks).toHaveLength(1);
      const stalePass = raf.callbacks[0]!;

      // A second navigation (to an ALREADY-rendered item) supersedes it
      // before the deferred pass ever runs — the watch callback itself
      // cancels the pending rAF, but this fixture forces the STALE callback
      // to fire anyway (simulating a browser that already queued the frame)
      // to prove the value-guard inside the callback also holds.
      await root.trigger('keydown', { key: 'Home', ctrlKey: true });
      const aEl = byText(wrapper, 'A');
      expect(aEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).toBe(aEl);

      await wrapper.setProps({ revealed: true });

      // The stale pass (still scoped to the superseded active === 5) fires —
      // it must no-op, never stealing focus back from the current item.
      stalePass(0);
      expect(document.activeElement).toBe(aEl);

      wrapper.unmount();
    } finally {
      raf.restore();
    }
  });
});
