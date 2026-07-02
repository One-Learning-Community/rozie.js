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
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { KeynavConfig } from '@rozie/runtime-keynav-core';
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

function byText(wrapper: ReturnType<typeof mountMenu>, text: string): HTMLElement {
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

  it('pointer activation: pointerdown on an item sets active + fires commit (bounds-checked marker parse)', () => {
    const commit = vi.fn();
    const wrapper = mountMenu({ config: BASE_CONFIG, onCommit: commit });

    byText(wrapper, 'Charlie').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

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
