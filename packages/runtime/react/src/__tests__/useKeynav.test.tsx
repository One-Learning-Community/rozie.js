/**
 * Plan 71-04 Task 1 — `useKeynav` behavior tests.
 *
 * Every case from the plan's `<behavior>` block, asserted against a REAL
 * rendered DOM tree (not IR-shape-only — per `feedback_snapshot_tests_cement_bugs`
 * and SPEC §11's "behavior tests, not just snapshots" testing gate). The
 * `Menu` harness below hand-authors the JSX a compiled React `r-keynav`
 * component would emit (`data-rozie-keynav-item`/`data-rozie-keynav-active`/
 * `tabIndex` as DECLARATIVE bindings comparing the loop index to live
 * `active` state — see the module doc comment on `useKeynav.ts` for why the
 * hook itself never touches those two attributes).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
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

function Menu({
  config,
  onCommit,
  activeClass,
  items = ITEMS,
}: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  activeClass?: string;
  items?: Item[];
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  useKeynav(rootRef, {
    config,
    getSource: () => items,
    getActive: () => active,
    setActive,
    onCommit,
    ...(activeClass !== undefined ? { activeClass } : {}),
  });
  return (
    <div role="menu" ref={rootRef} tabIndex={-1} data-testid="root">
      {items.map((it, i) => (
        <button
          key={it.id}
          role="menuitem"
          id={`menu-item-${i}`}
          data-rozie-keynav-item={i}
          data-rozie-keynav-active={active === i ? '' : undefined}
          tabIndex={active === i ? 0 : -1}
          disabled={it.disabled}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function isActive(el: HTMLElement): boolean {
  return el.getAttribute('data-rozie-keynav-active') === '';
}

describe('useKeynav (Plan 71-04 Task 1)', () => {
  it('ArrowDown moves active + stamps data-rozie-keynav-active on the next enabled item (skips disabled)', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' });

    // Index 1 (Bravo) is disabled — skipDisabled lands on index 2 (Charlie).
    expect(isActive(screen.getByText('Charlie'))).toBe(true);
    expect(isActive(screen.getByText('Alpha'))).toBe(false);
    expect(isActive(screen.getByText('Bravo'))).toBe(false);
  });

  it('Home/End jump to first/last enabled; Enter invokes commit with the active index', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'End' });
    expect(isActive(screen.getByText('Charlie'))).toBe(true);

    fireEvent.keyDown(root, { key: 'Enter' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(2);

    fireEvent.keyDown(root, { key: 'Home' });
    expect(isActive(screen.getByText('Alpha'))).toBe(true);
  });

  it('typeahead: typing a label prefix jumps to the matching item', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'c' });

    expect(isActive(screen.getByText('Charlie'))).toBe(true);
  });

  it('r-keynav-active-class tokens are added to the active item and removed from the previous one', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} activeClass="is-active" />);
    const root = screen.getByTestId('root');

    // The active-class effect fires on mount too (active starts at index 0).
    expect(screen.getByText('Alpha').classList.contains('is-active')).toBe(true);

    fireEvent.keyDown(root, { key: 'ArrowDown' });
    expect(screen.getByText('Charlie').classList.contains('is-active')).toBe(true);
    expect(screen.getByText('Alpha').classList.contains('is-active')).toBe(false);

    fireEvent.keyDown(root, { key: 'Home' });
    expect(screen.getByText('Alpha').classList.contains('is-active')).toBe(true);
    expect(screen.getByText('Charlie').classList.contains('is-active')).toBe(false);
  });

  it('tabindex model: the active item receives DOM focus + tabIndex 0, others tabIndex -1', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' });
    const activeEl = screen.getByText('Charlie');

    expect(activeEl.getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('Alpha').getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(activeEl);
  });

  it('pointer activation: pointerdown on an item sets active + fires commit (bounds-checked marker parse)', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);

    fireEvent.pointerDown(screen.getByText('Charlie'));

    expect(commit).toHaveBeenCalledWith(2);
    expect(isActive(screen.getByText('Charlie'))).toBe(true);
  });

  it('activedescendant model: no DOM focus movement (focus stays where the author put it)', () => {
    const commit = vi.fn();
    render(
      <Menu
        config={{ ...BASE_CONFIG, focusModel: 'activedescendant' }}
        onCommit={commit}
      />,
    );
    const root = screen.getByTestId('root');
    root.focus();

    fireEvent.keyDown(root, { key: 'ArrowDown' });

    expect(isActive(screen.getByText('Charlie'))).toBe(true);
    expect(document.activeElement).toBe(root);
  });
});
